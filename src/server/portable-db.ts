import postgres from 'postgres';

type Row = Record<string, unknown>;
let client: ReturnType<typeof postgres> | undefined;
function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  return client ??= postgres(process.env.DATABASE_URL, { max: 2, prepare: false, ssl: process.env.DATABASE_SSL === 'false' ? false : 'require' });
}

export function translateSql(input: string) {
  let sql = input.replace(/\bAS\s+([a-z][a-z0-9]*[A-Z][a-zA-Z0-9]*)\b/g, 'AS "$1"');
  if (/^\s*INSERT OR IGNORE\b/i.test(sql)) sql = sql.replace(/INSERT OR IGNORE/i, 'INSERT') + ' ON CONFLICT DO NOTHING';
  if (/^\s*INSERT OR REPLACE\b/i.test(sql)) {
    sql = sql.replace(/INSERT OR REPLACE/i, 'INSERT');
    const columns = sql.match(/INSERT INTO\s+[\w]+\s*\(([^)]+)\)/i)?.[1].split(',').map(s => s.trim());
    if (!columns?.length) throw new Error('Unsupported replacement SQL');
    sql += ` ON CONFLICT (${columns[0]}) DO UPDATE SET ${columns.slice(1).map(c => `${c}=EXCLUDED.${c}`).join(',')}`;
  }
  let n = 0, quoted = false, output = '';
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'") { output += c; if (quoted && sql[i + 1] === "'") output += sql[++i]; else quoted = !quoted; }
    else output += c === '?' && !quoted ? `$${++n}` : c;
  }
  return output;
}
function normalize(row: Row): Row {
  return Object.fromEntries(Object.entries(row).map(([key,value]) => [key, typeof value === 'bigint' ? Number(value) : value]));
}
class Statement {
  private args: unknown[] = [];
  readonly sql: string;
  constructor(sql: string) { this.sql = sql; }
  bind(...args: unknown[]) { this.args = args; return this; }
  async execute(executor = db()) { return (await executor.unsafe(translateSql(this.sql), this.args as never[])).map(row => normalize(row as Row)); }
  async all<T = Row>() { return { results: await this.execute() as T[] }; }
  async first<T = Row>() { return (await this.execute())[0] as T | null ?? null; }
  async run() { const rows = await this.execute(); return { success: true, results: rows }; }
}
export const portableDB = {
  prepare(sql: string) { return new Statement(sql); },
  batch(statements: Statement[]) { return db().begin(async tx => {
    const results = [];
    for (const statement of statements) results.push({ success: true, results: await statement.execute(tx as never) });
    return results;
  }); },
};
