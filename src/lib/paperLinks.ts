import type { Paper } from '../types';

function normalizeDoi(doi: string): string {
  return doi
    .trim()
    .replace(/^https?:\/\/doi\.org\//i, '')
    .replace(/^doi:/i, '');
}

function isLikelyDoi(doi: string): boolean {
  const normalized = normalizeDoi(doi).toLowerCase();
  if (!normalized) {
    return false;
  }

  if (['n/a', 'na', 'none', 'unknown', '-'].includes(normalized)) {
    return false;
  }

  return /^10\.\d{4,9}\/\S+$/i.test(normalized);
}

export function getSourceUrl(paper: Pick<Paper, 'doi' | 'title' | 'sourceUrl'>): string {
  if (paper.sourceUrl && /^https?:\/\//i.test(paper.sourceUrl)) {
    return paper.sourceUrl;
  }

  const doi = normalizeDoi(paper.doi);
  if (isLikelyDoi(doi)) {
    return `https://doi.org/${doi}`;
  }

  const query = encodeURIComponent(paper.title);
  return `https://scholar.google.com/scholar?q=${query}`;
}

export function getFullTextUrl(paper: Pick<Paper, 'doi' | 'title' | 'fullTextUrl'>): string {
  if (paper.fullTextUrl && /^https?:\/\//i.test(paper.fullTextUrl)) {
    return paper.fullTextUrl;
  }

  const doi = normalizeDoi(paper.doi);
  if (isLikelyDoi(doi)) {
    return `https://doi.org/${doi}`;
  }

  const query = encodeURIComponent(`${paper.title} filetype:pdf`);
  return `https://www.google.com/search?q=${query}`;
}
