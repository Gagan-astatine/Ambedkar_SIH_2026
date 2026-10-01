import dataset1 from '../../public/data/frames-1.json';
import dataset2 from '../../public/data/frames-2.json';
import dataset3 from '../../public/data/frames-3.json';
import initialReview from '../../public/data/frames-review.json';
import { validateFrame, type ArchiveFrame, type FrameReview } from '../services/frames';

type Inspection = { id: string; raw: Record<string, unknown>; frame: ArchiveFrame | null; issues: string[]; review: FrameReview };
const datasets: { images: unknown[] }[] = [dataset1, dataset2, dataset3];
const decisions = initialReview as Record<string, FrameReview>;

export function inspectFrames() {
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  const inspected: Inspection[] = [];
  for (const dataset of datasets) for (const value of dataset.images) {
    const raw = value as Record<string, unknown>;
    const id = typeof raw.id === 'string' ? raw.id : 'MISSING-ID';
    const { frame, issues } = validateFrame(raw);
    if (seenIds.has(id)) issues.push('Duplicate archive ID');
    if (typeof raw.image_url === 'string' && seenUrls.has(raw.image_url)) issues.push('Potential duplicate image URL');
    seenIds.add(id);
    if (typeof raw.image_url === 'string') seenUrls.add(raw.image_url);
    inspected.push({ id, raw, frame: issues.length ? null : frame, issues, review: decisions[id] || { status: 'REVIEW', reason: 'Awaiting source review.' } });
  }
  return inspected;
}
