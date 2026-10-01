# External processing contracts

The archive accepts public submissions from signed-in ChatGPT users. Every submission remains private and awaits a human review. The original bytes are stored unchanged with a server-side SHA-256 fingerprint. No external service is active until the corresponding server-side secrets are configured in Site settings. Do not put tokens in client code.

## Environment variables

| Service | Server-only variables | Request | Expected response |
| --- | --- | --- | --- |
| n8n | `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET` | JSON `ARCHIVE_SUBMITTED` containing record/version IDs, SHA-256, MIME, 30-minute signed `originalUrl`, `callbackUrl`; Bearer secret and version idempotency key | Any 2xx acknowledgement |
| JEV | `JEV_API_URL`, `JEV_API_TOKEN` | JSON record/version/SHA, title, rights, source, first 30 indexed page hashes and excerpts; Bearer token | `{ "status": "PASS" | "REVIEW" | "FAIL", "findings": [] }` |
| Speech to text | `TRANSCRIPTION_API_URL`, `TRANSCRIPTION_API_TOKEN` | Original audio/video bytes with MIME and `X-Archive-Version`; Bearer token | `{ "language": "en", "provider": "…", "segments": [{ "startMs": 0, "endMs": 1200, "text": "…" }] }` |
| Translation | `TRANSLATION_API_URL`, `TRANSLATION_API_TOKEN` | JSON source ID, PDF page, locale and exact indexed source text; Bearer token | `{ "translatedText": "…", "provider": "…" }` |

All service URLs must be HTTPS. Configure tokens in Site secrets, never commit values. The n8n callback `POST /api/integrations/n8n/callback` accepts the configured Bearer secret and `{recordId,versionId,sha256,stage,status,outputReference?,error?}`. It records stage updates only; it cannot approve, publish or silently replace indexed pages. The signed original URL is limited to the exact version and SHA and expires after 30 minutes.

The public site has no administrator review interface. Manual institutional review remains required before publication: externally generated transcripts and translations start `PENDING`; JEV checks are automation signals, not historical authentication. If JEV is configured, the latest validation must be `PASS` before admin approval. Publication requires completed processing, verified original hash, an externally documented security scan, and explicit approval. Disconnected services report unavailable or not configured.

The host currently provides Sign in with ChatGPT identity for contributors. Google-specific OAuth is not configured by this project.
