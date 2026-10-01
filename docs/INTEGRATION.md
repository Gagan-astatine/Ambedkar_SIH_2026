# Service integration guide

The components use exported services with TypeScript interface contracts from `src/types/archive.ts`. Replace implementations in `src/services/index.ts` (or inject them through a service provider) without changing component presentation. Do not turn on a fake “live” badge simply because a URL has been configured.

| Interface | Current behavior | Production responsibility |
| --- | --- | --- |
| ArchiveService | Seed metadata, official source references and labelled samples | Authorized catalogue API, provenance, version history and original media URLs |
| SearchService | Keyword ranking, entity lookup and small semantic synonym map | Validated filters, full-text and vector retrieval, pagination and real scores |
| RagService | Deterministic discovery summary and staged animation | Retrieve graph/page evidence, call a model through a trusted server, validate citations and return grounding status |
| GuardrailService | Input bounds, evidence and quotation limitations | Institution-approved input policy and evidence checks; connect documented JEV behavior only |
| KnowledgeGraphService | Small source-linked/demonstration graph | Verified entities and typed relationships with document/page evidence |
| PageIndexService | Clearly labelled demonstration pages | Printed/PDF page mapping, OCR/transcription provenance, text regions and immutable source version |
| N8nService | Abortable staged demonstration; no uploads | Authenticated server-side orchestration, retries, job status and approval before publication |
| MetadataService | Dublin Core JSON and BOM UTF-8 CSV | Rights-aware institutional exports and stable identifiers |
| VoiceService | Feature-detected browser speech recognition on explicit action | Optional production speech provider, permission/error handling and consent |

Suggested API boundaries (design proposals, not implemented endpoints):

- `GET /api/documents` and `GET /api/documents/:id`
- `GET /api/documents/:id/pages?page=…`
- `POST /api/search` with mode, query, filters and pagination
- `POST /api/research` with structured sources/citations and grounding status
- `GET /api/graph?entity=…` and `GET /api/timeline`
- `POST /api/ingestion/jobs` and `GET /api/ingestion/jobs/:id`
- `GET /api/export/documents.json` or `.csv`

Search is synchronous in the small demo. A remote adapter should expose asynchronous requests and cancellation, with loading/error states retained in the existing components. Citation targets must be validated against the exact document version and Page Index before display. Store original, transcription, translation and generated interpretation as distinct provenance classes. Never substitute generated text for missing original pages.

The local source IDs are deliberately not real archive accession numbers. Keep demonstration records out of production indexes. Institutional metadata mapping is a standards-based abstraction; there is no invented OKF service endpoint or JEV API.

WebMCP `search_archive_catalogue` validates input, searches the same catalogue, updates the same visible UI and returns concise IDs/titles/provenance. It neither uploads information nor starts a live model call.
