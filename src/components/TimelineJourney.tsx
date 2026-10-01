'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, ChevronDown, ExternalLink, Landmark, MapPin, Pause, Play, RotateCcw, Route, Scale, ScrollText, Search, Square, UsersRound } from 'lucide-react';
import TimelineScene from './TimelineScene';
import { archiveService } from '../services';
import { frameImageUrl, loadFrames, type ArchiveFrame } from '../services/frames';
import {
  EVENT_HOLD_MS, NODE_SPACING, RING_RADIUS, buildMilestones, entryDistance, eventDistance, initialMotion,
  nextExitAngle, nodeCenter, orbitDirection, smoothMotion, snapshotPose,
  type MotionSnapshot, type TimelineCategory, type TimelineMilestone,
} from '../knowledge/timeline-motion';
import type { ArchiveDocument } from '../types/archive';
import type { TimelineDataset, TimelineEvent, TimelineSourceReference } from '../types/timeline';

const STORAGE_KEY = 'ambedkar-orbit-journey-v1';
const categoryIcons = {
  LIFE: CalendarDays, MOVEMENT: Route, CONFERENCE: UsersRound, AGREEMENT: Scale,
  CONSTITUTION: Landmark, WRITING: BookOpen, SOURCE: ScrollText,
} satisfies Record<TimelineCategory, typeof CalendarDays>;
const speedChoices = [0.5, 1, 1.5] as const;

function useSourceEvents() {
  const [dataset, setDataset] = useState<TimelineDataset | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/corpus/timeline.json', { signal: controller.signal, cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) throw new Error('The source timeline is unavailable.');
        return response.json() as Promise<TimelineDataset>;
      })
      .then((value) => {
        if (value.schemaVersion !== 1 || !Array.isArray(value.events)) throw new Error('The source timeline format is invalid.');
        setDataset(value);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Unable to load the source timeline.');
      });
    return () => controller.abort();
  }, []);
  return { dataset, error };
}

function brief(text: string, limit: number) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > limit ? clean.slice(0, limit).replace(/\s+\S*$/, '') + '…' : clean;
}

function relatedPhotographs(event: TimelineEvent, frames: ArchiveFrame[]) {
  const context = `${event.title} ${event.description}`.toLocaleLowerCase();
  return frames.filter((frame) => {
    if (Number(frame.year) !== event.year) return false;
    const label = frame.event?.name?.toLocaleLowerCase() || '';
    return (label.length >= 9 && (context.includes(label) || context.includes(label.replace(/^second /, ''))))
      || (frame.people_present || []).some((person) => person.name.toLocaleLowerCase().includes('savita ambedkar') && context.includes('savita ambedkar'));
  }).slice(0, 3);
}

function EventDetails({ milestone, event, photographs, relatedOpen, setRelatedOpen, onRelated, onSource, onAsk, onClose }: {
  milestone: TimelineMilestone; event: TimelineEvent; relatedOpen: boolean; setRelatedOpen: (value: boolean) => void;
  photographs: ArchiveFrame[];
  onRelated: (event: TimelineEvent) => void; onSource: (source: TimelineSourceReference) => void;
  onAsk: () => void; onClose: () => void;
}) {
  const source = event.sourceReferences[0];
  const document = source ? archiveService.get(source.documentId) : undefined;
  const pdfUrl = source && (document?.pdfUrl || source.pdfUrl);
  const location = event.places[0] || 'Location not identified in the indexed passage';
  const topic = event.topics[0] || event.people[0];
  return <aside id="timeline-event-details" className="orbit-detail" aria-label="Explore event">
    <div className="orbit-detail-heading">
      <div><span className="eyebrow">SOURCE CANDIDATE · {event.datePrecision.toLowerCase()} precision</span><h3>{event.title}</h3></div>
      <button type="button" className="orbit-close" onClick={onClose} aria-label="Close event details">Close</button>
    </div>
    <div className="orbit-detail-grid">
      <div className="orbit-detail-copy">
        <dl><div><dt>YEAR</dt><dd>{event.year}</dd></div><div><dt>LOCATION</dt><dd>{location}</dd></div></dl>
        <h4>Short context</h4><p>{event.description}</p>
        <h4>Why it matters</h4><p>{topic ? 'The indexed passage links this year to ' + topic + ' and gives a page reference for checking the context.' : 'This dated passage gives a direct page reference for further historical research.'} Check the original page before treating the extracted event as verified history.</p>
        <div className="orbit-detail-actions">
          {source && <button type="button" onClick={() => onSource(source)}><BookOpen size={16}/> View sources</button>}
          {source && <a href={`/archive/gravity?entity=${encodeURIComponent(event.id)}`}>Explore in Gravity <ArrowRight size={15}/></a>}
          <button type="button" onClick={() => setRelatedOpen(!relatedOpen)} aria-expanded={relatedOpen}>View related events <ChevronDown size={15}/></button>
          <button type="button" onClick={onAsk}>Ask NANAK RATTU <ArrowRight size={15}/></button>
        </div>
        {relatedOpen && <div className="orbit-related">
          <p>{milestone.related.length ? 'Other indexed references from ' + milestone.year : 'No additional references were selected for this year.'}</p>
          {milestone.related.slice(0, 8).map((related) => <button key={related.id} type="button" onClick={() => onRelated(related)}>{related.dateLabel} · {brief(related.title, 75)}</button>)}
        </div>}
        {event.sourceReferences.length > 1 && <div className="orbit-other-sources">{event.sourceReferences.slice(1).map((item) => <button key={item.pageId} type="button" onClick={() => onSource(item)}>{item.documentTitle} · PDF page {item.pageNumber}</button>)}</div>}
        <p className="orbit-provenance">Extracted from {source?.documentTitle || 'the indexed PDF'}, PDF page {source?.pageNumber ?? '—'} · {source?.method === 'OCR' ? 'OCR transcription: verify against the scan' : 'PDF text layer'}. Dates and names remain source candidates until checked.</p>
        {photographs.length > 0 && <div className="orbit-photographs"><span className="eyebrow">RELATED PHOTOGRAPHS</span>{photographs.map((frame) => <a key={frame.id} href={`/frames?image=${encodeURIComponent(frame.id)}`}><img src={frameImageUrl(frame)} alt={frame.alt_text || frame.title} loading="lazy"/><span>{frame.title}<small>{frame.year} · OPEN FRAME <ArrowRight size={12}/></small></span></a>)}</div>}
      </div>
      {pdfUrl && <figure className="orbit-source-preview">
        <iframe title={'Original PDF page for ' + event.title} src={pdfUrl + '#page=' + source.pageNumber + '&zoom=page-fit&toolbar=0&navpanes=0'} loading="lazy"/>
        <figcaption>{source.documentId} · PDF page {source.pageNumber} · <button type="button" onClick={() => onSource(source)}>Open original <ExternalLink size={12}/></button></figcaption>
      </figure>}
    </div>
  </aside>;
}

export default function TimelineJourney({ reduced, webgl, onOpen }: { reduced: boolean; webgl: boolean; onOpen: (document: ArchiveDocument, page: number) => void }) {
  const { dataset, error } = useSourceEvents();
  const [photographs, setPhotographs] = useState<ArchiveFrame[]>([]);
  useEffect(() => { let live = true; loadFrames().then((frames) => { if (live) setPhotographs(frames); }).catch(() => {}); return () => { live = false; }; }, []);
  const milestones = useMemo(() => buildMilestones(dataset?.events ?? []), [dataset]);
  const milestonesRef = useRef(milestones);
  const [snapshot, setSnapshot] = useState<MotionSnapshot>(initialMotion);
  const snapshotRef = useRef<MotionSnapshot>(initialMotion());
  const [speed, setSpeed] = useState<(typeof speedChoices)[number]>(1);
  const speedRef = useRef(1);
  const [journeyMode, setJourneyMode] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [relatedOpen, setRelatedOpen] = useState(false);
  const [focusedCandidate, setFocusedCandidate] = useState<TimelineEvent | null>(null);
  const [scrollRequest, setScrollRequest] = useState(0);
  const [catalogueQuery, setCatalogueQuery] = useState('');
  const [viewX, setViewX] = useState(0);
  const viewXRef = useRef(0);
  const [stageSize, setStageSize] = useState({ width: 1100, height: 520 });
  const stageRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ x: number; moved: boolean } | null>(null);
  const dragOffsetRef = useRef(0);
  const suppressClick = useRef(false);
  const wheelDistance = useRef(0);
  const phaseStarted = useRef(0);
  const phaseDuration = useRef(0);
  const progressAtStart = useRef(0);
  const lastPaint = useRef(0);
  const lastViewPaint = useRef(0);
  const lastPersist = useRef(0);
  const tickRef = useRef<(now: number) => void>(() => {});
  const pauseRef = useRef<() => void>(() => {});
  const cameraScale = stageSize.height / 8;

  const persist = useCallback((value: MotionSnapshot) => {
    const current = milestonesRef.current;
    if (!current.length) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...value, status: value.status === 'running' ? 'paused' : value.status,
        eventId: current[value.activeIndex]?.id, targetId: current[value.targetIndex]?.id,
        eventIds: current.map((item) => item.id).join('|'),
      }));
    } catch { /* The journey still runs when session storage is unavailable. */ }
  }, []);

  const publish = useCallback((value: MotionSnapshot, now = performance.now()) => {
    snapshotRef.current = value;
    setSnapshot(value);
    lastPaint.current = now;
    persist(value);
    lastPersist.current = now;
  }, [persist]);

  const beginPhase = useCallback((now: number, duration: number, startProgress = 0) => {
    phaseStarted.current = now;
    phaseDuration.current = Math.max(1, duration);
    progressAtStart.current = startProgress;
  }, []);

  const orbit = useCallback((index: number, fromLeft: boolean, automatic: boolean, now: number) => {
    const direction = orbitDirection(index);
    const start = fromLeft ? Math.PI : 0;
    const end = start + direction * Math.PI * (fromLeft ? 3 : 2);
    const duration = (reduced ? 1100 : fromLeft ? 4600 : 3400) / speedRef.current;
    beginPhase(now, duration);
    if (automatic) setFocusedCandidate(null);
    setRelatedOpen(false);
    publish({
      status: 'running', phase: 'orbit', activeIndex: index, targetIndex: index,
      railDistance: eventDistance(index), travelFrom: eventDistance(index), travelTo: eventDistance(index),
      orbitFrom: start, orbitTo: end, orbitAngle: start, progress: 0,
      remainingMs: duration, automatic,
    }, now);
  }, [beginPhase, publish, reduced]);

  const travel = useCallback((current: MotionSnapshot, targetIndex: number, automatic: boolean, now: number) => {
    const from = current.railDistance;
    const forward = eventDistance(targetIndex) > from + 0.001;
    const to = forward ? entryDistance(targetIndex) : eventDistance(targetIndex);
    if (Math.abs(to - from) < 0.02) {
      orbit(targetIndex, false, automatic, now);
      return;
    }
    const distance = Math.abs(to - from);
    const duration = (reduced ? Math.max(850, Math.min(3200, distance * 120)) : Math.max(2600, Math.min(9000, distance * 410))) / speedRef.current;
    beginPhase(now, duration);
    publish({
      ...current, status: 'running', phase: 'travel', targetIndex,
      travelFrom: from, travelTo: to, progress: 0, remainingMs: duration, automatic,
    }, now);
  }, [beginPhase, orbit, publish, reduced]);

  const tick = useCallback((now: number) => {
    const current = snapshotRef.current;
    if (current.status !== 'running') return;
    const elapsed = Math.max(0, now - phaseStarted.current);
    const fraction = Math.min(1, elapsed / phaseDuration.current);
    const progress = progressAtStart.current + (1 - progressAtStart.current) * fraction;
    const eased = smoothMotion(progress);
    const remainingMs = Math.max(0, phaseDuration.current - elapsed);
    const live: MotionSnapshot = {
      ...current, progress, remainingMs,
      railDistance: current.phase === 'travel' ? current.travelFrom + (current.travelTo - current.travelFrom) * eased : current.railDistance,
      orbitAngle: current.phase === 'orbit' || current.phase === 'exit'
        ? current.orbitFrom + (current.orbitTo - current.orbitFrom) * eased : current.orbitAngle,
    };
    snapshotRef.current = live;
    if (fraction >= 1) {
      if (current.phase === 'exit') {
        travel({ ...live, railDistance: eventDistance(current.activeIndex) }, current.targetIndex, current.automatic, now);
      } else if (current.phase === 'travel') {
        orbit(current.targetIndex, current.travelTo > current.travelFrom, current.automatic, now);
      } else if (current.phase === 'orbit') {
        const hold: MotionSnapshot = { ...live, phase: 'hold', progress: 0, remainingMs: EVENT_HOLD_MS, railDistance: eventDistance(current.activeIndex) };
        beginPhase(now, EVENT_HOLD_MS);
        publish(hold, now);
      } else if (current.automatic && current.activeIndex < milestonesRef.current.length - 1) {
        travel({ ...live, railDistance: eventDistance(current.activeIndex) }, current.activeIndex + 1, true, now);
      } else {
        publish({ ...live, status: current.automatic ? 'complete' : 'paused', remainingMs: 0 }, now);
      }
      return;
    }
    if (now - lastPaint.current > 70) {
      setSnapshot(live);
      lastPaint.current = now;
    }
    if (now - lastPersist.current > 300) {
      persist(live);
      lastPersist.current = now;
    }
  }, [beginPhase, orbit, persist, publish, travel]);
  useEffect(() => { tickRef.current = tick; }, [tick]);

  const pause = useCallback(() => {
    if (snapshotRef.current.status !== 'running') return;
    const now = performance.now();
    tickRef.current(now);
    const current = snapshotRef.current;
    if (current.status === 'running') publish({ ...current, status: 'paused' }, now);
  }, [publish]);
  useEffect(() => { pauseRef.current = pause; }, [pause]);
  useEffect(() => { milestonesRef.current = milestones; }, [milestones]);

  const selectEvent = useCallback((index: number, automatic = false) => {
    const bounded = Math.max(0, Math.min(milestonesRef.current.length - 1, index));
    if (!milestonesRef.current.length) return;
    const now = performance.now();
    tickRef.current(now);
    const current = snapshotRef.current;
    if (!automatic) setJourneyMode(false);
    setFocusedCandidate(null);
    setDetailOpen(true);
    if (current.activeIndex === bounded && current.phase !== 'travel' && current.phase !== 'exit') {
      if (current.phase !== 'orbit') orbit(bounded, false, automatic, now);
      return;
    }
    if (current.phase === 'orbit' || current.phase === 'exit') {
      const direction = orbitDirection(current.activeIndex);
      const end = nextExitAngle(current.orbitAngle, direction);
      if (Math.abs(end - current.orbitAngle) < 0.01) {
        travel({ ...current, railDistance: eventDistance(current.activeIndex) }, bounded, automatic, now);
      } else {
        const duration = Math.max(500, (Math.abs(end - current.orbitAngle) / (Math.PI * 2)) * (reduced ? 700 : 1900)) / speedRef.current;
        beginPhase(now, duration);
        publish({
          ...current, status: 'running', phase: 'exit', targetIndex: bounded, automatic,
          orbitFrom: current.orbitAngle, orbitTo: end, progress: 0, remainingMs: duration,
        }, now);
      }
    } else travel(current, bounded, automatic, now);
  }, [beginPhase, orbit, publish, reduced, travel]);

  const exploreEvent = useCallback((index: number) => {
    const milestone = milestonesRef.current[index];
    if (!milestone) return;
    selectEvent(index);
    setFocusedCandidate(milestone.event);
    setDetailOpen(true);
    setScrollRequest((request) => request + 1);
  }, [selectEvent]);

  const restartJourney = useCallback(() => {
    if (!milestonesRef.current.length) return;
    setJourneyMode(true);
    setDetailOpen(true);
    setFocusedCandidate(null);
    const current = snapshotRef.current;
    if (current.activeIndex === 0 && current.phase !== 'travel' && current.phase !== 'exit') {
      orbit(0, false, true, performance.now());
    } else {
      selectEvent(0, true);
    }
  }, [orbit, selectEvent]);

  const toggleEventDetails = useCallback(() => {
    const opening = !detailOpen;
    setDetailOpen(opening);
    if (opening) setScrollRequest((request) => request + 1);
  }, [detailOpen]);

  const runTimeline = useCallback(() => {
    if (!milestonesRef.current.length) return;
    setDetailOpen(true);
    setFocusedCandidate(null);
    const current = snapshotRef.current;
    if (current.status === 'paused' && current.remainingMs > 0 && (current.automatic || current.phase !== 'hold')) {
      beginPhase(performance.now(), current.remainingMs, current.progress);
      publish({ ...current, status: 'running', automatic: true });
    } else orbit(current.activeIndex, false, true, performance.now());
  }, [beginPhase, orbit, publish]);

  const exitRun = useCallback(() => {
    pauseRef.current();
    publish({ ...snapshotRef.current, automatic: false, status: 'paused' });
    setJourneyMode(false);
  }, [publish]);

  const changeSpeed = useCallback((value: (typeof speedChoices)[number]) => {
    const old = speedRef.current;
    if (old === value) return;
    const now = performance.now();
    tickRef.current(now);
    const current = snapshotRef.current;
    speedRef.current = value;
    setSpeed(value);
    if (current.status === 'running' && current.phase !== 'hold') {
      const remainingMs = current.remainingMs * old / value;
      beginPhase(now, remainingMs, current.progress);
      publish({ ...current, remainingMs }, now);
    } else if (current.status === 'paused' && current.phase !== 'hold' && current.remainingMs > 0) {
      publish({ ...current, remainingMs: current.remainingMs * old / value }, now);
    }
  }, [beginPhase, publish]);

  useEffect(() => {
    if (!milestones.length) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null') as (MotionSnapshot & { eventIds?: string; eventId?: string; targetId?: string }) | null;
      if (!saved || !['ready', 'paused', 'complete'].includes(saved.status) || !['orbit', 'travel', 'exit', 'hold'].includes(saved.phase)) return;
      const sameIndex = saved.eventIds === milestones.map((item) => item.id).join('|');
      const eventIndex = milestones.findIndex((item) => item.id === saved.eventId);
      const targetIndex = milestones.findIndex((item) => item.id === saved.targetId);
      if (eventIndex < 0) return;
      const restored: MotionSnapshot = sameIndex && Number.isFinite(saved.railDistance) && Number.isFinite(saved.remainingMs)
        ? { ...saved, activeIndex: eventIndex, targetIndex: targetIndex >= 0 ? targetIndex : eventIndex, status: saved.status === 'ready' ? 'ready' : 'paused' }
        : { ...initialMotion(), status: 'paused', activeIndex: eventIndex, targetIndex: eventIndex, railDistance: eventDistance(eventIndex) };
      snapshotRef.current = restored;
      viewXRef.current = nodeCenter(eventIndex).x;
      queueMicrotask(() => { setSnapshot(restored); setViewX(nodeCenter(eventIndex).x); });
    } catch { /* Ignore a stale or partial session snapshot. */ }
  }, [milestones]);

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const resize = new ResizeObserver(([entry]) => setStageSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    resize.observe(element);
    const visibility = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry.isIntersecting;
      setVisible(entry.isIntersecting);
      if (!entry.isIntersecting) pauseRef.current();
    }, { threshold: 0.08 });
    visibility.observe(element);
    const onPageVisibility = () => { if (document.visibilityState === 'hidden') pauseRef.current(); };
    document.addEventListener('visibilitychange', onPageVisibility);
    return () => { resize.disconnect(); visibility.disconnect(); document.removeEventListener('visibilitychange', onPageVisibility); pauseRef.current(); };
  }, []);

  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    const animate = (now: number) => {
      const delta = Math.min(50, now - previous);
      previous = now;
      if (visibleRef.current) tickRef.current(now);
      const current = snapshotRef.current;
      const pose = snapshotPose(current, milestonesRef.current.length);
      const target = current.phase === 'travel' ? pose.x : nodeCenter(current.activeIndex).x;
      const preview = dragging ? -dragOffsetRef.current / Math.max(1, stageSize.height / 8) : 0;
      viewXRef.current += (target + preview - viewXRef.current) * (1 - Math.exp(-delta * (dragging ? 12 : 4.5) / 1000));
      if (now - lastViewPaint.current > 34) { setViewX(viewXRef.current); lastViewPaint.current = now; }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [dragging, stageSize.height]);

  const active = milestones[snapshot.activeIndex];
  const detailMilestone = focusedCandidate
    ? milestones.find((milestone) => milestone.year === focusedCandidate.year) ?? active
    : active;
  const sourceEvent = focusedCandidate ?? active?.event;
  const next = milestones[Math.min(milestones.length - 1, snapshot.phase === 'travel' || snapshot.phase === 'exit' ? snapshot.targetIndex : snapshot.activeIndex + 1)];

  // Explore can open a different event while the detail panel is still closed.
  // Scroll only after React has committed that event and mounted the panel.
  useLayoutEffect(() => {
    if (!scrollRequest || !detailOpen || !sourceEvent) return;
    const panel = document.getElementById('timeline-event-details');
    if (!panel) return;
    const top = panel.getBoundingClientRect().top + window.scrollY - 20;
    window.scrollTo({ top: Math.max(0, top), behavior: reduced ? 'instant' : 'smooth' });
  }, [detailOpen, reduced, scrollRequest, sourceEvent]);

  const visibleNodes = milestones.map((milestone, index) => ({ milestone, index, x: stageSize.width / 2 + (nodeCenter(index).x - viewX) * cameraScale, y: stageSize.height / 2 - nodeCenter(index).y * cameraScale }))
    .filter((item) => item.x > -170 && item.x < stageSize.width + 170);
  const circleSize = Math.min(250, Math.max(176, 2 * RING_RADIUS * cameraScale - 20));
  const catalogue = useMemo(() => {
    const term = catalogueQuery.trim().toLowerCase();
    return (dataset?.events ?? []).filter((event) => !term || (event.dateLabel + ' ' + event.title + ' ' + event.description).toLowerCase().includes(term)).slice(0, 80);
  }, [dataset, catalogueQuery]);

  const openSource = useCallback((source: TimelineSourceReference) => {
    pauseRef.current();
    const document = archiveService.get(source.documentId);
    if (document) onOpen(document, source.pageNumber);
    else window.open(source.pdfUrl + '#page=' + source.pageNumber, '_blank', 'noopener,noreferrer');
  }, [onOpen]);

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    dragRef.current = { x: event.clientX, moved: false };
  }
  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const distance = event.clientX - dragRef.current.x;
    if (Math.abs(distance) > 9) {
      dragRef.current.moved = true;
      dragOffsetRef.current = distance;
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }
  function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const distance = event.clientX - dragRef.current.x;
    if (dragRef.current.moved && Math.abs(distance) > 32) {
      const steps = Math.max(1, Math.round(Math.abs(distance) / Math.max(1, NODE_SPACING * cameraScale)));
      suppressClick.current = true;
      selectEvent(snapshotRef.current.activeIndex + (distance < 0 ? steps : -steps));
      window.setTimeout(() => { suppressClick.current = false; }, 40);
    }
    dragRef.current = null;
    dragOffsetRef.current = 0;
    setDragging(false);
  }

  return <div className="timeline-journey" aria-label="PDF-derived historical timeline">
    <div className="orbit-topline"><span>THE ARCHIVAL LINE</span><span>{dataset ? dataset.sourceDocumentCount + ' PDFs · ' + dataset.sourcePageCount.toLocaleString() + ' indexed text pages' : 'Reading the page index…'}</span></div>
    <div className={'orbit-stage' + (dragging ? ' is-dragging' : '')} ref={stageRef} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}
      onWheel={(event) => { if (Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.2 && Math.abs(event.deltaX) > 10) { event.preventDefault(); wheelDistance.current += event.deltaX; if (Math.abs(wheelDistance.current) > 90) { selectEvent(snapshotRef.current.activeIndex + (wheelDistance.current > 0 ? 1 : -1)); wheelDistance.current = 0; } } }}
      aria-label="Drag or swipe horizontally to travel between dated source events">
      <div className="orbit-stage-depth" aria-hidden="true"/>
      {milestones.length > 0 && visible && webgl && <div className="orbit-canvas" aria-hidden="true"><TimelineScene count={milestones.length} activeIndex={snapshot.activeIndex} viewX={viewX} viewXRef={viewXRef} snapshotRef={snapshotRef} stageHeight={stageSize.height} visible={visible} moving={snapshot.status === 'running' || dragging} reduced={reduced}/></div>}
      {!webgl && <div className="orbit-flat-rail" aria-hidden="true"/>}
      {visibleNodes.map(({ milestone, index, x, y }) => {
        const Icon = categoryIcons[milestone.icon];
        const current = snapshot.activeIndex === index;
        const upcoming = snapshot.targetIndex === index && snapshot.phase !== 'hold';
        return <div key={milestone.id} className={'orbit-node' + (current ? ' is-active' : '') + (upcoming && !current ? ' is-upcoming' : '')}
          style={{ left: x, top: y, width: circleSize, height: circleSize }}>
          <button className="orbit-node-main" type="button" onClick={() => { if (!suppressClick.current) exploreEvent(index); }}
            aria-label={milestone.year + ': ' + milestone.title + '. Show its source reference'}
            aria-current={current ? 'step' : undefined}>
            <span className="orbit-node-meta"><span>#{String(index + 1).padStart(2, '0')}</span><Icon size={15} strokeWidth={1.5}/></span>
            <span className="orbit-node-year">{milestone.year}</span>
            <strong>{brief(milestone.title, 68)}</strong>
            <span className="orbit-node-description">{brief(milestone.description, 95)}</span>
            <span className="orbit-node-place"><MapPin size={12}/>{brief(milestone.location, 25)}</span>
          </button>
          <button className="orbit-node-explore" type="button" onClick={() => { if (!suppressClick.current) exploreEvent(index); }}
            aria-label={'Explore ' + milestone.year + ' and open its PDF reference'}>
            EXPLORE <ArrowRight size={12}/>
          </button>
        </div>;
      })}
      {active && <div className="orbit-stage-status" role="status" aria-live="polite">
        <span>{snapshot.status === 'running' ? snapshot.phase === 'hold' ? 'EVENT STOP' : snapshot.phase === 'orbit' ? 'ORBITING EVENT' : snapshot.phase === 'exit' ? 'EXITING ORBIT' : 'TRAVELLING' : snapshot.status === 'paused' ? 'PAUSED · POSITION SAVED' : snapshot.status === 'complete' ? 'JOURNEY COMPLETE' : 'TRAIN AT THE FIRST EVENT'}</span>
        {snapshot.phase === 'hold' && snapshot.status === 'running' && <strong>{Math.ceil(snapshot.remainingMs / 1000)} → 0</strong>}
      </div>}
    </div>

    <div className="orbit-controller" aria-label="Timeline controls">
      <div className="orbit-primary-controls">
        <button className="orbit-run" type="button" onClick={snapshot.status === 'running' ? pause : runTimeline} disabled={!milestones.length}>
          <span className="orbit-play-icon">{snapshot.status === 'running' ? <Pause size={15} fill="currentColor"/> : <Play size={15} fill="currentColor"/>}</span>
          {snapshot.status === 'running' ? 'PAUSE TIMELINE' : snapshot.status === 'paused' && snapshot.remainingMs > 0 ? 'RESUME TIMELINE' : 'RUN TIMELINE'}
        </button>
        <button type="button" className={'orbit-journey-toggle' + (journeyMode ? ' active' : '')} aria-pressed={journeyMode} onClick={() => {
          if (journeyMode) { exitRun(); setDetailOpen(false); }
          else { setJourneyMode(true); setDetailOpen(true); if (snapshotRef.current.status !== 'running') runTimeline(); else publish({ ...snapshotRef.current, automatic: true }); }
        }}>JOURNEY MODE <ArrowRight size={14}/></button>
        {snapshot.status === 'running' && <span className="orbit-running-label">RUNNING · {active?.year} → {next?.year}</span>}
      </div>
      <div className="orbit-secondary-controls">
        <button type="button" onClick={() => selectEvent(snapshot.activeIndex - 1)} disabled={!milestones.length || snapshot.activeIndex === 0} aria-label="Previous event"><ArrowLeft size={17}/><span>PREVIOUS</span></button>
        <button type="button" onClick={() => selectEvent(snapshot.activeIndex + 1)} disabled={!milestones.length || snapshot.activeIndex >= milestones.length - 1}><span>NEXT</span><ArrowRight size={17}/></button>
        <button type="button" onClick={restartJourney} disabled={!milestones.length} aria-label="Restart the journey from the first event"><RotateCcw size={14}/><span>RESTART JOURNEY</span></button>
        {snapshot.status === 'running' && <button type="button" onClick={exitRun}><Square size={13}/> EXIT RUN</button>}
        <div className="orbit-speed" aria-label="Playback speed"><span>SPEED</span>{speedChoices.map((choice) => <button type="button" key={choice} aria-pressed={speed === choice} className={speed === choice ? 'active' : ''} onClick={() => changeSpeed(choice)}>{choice}×</button>)}</div>
      </div>
    </div>

    {error ? <p className="orbit-message" role="alert">{error}</p> : !dataset ? <p className="orbit-message">Loading source-derived events…</p> : !milestones.length ? <p className="orbit-message">No dated Ambedkar-related source candidates were found in the indexed PDFs.</p> : active && <>
      <div className="orbit-event-summary" aria-live="polite">
        <div><span className="eyebrow">{String(snapshot.activeIndex + 1).padStart(2, '0')} / {milestones.length} YEAR MILESTONES · {active.category}</span><h3>{active.title}</h3><p>{brief(active.description, 230)}</p></div>
        <div className="orbit-event-summary-actions"><span>{active.event.dateLabel} · {active.location}</span><div>{sourceEvent?.sourceReferences[0] && <button type="button" onClick={() => openSource(sourceEvent.sourceReferences[0])}>VIEW SOURCE <ExternalLink size={14}/></button>}<button type="button" onClick={toggleEventDetails} aria-expanded={detailOpen}>{detailOpen ? 'CLOSE EVENT' : 'EXPLORE EVENT'} <ArrowRight size={16}/></button></div></div>
      </div>
      {(detailOpen || journeyMode) && sourceEvent && detailMilestone && <EventDetails milestone={detailMilestone} event={sourceEvent} photographs={relatedPhotographs(sourceEvent, photographs)} relatedOpen={relatedOpen} setRelatedOpen={setRelatedOpen}
        onRelated={(candidate) => { setFocusedCandidate(candidate); setDetailOpen(true); orbit(snapshot.activeIndex, false, false, performance.now()); window.setTimeout(() => setFocusedCandidate(candidate), 0); }}
        onSource={openSource} onAsk={() => { pauseRef.current(); window.dispatchEvent(new CustomEvent('archive-ask-query', { detail: 'What do the sources say about ' + sourceEvent.title + '?' })); document.getElementById('research')?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth' }); }}
        onClose={() => { setDetailOpen(false); if (journeyMode) exitRun(); }}/>}
      <details className="orbit-catalogue">
        <summary>Browse all {dataset.events.length} extracted event references <ChevronDown size={15}/></summary>
        <label><Search size={16}/><input value={catalogueQuery} onChange={(event) => setCatalogueQuery(event.target.value)} placeholder="Find a year, event or person" aria-label="Search event references"/></label>
        <div>{catalogue.map((event) => <button key={event.id} type="button" onClick={() => {
          const index = milestones.findIndex((item) => item.year === event.year);
          if (index >= 0) { exploreEvent(index); window.setTimeout(() => setFocusedCandidate(event), 0); }
          else if (event.sourceReferences[0]) openSource(event.sourceReferences[0]);
        }}><time>{event.dateLabel}</time><span>{brief(event.title, 96)}</span><small>{event.sourceReferences[0]?.documentId} · PDF page {event.sourceReferences[0]?.pageNumber}</small></button>)}</div>
        {catalogue.length === 80 && <p>Showing the first 80 matches. Narrow the search to see more.</p>}
      </details>
      <p className="orbit-index-note">Milestones are chosen from the PDF Page Index by year and source quality. The underlying {dataset.eventCandidateCount} event references remain available for inspection. Extracted text, especially OCR, requires source review.</p>
    </>}
  </div>;
}
