import { portableDB } from './portable-db';
import { portableStorage } from './portable-storage';

export const env = new Proxy({}, { get(_target, key) {
  if (key === 'DB') return process.env.DATABASE_URL ? portableDB : undefined;
  if (key === 'BUCKET') return process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? portableStorage : undefined;
  return typeof key === 'string' ? process.env[key] : undefined;
} }) as unknown as Cloudflare.Env;
