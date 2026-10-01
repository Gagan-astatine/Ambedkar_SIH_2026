export interface TimelineSourceReference {
  documentId: string;
  documentTitle: string;
  pageNumber: number;
  pageId: string;
  method: string;
  confidence: number | null;
  sourceText: string;
  pdfUrl: string;
}

export interface TimelineEntity {
  label: string;
  type: string;
}

export interface TimelineEvent {
  id: string;
  date: string;
  datePrecision: 'DAY' | 'MONTH' | 'YEAR';
  dateLabel: string;
  year: number;
  month: number | null;
  day: number | null;
  title: string;
  description: string;
  sourceText: string;
  people: string[];
  topics: string[];
  places: string[];
  entities: TimelineEntity[];
  sourceReferences: TimelineSourceReference[];
  imagePreview: { documentId: string; pageNumber: number; pdfUrl: string; method: string };
  reviewStatus: 'CANDIDATE';
  extraction: 'PAGE_INDEX_EVENT_CANDIDATE';
}

export interface TimelineDataset {
  schemaVersion: number;
  generatedFrom: string;
  sourceDocumentCount: number;
  sourcePageCount: number;
  pdfPageCount: number;
  unreadablePageCount: number;
  eventCandidateCount: number;
  events: TimelineEvent[];
}
