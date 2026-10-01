# Ambedkar Digital Heritage Archive

An interactive archive demonstration built with React, TypeScript, Vite/Vinext, Three.js, React Three Fiber and drei. The entrance reconstructs the supplied composition using real scene geometry and interactive HTML. The concept image is not shipped as a background.

## Run locally

Requires Node.js 22.13+ and pnpm 11.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The portable development server uses port 5173. For a production build:

```sh
pnpm exec tsc --noEmit
pnpm build
```

This checkout uses the Sites/Vinext Cloudflare Worker adapter. `dist/server` and `dist/client` contain the production output. Deploying that output elsewhere requires a compatible Worker/Vinext deployment configuration; it is not a plain static Vite export.

## Project structure

- `app/page.tsx`, `app/layout.tsx`: application entry and metadata.
- `app/globals.css`: archival palette, Erstoria/Garamond typography, responsive composition, interaction states and accessibility styles.
- `src/components/ArchiveExperience.tsx`: navigation, entrance, explorer, settings, optional intro and kiosk state.
- `src/components/DocumentReader.tsx`: Page Index reader, zoom, rotation, find, metadata, context and citation copy.
- `src/components/KnowledgeGraph.tsx`: navigable entity/relationship graph.
- `src/components/Timeline.tsx`: source-linked chronology, topic/type/search filters and scale.
- `src/components/Research.tsx`: query, voice availability, retrieval stages, grounding and source references.
- `src/components/KnowledgeEngine.tsx`: eight-stage interactive infrastructure and mock ingestion.
- `src/components/MediaArchive.tsx`: audio player, speed, timestamps and explicit video empty state.
- `src/scene/HeroScene.tsx`: WebGL scene with physically lit book geometry, original portrait texture, architecture, environment lights and contact shadows.
- `src/scene/MuseumFallback.tsx`: Three.js CSS3DRenderer scene used when WebGL is unavailable or lightweight mode is selected.
- `src/types/archive.ts`: domain models and service contracts.
- `src/data/archive.ts`: demonstration records, sources, graph, timeline and engine descriptions.
- `src/services/index.ts`: typed demo services and the backend replacement boundary.
- `src/services/webmcp.ts`: optional, validated page tool using the same search/UI state.
- `src/config/i18n.ts`: English/Hindi/Kannada primary interface strings.
- `public/assets`: original portrait, non-destructive display mask and an 18-second synthetic sound sample.

## What is real and what is simulated

The UI, search/filter controls, document-page navigation, graph, timeline, player, metadata exports, voice feature detection, kiosk controls, 3D geometry and interactions are implemented. The research, semantic expansion, JEV checks and n8n ingestion are deterministic demonstrations. No live model, vector database, n8n instance, OCR pipeline or institutional backend is connected.

Reference records link to official source websites. `REF-` IDs are local catalogue identifiers, not institutional accession numbers. `DEMO-` IDs identify fictional interface examples. Every reader page is labelled **DEMO ARCHIVAL PAGE**. Research does not fabricate historical quotations or provide answers from unindexed originals. Exact-quote requests return insufficient evidence.

The audio sample contains generated musical tones, not a reconstructed historical voice. Annotations demonstrate timestamp navigation; they are not a transcript. No verified video has been supplied, so video presents an honest empty state. English/Hindi/Kannada navigation and major headings are available; detailed catalogue metadata and research content remain in English and are identified as such.

## Portrait and font fidelity

`public/assets/ambedkar-portrait.png` is byte-identical to the authoritative supplied image. SHA-256:

`fae618edfde4816877a0e4fb1bb6390f93af98cb1c8891c7abd3a5dec7ba66f9`

The image is never regenerated, displaced, morphed or facially animated. A separate SVG silhouette mask hides background pixels only at display time. The original asset is available unchanged in the reader. Depth comes from planes, perspective, environmental layers and damped camera movement.

Garamond is self-hosted through EB Garamond and Cormorant Garamond. The requested Erstoria family is first in the display stack, with `local('Erstoria')`; a licensed webfont was not supplied. Until one is added, Cormorant Garamond is the display fallback. To install a licensed copy, place `Erstoria.woff2` in `public/fonts`, then add its `url('/fonts/Erstoria.woff2') format('woff2')` to the existing font-face rule. Do not distribute an unlicensed font.

## Environment and integrations

The demo requires no API key or environment variable. `.env.example` documents future integration settings; setting them alone does not activate a backend. See `docs/INTEGRATION.md` for contracts and connection points.

Never expose model keys, n8n webhook credentials, database passwords or service-role keys in browser bundles. A trusted API must own ingestion, authentication, retrieval, citation validation and model calls.

## Performance and accessibility

- R3F and CSS3D scene modules are lazy-loaded behind an immediate portrait/book fallback.
- Camera movement is damped and tightly bounded; mobile uses a recomposed, stable view.
- WebGL DPR is capped at 1.5 and declines to 1 under load. No post-processing stack or random particle field is included.
- Reduced motion uses demand rendering; the fallback stops drawing once transforms settle. Offscreen scenes reduce movement.
- The portrait is a single 210 KB asset, not a generated high-resolution replacement.
- Dialogs, sheets, tabs, selects, switches and sliders use accessible installed primitives.
- Keyboard-visible focus, a skip link, reduced-motion controls, contrast controls and touch-accessible equivalents are provided.
- Kiosk mode requests fullscreen, enlarges controls, and returns to the entrance after 90 seconds without input. Browser fullscreen restrictions are reported without blocking kiosk layout.

## Validation

See `docs/QA.md` for browser and build verification, along with remaining environment limitations. The browser used for QA had WebGL disabled; the CSS3D fallback was visually exercised. The native WebGL branch is typechecked and built, but needs a final GPU-device visual check before a public institutional launch.

This is an independent demonstration, not an official government archive. Review source/asset permissions, ingest verified original pages, connect the service adapters and obtain editorial review before production archival use.

## Portable hosting

To build this archive outside Cloudflare Sites, use `corepack pnpm build:portable` and `corepack pnpm start:portable`. See [the portable hosting guide](docs/PORTABLE_HOSTING.md) for Supabase, Google sign-in, Vercel and a generic Node host. The included ZIP does not contain the 13 originals held only in the existing R2 bucket or any private credentials.
