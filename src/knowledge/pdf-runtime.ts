type PdfJsModule = typeof import('pdfjs-dist');

let pdfJsPromise: Promise<PdfJsModule> | undefined;
let workerPrefetchStarted = false;

export function loadPdfJs(): Promise<PdfJsModule> {
  pdfJsPromise ??= import('pdfjs-dist').then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    return pdfjs;
  });
  return pdfJsPromise;
}

/** A single progressive stream avoids many slow round trips for large archival scans. */
export function pdfSource(url: string) {
  return { url, disableRange: true, disableStream: false, disableAutoFetch: false };
}

/** Warm PDF.js and its worker after the visitor signals they are about to open a source. */
export function warmPdfReader(): void {
  void loadPdfJs().catch(() => {
    pdfJsPromise = undefined;
  });
  if (workerPrefetchStarted || typeof window === 'undefined') return;
  workerPrefetchStarted = true;
  void fetch('/pdf.worker.min.mjs', { cache: 'force-cache' }).catch(() => {
    workerPrefetchStarted = false;
  });
}
