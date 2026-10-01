import type { TimelineEvent } from '../types/timeline.ts';

export type TimelineCategory = 'LIFE' | 'MOVEMENT' | 'CONFERENCE' | 'AGREEMENT' | 'CONSTITUTION' | 'WRITING' | 'SOURCE';
export type TimelineMilestone = {
  id: string;
  year: number;
  title: string;
  description: string;
  location: string;
  category: TimelineCategory;
  icon: TimelineCategory;
  event: TimelineEvent;
  related: TimelineEvent[];
};

const subject = /\bambedkar\b|\bbabasaheb\b|\bbhimrao\b/i;
const connectedTopic = /poona pact|mahad|round table conference|depressed classes|constituent assembly|constitution of india|satyagraha|untouchab|buddhism|temple entry/i;
const malformedTitle = /^(?:appendix|chapter|held\b|passed\b|formed\b|submitted\b|presented\b|appointed\b|signed\b|died\b|born\b|[\W\d]+$)/i;

function quality(event: TimelineEvent, birthYear: number, deathYear: number) {
  const source = event.sourceReferences[0];
  const years = new Set(event.description.match(/\b(?:18|19|20)\d{2}\b/g) ?? []);
  const title = event.title.replace(/^Dr\. B\. R\. Ambedkar\s*[—–-]\s*/i, '').trim();
  let score = 0;
  if (source?.documentId.startsWith('VOL-')) score += 4;
  if (source?.method === 'NATIVE_TEXT') score += 2;
  if (subject.test(event.title)) score += 2;
  if (connectedTopic.test(`${event.title} ${event.description}`)) score += 2;
  if (/poona pact|mahad satyagraha|kalaram temple|draft constitution|drafting committee|buddhism|constitution of india/i.test(title)) score += 4;
  if (!malformedTitle.test(event.title) && title.length >= 13 && title.length <= 105) score += 2;
  if (malformedTitle.test(title)) score -= 8;
  if (/\b(?:mecting|agam|satuarday|knowlege)\b/i.test(title)) score -= 3;
  if (!subject.test(event.title) && !connectedTopic.test(event.title)) score -= 10;
  if (/^(?:Mahatma Gandhi|Jawaharlal Nehru)\b/i.test(title)) score -= 12;
  if (/^The Poona Pact was\s*[—–-]?\s*signed/i.test(title)) score += 16;
  if (event.datePrecision === 'DAY') score += 1;
  if (event.description.length >= 50 && event.description.length <= 300) score += 1;
  if (years.size === 1 && years.has(String(event.year))) score += 2;
  if (years.size > 1) score -= 8;
  if (/\bborn\b/i.test(title) && event.year === birthYear && /\bborn\b/i.test(event.description) && event.description.includes(String(birthYear))) score += 12;
  if (/\bdied\b/i.test(title) && event.year === deathYear && /\bAmbedkar died\b/i.test(event.description) && event.description.includes(String(deathYear))) score += 12;
  if (/\bborn\b/i.test(title) && event.year !== birthYear) score -= 10;
  if (/\bdied\b/i.test(title) && event.year !== deathYear) score -= 10;
  if (/\b(?:this matter|second opportunity|following|above|below)\b/i.test(title)) score -= 2;
  return score;
}

export function buildMilestones(events: TimelineEvent[]): TimelineMilestone[] {
  if (!events.length) return [];
  const ambedkarEvents = events.filter((event) => subject.test(`${event.title} ${event.description}`));
  const birthYear = Math.min(...ambedkarEvents.filter((event) => /\bborn\b/i.test(event.title)).map((event) => event.year));
  const deathYear = Math.min(...ambedkarEvents.filter((event) => /\bdied\b/i.test(event.title)
    && /\bAmbedkar died\b/i.test(event.description) && event.description.includes(String(event.year)) && event.year > birthYear).map((event) => event.year));
  const lower = Number.isFinite(birthYear) ? birthYear : Math.min(...events.map((event) => event.year));
  const upper = Number.isFinite(deathYear) ? deathYear : Math.max(...events.map((event) => event.year));
  const relevant = events.filter((event) => event.year >= lower && event.year <= upper
    && (subject.test(`${event.title} ${event.description}`) || connectedTopic.test(`${event.title} ${event.description}`)));
  const groups = new Map<number, TimelineEvent[]>();
  for (const event of relevant) groups.set(event.year, [...(groups.get(event.year) ?? []), event]);
  return [...groups].sort(([a], [b]) => a - b).flatMap(([year, candidates]) => {
    const ranked = [...candidates].sort((a, b) => quality(b, lower, upper) - quality(a, lower, upper) || a.date.localeCompare(b.date));
    const lifeEvent = year === lower ? ranked.find((item) => /\bborn\b/i.test(item.title)
      && /^"?Bhimrao Ramji Ambedkar.*\bborn\b/i.test(item.description) && item.description.includes(String(year)))
      : year === upper ? ranked.find((item) => /\bdied\b/i.test(item.title)
        && /\bAmbedkar died\b/i.test(item.description) && item.description.includes(String(year))) : undefined;
    const event = lifeEvent ?? ranked[0];
    if (!lifeEvent && quality(event, lower, upper) < 8) return [];
    const fullText = `${event.title} ${event.description}`;
    const category: TimelineCategory = /poona pact|agreement|signed/i.test(fullText) ? 'AGREEMENT'
      : /constitution|constituent assembly|bill|franchise/i.test(fullText) ? 'CONSTITUTION'
        : /satyagraha|movement|rally|temple entry|conversion/i.test(fullText) ? 'MOVEMENT'
          : /conference|congress|meeting|address|speech|delivered/i.test(fullText) ? 'CONFERENCE'
            : /book|essay|writings|manuscript|publication/i.test(fullText) ? 'WRITING'
              : /\bborn\b|\bdied\b/i.test(fullText) ? 'LIFE' : 'SOURCE';
    let title = event.title.replace(/^Dr\. B\. R\. Ambedkar\s*[—–-]\s*/i, '').replace(/\s+[—–]\s+/g, ' ').replace(/\s+/g, ' ').replace(/^\*\s*/, '').trim();
    const birthName = event.description.match(/^"?([^()]{5,60})\s*\(born\b/i)?.[1]?.trim();
    if (lifeEvent && /\bborn\b/i.test(title) && birthName) title = 'Birth of ' + birthName;
    if (lifeEvent && /\bdied\b/i.test(title) && /\bAmbedkar died in his sleep\b/i.test(event.description)) title = 'Ambedkar died in his sleep';
    return [{
      id: event.id, year, title,
      description: event.description,
      location: event.places[0] || 'Location not identified in index',
      category, icon: category, event, related: ranked.slice(1),
    }];
  });
}

export const RING_RADIUS = 1.62;
export const EVENT_HOLD_MS = 10000;
export const NODE_SPACING = 5.5;
export const CONNECTOR_LENGTH = 2.6;
export const ARC_LENGTH = Math.PI * RING_RADIUS;
export const SEGMENT_LENGTH = CONNECTOR_LENGTH + ARC_LENGTH;
const TAU = Math.PI * 2;

export type TimelinePose = { x: number; y: number; z: number; heading: number };
export type MotionPhase = 'hold' | 'orbit' | 'travel' | 'exit';
export type MotionStatus = 'ready' | 'running' | 'paused' | 'complete';
export type MotionSnapshot = {
  status: MotionStatus;
  phase: MotionPhase;
  activeIndex: number;
  targetIndex: number;
  railDistance: number;
  travelFrom: number;
  travelTo: number;
  orbitFrom: number;
  orbitTo: number;
  orbitAngle: number;
  progress: number;
  remainingMs: number;
  automatic: boolean;
};

export const nodeCenter = (index: number) => ({ x: index * NODE_SPACING, y: index % 2 ? -0.25 : 0.25 });
export const eventDistance = (index: number) => index * SEGMENT_LENGTH;
export const entryDistance = (index: number) => Math.max(0, eventDistance(index) - ARC_LENGTH);
export const orbitDirection = (index: number) => index % 2 ? 1 : -1;

export function orbitPose(index: number, angle: number, direction = orbitDirection(index)): TimelinePose {
  const center = nodeCenter(index);
  return {
    x: center.x + Math.cos(angle) * RING_RADIUS,
    y: center.y + Math.sin(angle) * RING_RADIUS,
    z: 0.34 + 0.035 * Math.sin(angle),
    heading: Math.atan2(direction * Math.cos(angle), -direction * Math.sin(angle)),
  };
}

export function connectorPose(index: number, progress: number): TimelinePose {
  const t = Math.max(0, Math.min(1, progress));
  const from = nodeCenter(index);
  const to = nodeCenter(index + 1);
  const x0 = from.x + RING_RADIUS;
  const x3 = to.x - RING_RADIUS;
  const y0 = from.y;
  const y3 = to.y;
  const bend = index % 2 ? 0.48 : -0.48;
  const x1 = x0 + 0.12, x2 = x3 - 0.12;
  const y1 = y0 + bend, y2 = y3 - bend;
  const inv = 1 - t;
  const x = inv ** 3 * x0 + 3 * inv ** 2 * t * x1 + 3 * inv * t ** 2 * x2 + t ** 3 * x3;
  const y = inv ** 3 * y0 + 3 * inv ** 2 * t * y1 + 3 * inv * t ** 2 * y2 + t ** 3 * y3;
  const dx = 3 * inv ** 2 * (x1 - x0) + 6 * inv * t * (x2 - x1) + 3 * t ** 2 * (x3 - x2);
  const dy = 3 * inv ** 2 * (y1 - y0) + 6 * inv * t * (y2 - y1) + 3 * t ** 2 * (y3 - y2);
  return { x, y, z: 0.34 + 0.04 * Math.sin(t * Math.PI), heading: Math.atan2(dy, dx) };
}

export function railPose(distance: number, count: number): TimelinePose {
  if (count < 2 || distance <= 0) return orbitPose(0, 0);
  const capped = Math.max(0, Math.min(eventDistance(count - 1), distance));
  const index = Math.min(count - 2, Math.floor(capped / SEGMENT_LENGTH));
  const within = capped - eventDistance(index);
  if (within <= CONNECTOR_LENGTH) return connectorPose(index, within / CONNECTOR_LENGTH);
  const angle = Math.PI + orbitDirection(index + 1) * Math.PI * ((within - CONNECTOR_LENGTH) / ARC_LENGTH);
  return orbitPose(index + 1, angle);
}

export function nextExitAngle(angle: number, direction: number) {
  const mod = ((angle % TAU) + TAU) % TAU;
  if (mod < 0.0001 || TAU - mod < 0.0001) return angle;
  return direction < 0 ? angle - mod : angle + TAU - mod;
}

export function smoothMotion(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

export function snapshotPose(snapshot: MotionSnapshot, count: number): TimelinePose {
  if (snapshot.phase === 'orbit' || snapshot.phase === 'exit') return orbitPose(snapshot.activeIndex, snapshot.orbitAngle);
  const pose = railPose(snapshot.railDistance, count);
  return snapshot.phase === 'travel' && snapshot.travelTo < snapshot.travelFrom
    ? { ...pose, heading: pose.heading + Math.PI } : pose;
}

export const initialMotion = (): MotionSnapshot => ({
  status: 'ready', phase: 'hold', activeIndex: 0, targetIndex: 0,
  railDistance: 0, travelFrom: 0, travelTo: 0,
  orbitFrom: 0, orbitTo: 0, orbitAngle: 0,
  progress: 0, remainingMs: 0, automatic: false,
});
