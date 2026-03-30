export type ViewType = 'literature' | 'library';

export type PaperTier = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface Paper {
  id: string;
  title: string;
  authors: string;
  year: number;
  journal: string;
  tier: PaperTier;
  doi: string;
  sourceUrl?: string;
  fullTextUrl?: string;
  abstract: string;
  abstractZh?: string;
  abstractEn?: string;
  tags: string[];
}

export type PaperDraft = Omit<Paper, 'id'>;

export type LibrarySource = 'search' | 'upload';

export interface LibraryPaper extends Paper {
  source: LibrarySource;
  savedAt: string;
}

export type ResearchStepId = 'search' | 'eval' | 'extract' | 'write';

export interface ResearchStep {
  id: ResearchStepId;
  status: 'pending' | 'running' | 'completed' | 'error';
  label: string;
  description: string;
}

export interface LiteratureReviewResult {
  content: string;
  references: Paper[];
}

export type AppErrorCode = 'CONFIG_ERROR' | 'AI_RESPONSE_INVALID' | 'UNKNOWN_ERROR';

export interface AppErrorShape {
  code: AppErrorCode;
  userMessage: string;
  details?: string;
}
