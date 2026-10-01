# Verification record

## Scope

This release is an interactive frontend demonstration. The supplied portrait was checked against its original SHA-256 and is byte-identical. The reference composition is recreated with scene geometry and HTML rather than used as a flat background.

## Responsive checks

The page was inspected through a temporary viewport harness at 1920×1080, 1440×900, 1280×800, 1024×768, 768×1024, 430×932, 390×844 and 360×800. Each requested viewport passed the document horizontal-overflow check. Mobile spacing and portrait scale were corrected. The tablet Constitution placement was moved left after visual inspection revealed an overlap with the text. The temporary harness is excluded from this release.

## Functional checks

- Catalogue keyword search for Constitution returned its record; clearing restored the collection.
- The Constitution scene control opened the document reader. Page navigation, thumbnails, zoom, four rotation steps, text find and copied citation were exercised.
- A research request about constitutional safeguards returned PARTIALLY GROUNDED with a linked source and a working demo-page citation.
- An exact-quotation request returned INSUFFICIENT EVIDENCE without inventing a quotation.
- Graph node selection changed context and related records.
- Timeline search for 1947 and event selection displayed the associated source evidence.
- Knowledge Engine node selection changed its explanation. Mock ingestion completed with an explicit statement that no records were published.
- Media timestamp navigation was invoked, the local audio asset was present, and the video collection correctly displayed its empty state. Audio output was not independently auditioned.
- Reduced-motion and higher-contrast controls changed the corresponding page classes.
- Selecting Hindi set the document language to hi; English was restored.
- Kiosk entry displayed its active state. A final check identified and corrected a header overlap with the exit control; the corrected exit removed kiosk mode without opening another dialog. The 90-second idle reset is implemented; a full timed kiosk endurance test was not performed.

## Automated checks

The release workflow runs TypeScript validation, tests/service-audit.mjs and the production build. The service audit checks unique record IDs, demo provenance, page relationships, filter/search behavior, all research grounding outcomes, valid citation targets, cancellation, and JSON/CSV export behavior. Its checks are assertions against meaningful domain constraints.

## Known validation limits

The managed browser had WebGL unavailable, so visual interaction testing exercised the Three.js CSS3D fallback. Native R3F geometry, shaders and lighting are included in the typecheck/build but still need a GPU-device visual check. No application-origin console errors were observed in the exercised preview; a browser-extension metadata error was unrelated to the application. Microphone capture was not tested. The optional WebMCP API was unavailable in the test browser; ordinary search remained usable.

The Erstoria webfont needs a licensed supplied file. Garamond families are bundled. Research, semantic expansion, JEV and ingestion are explicitly simulated; no live AI, vector store or archival backend is claimed.
