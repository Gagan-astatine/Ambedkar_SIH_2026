# Host the archive on Vercel or a Node server

## What is included

The same source builds for Cloudflare Sites (`pnpm build`) and standard Next.js (`pnpm build:portable`). The portable server uses PostgreSQL through `DATABASE_URL` and a private Supabase Storage bucket for uploaded originals. The supplied 11 local PDFs live under `public/corpus/pdf`. Additional originals previously stored in Cloudflare R2 are not in this source package; either import them into the private bucket at `supplied/<sha256>.pdf` or set `ARCHIVE_SOURCE_BASE_URL` to the trusted existing archive host.

## Prepare the database

The connected Supabase project already has the archive tables and private `archive-originals` bucket. For a different Supabase project, run `db/portable-schema.sql` and `db/portable-storage.sql` in its SQL editor. These tables are restricted from direct anonymous and authenticated API access. The server's Postgres connection and service role key must remain server-side. This does not copy existing D1 rows or R2 files. Publishing, review, timeline and search only reflect indexed, approved sources in this database; an empty database does not become populated by deployment.

Use the Supabase session/pooler connection string for `DATABASE_URL`, the project URL for `SUPABASE_URL`, and a service role key for `SUPABASE_SERVICE_ROLE_KEY`. Do not prefix secrets with `NEXT_PUBLIC_`.

## Vercel dashboard (simple path)

1. Put this source into a **private** Git repository. Do not commit `.env.local` or any keys.
2. In Vercel, choose **Add New → Project**, import the repository, and select the free Hobby plan if eligible.
3. The included `vercel.json` selects Next.js and runs `pnpm build:portable`. Use Node 22 or newer.
4. In **Project Settings → Environment Variables**, enter `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_SESSION_SECRET` (32+ random characters). Add `ARCHIVE_SOURCE_BASE_URL` if retaining the remote originals.
5. Deploy, then open the deployment URL. If you change environment variables, redeploy.
6. Configure the Google OAuth client for your production domain; the frontend uses Google Identity Services ID tokens and posts them to `/api/auth/google`. Add your deployed origin to the client's **Authorized JavaScript origins**. The client ID must match `GOOGLE_CLIENT_ID`. Contributor sign-in does not provide administrative rights. This build has no administrator interface.

Never publish the Postgres connection string, service role key or Google session secret in frontend configuration. Vercel's free tier has resource limits; large archival media and public traffic may exceed them.

## Any Node 22+ host

Run `corepack pnpm install --frozen-lockfile`, `corepack pnpm build:portable`, then `corepack pnpm start:portable` with the same server environment variables and a persistent Supabase project. Reverse proxy HTTPS to the server's port. `PORT` may be set by the host. Built-in PDFs are served as static assets with byte-range support.

## Local check

Copy `.env.example` to `.env.local`, fill the values, run `corepack pnpm install`, then `corepack pnpm dev:portable`. Uploaded archival files require the database and bucket. The local preview account requires the explicit `ARCHIVE_DEV_PREVIEW_AUTH=true` flag and is never intended for production.
