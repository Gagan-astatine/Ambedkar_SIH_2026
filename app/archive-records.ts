import {env} from '@/src/server/platform-env';

export const database = () => env.DB!;
export const storage = () => env.BUCKET!;
export const archiveId = (prefix: string) => `${prefix}-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
export const privateJson = (value: unknown, init?: ResponseInit) => Response.json(value, {
  ...init, headers: { 'Cache-Control': 'no-store', ...init?.headers },
});
