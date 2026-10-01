import { embed, model } from './semantic';
import type { PagePacket } from './pipeline';

/** Browser-side page extraction. The server owns the original bytes and the authoritative SHA-256. */
export async function indexAdminPdf(file: File, recordId: string, startPage: number, progress: (page: number, total: number, stage: string) => void) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const vectorModel = await model();
  let worker: Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>> | null = null;
  try {
    for (let number = startPage + 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      let text = content.items.map((item) => 'str' in item ? `${item.str}${'hasEOL' in item && item.hasEOL ? '\n' : ' '}` : '').join('').trim();
      let method: PagePacket['method'] = 'NATIVE_TEXT';
      let confidence: number | null = null;
      if (text.replace(/\s/g,'').length < 90) {
        progress(number - 1,pdf.numPages,'OCR processing');
        if (!worker) {
          const { createWorker } = await import('tesseract.js');
          worker = await createWorker('eng',1,{ workerPath: '/ocr/worker.min.js', corePath: '/ocr/tesseract-core-lstm.wasm.js', langPath: '/ocr', gzip: true });
        }
        const viewport = page.getViewport({ scale: 1.6 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvas,canvasContext: canvas.getContext('2d')!,viewport }).promise;
        const data = (await worker.recognize(canvas)).data;
        text = data.text.trim();
        confidence = data.confidence / 100;
        method = text ? 'OCR' : 'UNREADABLE';
      }
      const blocks = text.split(/\n\s*\n/).map((value) => value.replace(/\s+/g,' ').trim()).filter((value) => value.length > 45);
      const chunks: string[] = [];
      let current = '';
      for (const block of blocks) {
        if (current && current.length + block.length > 850) { chunks.push(current); current = ''; }
        current += `${current ? ' ' : ''}${block}`;
      }
      if (current) chunks.push(current);
      const heading = text.split('\n').map((value) => value.trim()).find((value) => /^(part|chapter|section|appendix)\s+(?:[IVXLCDM]+|\d+)/i.test(value) && value.length < 170);
      const packet: PagePacket = {
        documentId: recordId,pageNumber: number,text,method,confidence,
        headings: heading ? [{ title: heading,level: heading.split(' ')[0].toUpperCase(),confidence: .92 }] : [],
        chunks: chunks.map((passage,position) => ({ text: passage,position,embedding: embed(passage,vectorModel) })),
      };
      progress(number - 1,pdf.numPages,'Indexing source page');
      const response = await fetch('/api/archive/pages',{ method: 'POST',headers: { 'Content-Type': 'application/json' },body: JSON.stringify(packet) });
      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(error.error || `Indexing stopped at PDF page ${number}.`);
      }
      progress(number,pdf.numPages,'Indexed');
    }
  } finally { await worker?.terminate(); await pdf.cleanup(); }
  return pdf.numPages;
}
