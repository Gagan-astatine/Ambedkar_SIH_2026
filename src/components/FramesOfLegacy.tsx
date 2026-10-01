'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, Maximize2, Minus, Pause, Play, Plus, Search, X } from 'lucide-react';
import { frameImageUrl, loadFrames, searchFrames, type ArchiveFrame } from '../services/frames';
import './frames-of-legacy.css';

function Photograph({ frame, eager = false }: { frame: ArchiveFrame; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [frame.id]);
  return failed ? <div className="frame-unavailable" role="img" aria-label="Photograph temporarily unavailable">IMAGE UNAVAILABLE <small>Metadata and source remain accessible</small></div>
    : <img src={frameImageUrl(frame)} alt={frame.alt_text || frame.title} loading={eager ? 'eager' : 'lazy'} onError={() => setFailed(true)} />;
}

function FrameViewer({ frames, index, onSelect, onClose }: { frames: ArchiveFrame[]; index: number; onSelect: (index: number) => void; onClose: () => void }) {
  const frame = frames[index];
  const [zoom, setZoom] = useState(1);
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [story, setStory] = useState(false);
  const touchStart = useRef<number | null>(null);
  useEffect(() => { setZoom(1); setFailed(false); }, [frame?.id]);
  useEffect(() => {
    if (!story) return;
    const timer = window.setTimeout(() => { if (index >= frames.length - 1) setStory(false); else onSelect(index + 1); }, 12000);
    return () => window.clearTimeout(timer);
  }, [story, index, frames.length, onSelect]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); onSelect((index - 1 + frames.length) % frames.length); }
      if (event.key === 'ArrowRight') { event.preventDefault(); onSelect((index + 1) % frames.length); }
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', key);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', key); };
  }, [frames.length, index, onClose, onSelect]);
  if (!frame) return null;
  const related = frames.filter((item) => item.id !== frame.id && (item.year === frame.year || item.topics?.some((topic) => frame.topics?.includes(topic)))).slice(0, 3);
  return <div className="frame-viewer" role="dialog" aria-modal="true" aria-label={frame.title}>
    <div className="frame-viewer-top"><span>FRAMES OF LEGACY <i>/</i> {String(index + 1).padStart(2, '0')} OF {String(frames.length).padStart(2, '0')}</span><button onClick={onClose} aria-label="Close photograph"><X size={20} /></button></div>
    <div className="frame-viewer-layout"><div className="frame-viewer-stage" ref={container} onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { if (touchStart.current === null) return; const distance = event.changedTouches[0]?.clientX - touchStart.current; if (distance && Math.abs(distance) > 55) onSelect((index + (distance < 0 ? 1 : -1) + frames.length) % frames.length); touchStart.current = null; }}>
      <button className="frame-prev" onClick={() => onSelect((index - 1 + frames.length) % frames.length)} aria-label="Previous photograph"><ArrowLeft /></button>
      {failed ? <div className="frame-unavailable">IMAGE UNAVAILABLE <small>Open the original source below</small></div> : <img src={frameImageUrl(frame)} alt={frame.alt_text || frame.title} style={{ transform: `scale(${zoom})` }} onError={() => setFailed(true)} />}
      <button className="frame-next" onClick={() => onSelect((index + 1) % frames.length)} aria-label="Next photograph"><ArrowRight /></button>
      <div className="frame-zoom"><button onClick={() => setZoom((value) => Math.max(1, value - .25))} aria-label="Zoom out"><Minus size={16} /></button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom((value) => Math.min(3, value + .25))} aria-label="Zoom in"><Plus size={16} /></button><button onClick={() => { if (!document.fullscreenElement) void container.current?.requestFullscreen(); else void document.exitFullscreen(); }} aria-label="Toggle full screen"><Maximize2 size={16} /></button></div>
    </div><aside className="frame-viewer-info"><span className="frame-kicker">ARCHIVAL PHOTOGRAPH · {frame.year || 'DATE UNCONFIRMED'}</span><h2>{frame.title}</h2><p>{frame.description}</p><div className="frame-story"><button onClick={() => { if (index === frames.length - 1 && !story) onSelect(0); setStory(!story); }} aria-pressed={story}>{story ? <Pause size={14} /> : <Play size={14} />}{story ? 'PAUSE VISUAL STORY' : 'PLAY VISUAL STORY'}</button><small>{String(index + 1).padStart(2, '0')} / {String(frames.length).padStart(2, '0')} · SOURCE-LINKED FRAMES</small>{story && <p>{frame.historical_context}</p>}</div><dl><div><dt>LOCATION</dt><dd>{frame.locationLabel}</dd></div><div><dt>SOURCE</dt><dd>{frame.sourceLabel}</dd></div><div><dt>DATE PRECISION</dt><dd>{frame.year_precision || 'Not specified'}</dd></div><div><dt>RECORD</dt><dd>{frame.id}</dd></div></dl><p className="frame-source-caution">Source page matched to the supplied record. Historical description and attribution should be checked against the original.</p><div className="frame-links"><a href={frame.source_page_url} target="_blank" rel="noopener noreferrer">OPEN SOURCE <ExternalLink size={15} /></a><a href={`/archive/gravity?entity=${encodeURIComponent(frame.id)}`}>EXPLORE IN GRAVITY <ArrowRight size={15}/></a><a href="/explore#graph">KNOWLEDGE GRAPH <ArrowRight size={15} /></a>{frame.event && <a href="/#timeline">RELATED TIMELINE <ArrowRight size={15} /></a>}{related.length > 0 && <div className="frame-related"><small>RELATED FRAMES</small>{related.map((item) => <button key={item.id} onClick={() => onSelect(frames.findIndex((entry) => entry.id === item.id))}>{item.title} <ArrowRight size={14} /></button>)}</div>}</div></aside></div>
  </div>;
}

export default function FramesOfLegacy() {
  const [frames, setFrames] = useState<ArchiveFrame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [year, setYear] = useState('All years');
  const [active, setActive] = useState<string | null>(null);
  const collection = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  const select = useCallback((index: number) => setActive(frames[index]?.id || null), [frames]);
  const close = useCallback(() => { setActive(null); history.replaceState(null, '', '/frames'); }, []);
  useEffect(() => {
    let live = true;
    loadFrames().then((items) => {
      if (!live) return;
      setFrames(items);
      const params = new URLSearchParams(window.location.search);
      if (params.get('image')) setActive(params.get('image'));
      if (params.get('year')) setYear(params.get('year')!);
    }).catch((reason) => { if (live) setError(reason instanceof Error ? reason.message : 'Photographs unavailable.'); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);
  const years = useMemo(() => [...new Set(frames.map((frame) => String(frame.year)).filter(Boolean))].sort(), [frames]);
  const filtered = useMemo(() => searchFrames(frames, query).filter((frame) => year === 'All years' || String(frame.year) === year), [frames, query, year]);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), { threshold: .08, rootMargin: '0px 0px -25px 0px' });
    collection.current?.querySelectorAll('.frames-grid article').forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [filtered]);
  useEffect(() => {
    let request = 0;
    const update = () => { cancelAnimationFrame(request); request = requestAnimationFrame(() => {
      const box = collection.current?.getBoundingClientRect();
      if (box) setProgress(Math.max(0, Math.min(100, (innerHeight - box.top) / (box.height + innerHeight) * 100)));
    }); };
    window.addEventListener('scroll', update, { passive: true }); update();
    return () => { cancelAnimationFrame(request); window.removeEventListener('scroll', update); };
  }, []);
  const featured = frames[0];
  const selectedIndex = frames.findIndex((item) => item.id === active);
  return <div className="frames-shell"><header className="frames-header"><a href="/" aria-label="Archive entrance">DIGITAL HERITAGE ARCHIVE <small>DR. B. R. AMBEDKAR</small></a><nav><a href="/archive">READING ROOM</a><a href="/#timeline">TIMELINE</a><a href="/exhibitions">EXHIBITIONS</a></nav><a className="frames-return" href="/"><ArrowLeft size={16} /> RETURN TO ARCHIVE</a></header>
    <main><section className="frames-intro"><span className="frame-kicker">VISUAL ARCHIVE / HISTORICAL PHOTOGRAPHS</span><h1>Frames <em>of Legacy.</em></h1><p>An evolving collection of photographs preserving the people, moments and historical contexts connected to Dr. B. R. Ambedkar and his family.</p><span className="frames-intro-rule">EVERY FRAME CARRIES A SOURCE, A STORY AND A PLACE IN HISTORY.</span></section>
      {featured && <section className="frames-feature"><button className="frames-feature-image" onClick={() => setActive(featured.id)} aria-label={`Explore ${featured.title}`}><Photograph frame={featured} eager /><span>EXPLORE FRAME <ArrowRight size={17} /></span></button><div className="frames-feature-text"><span className="frame-kicker">01 / FEATURED PHOTOGRAPH</span><h2>{featured.title}</h2><p>{featured.description}</p><small>{featured.year} · {featured.locationLabel}</small><button onClick={() => setActive(featured.id)}>ENTER THE FRAME <ArrowRight size={17} /></button></div></section>}
      <section className="frames-collection" id="photographs" ref={collection}><div className="frames-collection-head"><div><span className="frame-kicker">THE PHOTOGRAPHIC COLLECTION</span><h2>Moments held <em>in time.</em></h2></div><span>{String(filtered.length).padStart(2, '0')} SOURCE-CHECKED FRAMES</span></div><div className="frames-filters"><label><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search photographs, people, places…" aria-label="Search photographs" /></label><select value={year} onChange={(event) => setYear(event.target.value)} aria-label="Filter by year"><option>All years</option>{years.map((value) => <option key={value}>{value}</option>)}</select><a href="/archive">SEARCH ALL ARCHIVAL MATERIAL <ArrowRight size={15} /></a></div><nav className="frames-chronology" aria-label="Photograph chronology" style={{ '--journey-progress': `${progress}%` } as React.CSSProperties}><button className={year === 'All years' ? 'active' : ''} onClick={() => setYear('All years')}>ALL</button>{years.map((value) => <button key={value} className={year === value ? 'active' : ''} onClick={() => { setYear(value); collection.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }}>{value}</button>)}</nav>
        {loading ? <p role="status">Opening the visual archive…</p> : error ? <p role="alert">{error}</p> : filtered.length === 0 ? <p>No source-checked photographs match these filters.</p> : <div className="frames-grid">{filtered.map((frame, index) => <article key={frame.id} className={index % 5 === 0 ? 'frame-wide' : ''}><button onClick={() => setActive(frame.id)} className="frame-tile"><div className="frame-mat"><Photograph frame={frame} /></div><span className="frame-tile-meta"><small>{frame.year || 'UNDATED'} / {frame.locationLabel}</small><strong>{frame.title}</strong><span>VIEW PHOTOGRAPH <ArrowRight size={15} /></span></span></button></article>)}</div>}
      </section></main><footer className="frames-footer"><span>DIGITAL HERITAGE ARCHIVE</span><p>Photographs are linked to source pages. Supplied captions are catalog metadata, not independent certification of provenance.</p></footer>
    {selectedIndex >= 0 && <FrameViewer frames={frames} index={selectedIndex} onSelect={select} onClose={close} />}</div>;
}
