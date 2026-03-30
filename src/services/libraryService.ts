import type { LibraryPaper, LibrarySource, Paper } from '../types';

const LIBRARY_STORAGE_KEY = 'deepresearch.library.v1';

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage;
}

function normalizeText(input: string): string {
  return input.trim().toLowerCase();
}

function normalizeDoi(doi: string): string {
  return doi
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/doi\.org\//, '')
    .replace(/^doi:/, '');
}

export function getPaperSignature(paper: Pick<Paper, 'doi' | 'title' | 'year'>): string {
  const doi = normalizeDoi(paper.doi);
  if (doi) {
    return `doi:${doi}`;
  }
  return `meta:${normalizeText(paper.title)}:${paper.year}`;
}

export function createPaperId(prefix = 'paper'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadLibraryPapers(): LibraryPaper[] {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(LIBRARY_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as LibraryPaper[];
  } catch {
    return [];
  }
}

export function persistLibraryPapers(papers: LibraryPaper[]): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  storage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(papers));
}

export function upsertLibraryPaper(
  current: LibraryPaper[],
  paper: Paper,
  source: LibrarySource,
): LibraryPaper[] {
  const signature = getPaperSignature(paper);
  const index = current.findIndex((item) => getPaperSignature(item) === signature);

  if (index >= 0) {
    const next = [...current];
    next[index] = {
      ...next[index],
      ...paper,
      source,
      savedAt: new Date().toISOString(),
    };
    return next;
  }

  return [
    {
      ...paper,
      source,
      savedAt: new Date().toISOString(),
    },
    ...current,
  ];
}

export function removeLibraryPaper(current: LibraryPaper[], id: string): LibraryPaper[] {
  return current.filter((paper) => paper.id !== id);
}
