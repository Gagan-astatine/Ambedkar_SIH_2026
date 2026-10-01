export type ArchiveFrame = {
  id: string; title: string; image_url: string; thumbnail_url?: string | null; display_url?: string; source_page_url: string;
  description: string; historical_context?: string; year: number | string | null; year_precision?: string;
  location?: { name?: string; country?: string } | string; locationLabel: string;
  ambedkar_present: boolean; family_member_present: boolean; qualifying_subject: string;
  people_present?: { name: string }[]; family_members?: { name: string }[];
  event?: { name?: string; description?: string } | null; topics?: string[]; collection?: string;
  source?: { institution?: string; title?: string; url?: string }; sourceLabel: string;
  verification?: Record<string, unknown>; rights?: Record<string, unknown>; dimensions?: { width: number; height: number };
  alt_text?: string; confidence?: string; search_tags?: string[];
  [field: string]: unknown;
};

export type FrameReview = { status: 'PUBLISHED' | 'REVIEW'; reason: string; reviewedBy?: string; reviewedAt?: string; assetUrl?: string; assetSha256?: string };
export const frameImageUrl = (frame: ArchiveFrame) => frame.display_url || frame.thumbnail_url || frame.image_url;
import { embed, normalizeQuery, type Model } from '../knowledge/semantic';

export function validateFrame(value: unknown): { frame: ArchiveFrame | null; issues: string[] } {
  const issues: string[] = [];
  if (!value || typeof value !== 'object') return { frame: null, issues: ['Archive record failed eligibility validation.'] };
  const raw = value as Record<string, unknown>;
  for (const field of ['id', 'title', 'image_url', 'description', 'qualifying_subject']) if (typeof raw[field] !== 'string' || !String(raw[field]).trim()) issues.push(`Missing ${field}`);
  if (raw.year === undefined || raw.year === null || raw.year === '') issues.push('Missing year state');
  if (!raw.source || typeof raw.source !== 'object') issues.push('Missing source');
  if (!raw.verification || typeof raw.verification !== 'object') issues.push('Missing verification');
  if (raw.ambedkar_present !== true && !(raw.family_member_present === true && Array.isArray(raw.family_members) && raw.family_members.length > 0 && (raw.verification as Record<string, unknown> | undefined)?.family_relationship_verified === true)) issues.push('Archive record failed eligibility validation.');
  const validUrl = (input: unknown) => { try { return typeof input === 'string' && new URL(input).protocol === 'https:'; } catch { return false; } };
  if (!validUrl(raw.image_url)) issues.push('Invalid image URL');
  if (!validUrl(raw.source_page_url)) issues.push('Invalid source page URL');
  if (issues.length) return { frame: null, issues };
  const location = raw.location;
  const source = raw.source as { institution?: string; title?: string };
  return { frame: { ...raw, locationLabel: typeof location === 'string' ? location : location && typeof location === 'object' ? String((location as { name?: string }).name || 'Location unrecorded') : 'Location unrecorded', sourceLabel: source.institution || source.title || 'See source record' } as ArchiveFrame, issues };
}

let cached: Promise<ArchiveFrame[]> | null = null;
export function loadFrames(): Promise<ArchiveFrame[]> {
  return cached ??= fetch('/api/frames').then(async (response) => {
    if (!response.ok) throw Error('The visual archive is unavailable.');
    const data = await response.json() as { frames: unknown[] };
    return data.frames.map((item) => validateFrame(item).frame).filter((item): item is ArchiveFrame => !!item);
  }).catch((error) => { cached = null; throw error; });
}

export function searchFrames(frames: ArchiveFrame[], query: string) {
  const phrase = query.toLocaleLowerCase().trim().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ');
  if (!phrase) return frames;
  const terms = phrase.split(' ').filter((word) => word.length > 2 && !['the', 'and', 'for', 'from', 'with', 'photos', 'photographs', 'images'].includes(word));
  if (!terms.length) return frames;
  return frames.map((frame) => {
    const title = frame.title.toLocaleLowerCase();
    const fields = [frame.title, frame.description, frame.historical_context, frame.locationLabel, frame.event?.name, frame.collection, ...(frame.topics || []), ...(frame.search_tags || []), ...(frame.people_present || []).map((person) => person.name)].join(' ').toLocaleLowerCase();
    const matches = terms.filter((term) => fields.includes(term)).length;
    const score = matches / terms.length + (title.includes(phrase) ? 1.2 : 0) + terms.filter((term) => title.includes(term)).length * .08;
    return { frame, score };
  }).filter((item) => item.score >= .35 && (terms.length === 1 || item.score >= .5)).sort((a, b) => b.score - a.score).map((item) => item.frame);
}

export function hybridFrameSearch(frames: ArchiveFrame[], query: string, model: Model) {
  const normalized = normalizeQuery(query, model).query;
  const lexical = searchFrames(frames, normalized);
  const lexicalRanks = new Map(lexical.map((item, index) => [item.id, 1 - index / Math.max(lexical.length, 1)]));
  const queryVector = embed(normalized, model);
  return frames.map((frame) => {
    const metadata = [frame.title, frame.description, frame.historical_context, frame.locationLabel, frame.event?.name, ...(frame.topics || []), ...(frame.search_tags || [])].join(' ');
    const vector = embed(metadata, model);
    const semantic = vector.reduce((sum, value, index) => sum + value * queryVector[index], 0);
    const keyword = lexicalRanks.get(frame.id) || 0;
    return { frame, score: keyword * .65 + semantic * .35, semantic, keyword };
  }).filter((item) => item.keyword > 0 || item.semantic >= .43).sort((a, b) => b.score - a.score).map((item) => item.frame);
}
