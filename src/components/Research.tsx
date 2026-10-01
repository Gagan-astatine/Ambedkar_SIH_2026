'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronDown, ExternalLink, LoaderCircle, Mic, Search, Square, ThumbsDown, ThumbsUp } from 'lucide-react';
import { archiveService, voiceService } from '../services';
import { researchArchive, type ArchiveResearchResponse } from '../services/archive-retrieval';
import type { QueryContext } from '../knowledge/hybrid';
import type { ArchiveDocument, PipelineStatus } from '../types/archive';
import type { Language } from '../config/i18n';
import { speechLanguage } from '../config/i18n';
import './research-archive.css';

const stages = [
  'Load indexed sources',
  'Normalize query',
  'Hybrid search',
  'Rerank passages',
  'Verify citations',
  'Build evidence response',
];

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const keys = [...new Set(terms.filter((term) => term.length > 3))].sort((a, b) => b.length - a.length).slice(0, 12);
  if (!keys.length) return <>{text}</>;
  const escaped = keys.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const expression = new RegExp(`(${escaped.join('|')})`, 'ig');
  const lookup = new Set(keys.map((term) => term.toLocaleLowerCase()));
  return <>{text.split(expression).map((part, index) => lookup.has(part.toLocaleLowerCase()) ? <mark key={index}>{part}</mark> : part)}</>;
}

function sourceLabel(method: string) {
  return method === 'OCR' ? 'OCR transcription · verify against scan' : method === 'NATIVE_TEXT' ? 'PDF text layer' : method;
}

function feedbackKey(result: ArchiveResearchResponse['results'][number]) {
  return `${result.documentId}:${result.pageNumber}`;
}

export default function Research({ onOpen, onEntity, language }: {
  onOpen: (document: ArchiveDocument, page?: number) => void;
  onEntity: (id: string) => void;
  language: Language;
}) {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<ArchiveResearchResponse | null>(null);
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [voice, setVoice] = useState('Ready');
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const request = useRef<AbortController | null>(null);
  const stopVoice = useRef<(() => void) | null>(null);
  const conversationContext = useRef<QueryContext | undefined>(undefined);
  const runFromTimeline = useRef<(value: string) => void>(() => {});

  useEffect(() => {
    const readiness = requestAnimationFrame(() => setVoiceSupported(voiceService.supported()));
    const onTimelineAsk = (event: Event) => {
      const value = (event as CustomEvent<string>).detail;
      if (typeof value !== 'string') return;
      setQuery(value);
      document.getElementById('research-query')?.focus({ preventScroll: true });
      runFromTimeline.current(value);
    };
    window.addEventListener('archive-ask-query', onTimelineAsk);
    return () => {
      window.removeEventListener('archive-ask-query', onTimelineAsk);
      cancelAnimationFrame(readiness);
      request.current?.abort();
      stopVoice.current?.();
    };
  }, []);

  async function run(nextQuery = query) {
    const value = nextQuery.trim();
    if (value.length < 2 || value.length > 500) {
      setError('Enter a question or source search between 2 and 500 characters.');
      return;
    }
    request.current?.abort();
    stopVoice.current?.();
    const controller = new AbortController();
    request.current = controller;
    setQuery(value);
    setBusy(true);
    setError('');
    setResponse(null);
    setShowMore(false);
    setStatus({ stage: 0, label: 'LOADING INDEXED SOURCES', complete: false });
    try {
      const next = await researchArchive(value, setStatus, controller.signal, conversationContext.current);
      if (controller.signal.aborted) return;
      setResponse(next);
      conversationContext.current = {
        previousQuery: next.analysis.normalizedQuery,
        entities: next.analysis.entities.filter((item) => item.type !== 'DOCUMENT').map((item) => item.label),
        documentTitles: next.results.slice(0, 3).map((item) => item.document.title),
      };
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
        setError(cause instanceof Error ? cause.message : 'The source index could not complete this search.');
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  useEffect(() => { runFromTimeline.current = (value) => { void run(value); }; });

  function stop() {
    request.current?.abort();
    setBusy(false);
    setStatus(null);
  }

  function openSource(documentId: string, page: number) {
    const document = archiveService.get(documentId);
    if (document) { onOpen(document, page); return; }
    const reference = response?.results.find((result) => result.documentId === documentId && result.pageNumber === page);
    if (reference?.document.pdfUrl) window.open(`${reference.document.pdfUrl}#page=${page}`, '_blank', 'noopener,noreferrer');
  }

  function recordFeedback(result: ArchiveResearchResponse['results'][number], value: string) {
    const key = feedbackKey(result);
    setFeedback((current) => ({ ...current, [key]: value }));
    try {
      const storageKey = 'nanak-rattu-source-feedback-v1';
      const old = JSON.parse(sessionStorage.getItem(storageKey) || '[]') as { documentId: string; pageNumber: number; feedback: string; recordedAt: string }[];
      const next = [...old.filter((item) => item.documentId !== result.documentId || item.pageNumber !== result.pageNumber), {
        documentId: result.documentId,
        pageNumber: result.pageNumber,
        feedback: value,
        recordedAt: new Date().toISOString(),
      }].slice(-100);
      sessionStorage.setItem(storageKey, JSON.stringify(next));
    } catch { /* Feedback remains available in component state when storage is disabled. */ }
  }

  const claimKeys = new Set(response?.answer.claims.map((claim) => `${claim.documentId}:${claim.pageNumber}`) ?? []);
  const additionalResults = response && response.answer.status !== 'OUT OF SCOPE'
    ? response.results.filter((result) => !claimKeys.has(feedbackKey(result))) : [];
  const relatedEntities = [...new Map((response?.analysis.entities ?? []).filter((entity) => entity.type !== 'DOCUMENT').map((entity) => [`${entity.type}:${entity.label}`, entity])).values()].slice(0, 6);
  const queryReady = query.trim().length >= 2 && query.trim().length <= 500;

  return <div className="research-workspace research-assistant" aria-label="NANAK RATTU source research">
    <div className="research-intro">
      <div>
        <p className="eyebrow">NANAK RATTU · SOURCE-FIRST ARCHIVE RESEARCH</p>
        <p>Ask about Dr. B. R. Ambedkar and directly related history. Every factual response begins with indexed PDF evidence.</p>
      </div>
      <div className="research-index-summary" aria-label="Retrieval features">
        <span>PDF page index</span><span>Keyword + semantic search</span><span>Citations checked before response</span>
      </div>
    </div>

    <form className="research-form research-ask-form" onSubmit={(event) => { event.preventDefault(); void run(); }}>
      <label htmlFor="research-query" className="eyebrow">YOUR QUESTION OR SOURCE SEARCH</label>
      <textarea id="research-query" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={500}
        placeholder="Try “ambedkr anhilition caste” or “Ambedkar ne caste ke bare mein kya kaha”" rows={3}
        aria-describedby="research-privacy-note" />
      <div className="research-actions">
        <div className="research-voice-control">
          <button type="button" className="text-link" disabled={!voiceSupported || busy} onClick={() => {
            if (voice === 'Listening') { stopVoice.current?.(); return; }
            stopVoice.current = voiceService.listen(setQuery, setVoice, speechLanguage[language]);
          }}>
            {voice === 'Listening' ? <Square size={15}/> : <Mic size={16}/>}{voice === 'Listening' ? 'Stop listening' : 'Ask by voice'}
          </button>
          <span className="fine" role="status">{voiceSupported ? voice : 'Voice unavailable · type your question'}</span>
        </div>
        <button className="primary-button" disabled={busy || !queryReady} type="submit">
          {busy ? <LoaderCircle className="research-spin" size={17}/> : <Search size={17}/>}{busy ? 'Searching indexed sources…' : 'Search the archive'}
        </button>
      </div>
      <p id="research-privacy-note" className="fine research-privacy">Search runs against this archive’s local indexes. Questions are kept in memory for follow-ups and are not sent to a language model.</p>
    </form>

    <div className="suggestions research-suggestions" aria-label="Suggested source searches">
      <span>Search examples</span>
      {['Annihilation of Caste', 'Bahishkrit Hitakarini Sabha', 'Ambedkar and the Constitution'].map((example) =>
        <button key={example} disabled={busy} onClick={() => void run(example)}>{example}<ChevronDown size={13}/></button>)}
    </div>

    {busy && <div className="retrieval-progress research-pipeline" role="status" aria-live="polite">
      <ol className="retrieval-stages" aria-label="Live retrieval stages">
        {stages.map((label, index) => <li key={label} className={index < (status?.stage ?? 0) ? 'reached' : index === status?.stage ? 'current' : ''}>
          <span>{String(index + 1).padStart(2, '0')}</span><small>{label}</small>
        </li>)}
      </ol>
      <p>{status?.label ?? 'SEARCHING INDEXED SOURCES'}</p>
      <button className="text-link" type="button" onClick={stop}>Cancel search</button>
    </div>}

    {error && <div className="research-message research-error" role="alert"><strong>Search stopped.</strong><p>{error}</p></div>}

    {response && <section className="research-result" aria-live="polite" aria-label="Retrieved source response">
      <div className="response-heading">
        <span className={`grounding status-${response.answer.status.toLowerCase().replaceAll(/[^a-z]+/g, '-')}`}>{response.answer.status}</span>
        <span className="eyebrow">{response.analysis.intent} · {response.trace.elapsedMs.toLocaleString()} ms</span>
      </div>
      <div className="research-answer-card">
        <div className="research-answer-head"><span className="eyebrow">ANSWER</span><span className="fine">{response.answer.claims.length ? `${response.answer.claims.length} source${response.answer.claims.length === 1 ? '' : 's'}` : 'Insufficient evidence'}</span></div>
        <p className="response-summary">{response.answer.text}</p>
        {response.answer.sourceConflict && <p className="research-conflict" role="status">Sources differ on this point. Compare the original pages below.</p>}
        {response.answer.claims.length > 0 && <div className="research-answer-references"><h4>References</h4><ol>{response.answer.claims.map((claim) => {
          const source = response.results.find((item) => item.documentId === claim.documentId && item.pageNumber === claim.pageNumber);
          if (!source) return null;
          return <li key={`${claim.documentId}-${claim.pageNumber}`}><button type="button" className="text-link research-citation-link" onClick={() => openSource(claim.documentId, claim.pageNumber)}><BookOpen size={15}/>{source.document.title} · PDF page {claim.pageNumber}<ArrowRight size={14}/></button><span>{sourceLabel(claim.method)}</span></li>;
        })}</ol></div>}
      </div>
      <div className="research-query-trace">
        <span>SEARCHED: {response.analysis.normalizedQuery || response.analysis.rawQuery}</span>
        {response.analysis.corrections.length > 0 && <span>SEARCHING FOR: {response.analysis.corrections.map((item) => item.to).join(' · ')}</span>}
        {response.analysis.contextApplied && <span>FOLLOW-UP CONTEXT APPLIED</span>}
      </div>


      {response.answer.status !== 'OUT OF SCOPE' && response.results.length > 0 && <div className="research-source-panel">
        <div className="research-source-heading"><div><p className="eyebrow">SOURCE TRAIL</p><h4>{response.results.length} verified page reference{response.results.length === 1 ? '' : 's'}</h4></div>
          <span className="fine">{response.trace.semanticCandidates} vector · {response.trace.keywordCandidates} keyword candidates</span>
        </div>
        <div className="research-source-list">
          {response.results.map((result, index) => {
            const key = feedbackKey(result);
            return <article className="research-source-card" key={key}>
              <div className="research-source-card-heading"><span>{String(index + 1).padStart(2, '0')}</span><div><h5>{result.document.title}</h5><p>{result.document.filename} · {result.citation.source}</p></div>
                <span className="research-page-chip">PDF p. {result.pageNumber}</span>
              </div>
              <p className="research-extract"><Highlight text={result.excerpt} terms={result.matchedTerms}/></p>
              <div className="research-source-meta"><span>{sourceLabel(result.method)}</span>{result.printedPage && <span>Printed p. {result.printedPage}</span>}<span>{result.documentId}</span></div>
              <div className="research-source-actions">
                <button type="button" className="outline-button" onClick={() => openSource(result.documentId, result.pageNumber)}><BookOpen size={15}/> View Source <span>PDF p. {result.pageNumber}</span></button>
                {result.document.pdfUrl && <a className="text-link" href={`${result.document.pdfUrl}#page=${result.pageNumber}`} target="_blank" rel="noreferrer"><ExternalLink size={14}/>Open PDF in new tab</a>}
                {result.document.pdfUrl?.startsWith('/api/archive/supplied')&&<a className="text-link" href={`/archive/gravity?entity=${encodeURIComponent(result.documentId)}`}>Explore in Gravity <ArrowRight size={14}/></a>}
              </div>
              <div className="research-feedback" aria-label={`Rate source ${result.documentId}, page ${result.pageNumber}`}>
                {['Helpful', 'Not Helpful', 'Wrong / Misquoted', 'Wrong Source'].map((choice) => <button key={choice} type="button" className={feedback[key] === choice ? 'selected' : ''} aria-pressed={feedback[key] === choice} onClick={() => recordFeedback(result, choice)}>
                  {choice === 'Helpful' ? <ThumbsUp size={13}/> : choice === 'Not Helpful' ? <ThumbsDown size={13}/> : <span>!</span>}{choice}
                </button>)}
                {feedback[key] && <small><Check size={12}/> Saved for this browser session</small>}
              </div>
              {result.method === 'OCR' && <p className="research-ocr-note">OCR can misread scanned text. Check the original PDF page before quoting this passage.</p>}
            </article>;
          })}
        </div>
      </div>}

      {relatedEntities.length > 0 && response.answer.status !== 'OUT OF SCOPE' && <div className="research-related">
        <span className="eyebrow">RELATED PEOPLE & TOPICS</span>
        <div>{relatedEntities.map((entity) => <button type="button" key={`${entity.type}-${entity.label}`} onClick={() => onEntity(entity.label)}>{entity.label}<ArrowRight size={13}/></button>)}</div>
      </div>}

      {additionalResults.length > 0 && <details className="research-more" open={showMore}>
        <summary onClick={(event) => { event.preventDefault(); setShowMore((value) => !value); }}>{showMore ? 'Hide additional passages' : `Read more · ${additionalResults.length} additional source passages`}<ChevronDown size={16}/></summary>
        {showMore && <div>{additionalResults.map((result) => <article key={feedbackKey(result)}><span className="eyebrow">{result.document.title} · PDF page {result.pageNumber} · {sourceLabel(result.method)}</span><p><Highlight text={result.excerpt} terms={result.matchedTerms}/></p><button type="button" className="text-link" onClick={() => openSource(result.documentId, result.pageNumber)}>Open this page<ArrowRight size={14}/></button></article>)}</div>}
      </details>}

      <details className="research-trace"><summary>Retrieval trace & index coverage<ChevronDown size={15}/></summary><dl>
        <div><dt>Intent</dt><dd>{response.analysis.intent}</dd></div><div><dt>Documents indexed</dt><dd>{response.trace.indexedDocuments}</dd></div>
        <div><dt>Keyword pages</dt><dd>{response.trace.keywordPages.toLocaleString()}</dd></div><div><dt>Vector pages</dt><dd>{response.trace.vectorPages.toLocaleString()}</dd></div>
        <div><dt>Reranked candidates</dt><dd>{response.trace.mergedCandidates}</dd></div><div><dt>Validated citations</dt><dd>{response.trace.verifiedCitations}</dd></div>
      </dl><p>Answers are assembled only from verified indexed passages. Follow each PDF page reference to inspect its original context; OCR may need visual verification.</p></details>
    </section>}
  </div>;
}
