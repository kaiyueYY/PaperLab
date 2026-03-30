import type { PaperDraft, PaperTier } from '../types';

const SEMANTIC_SCHOLAR_API = 'https://api.semanticscholar.org/graph/v1/paper/search';
const ARXIV_API = 'https://export.arxiv.org/api/query';
const SERPER_SCHOLAR_API = 'https://google.serper.dev/scholar';

interface SearchCandidate extends PaperDraft {
  citationCount: number;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function normalizeDoi(doi: string): string {
  return doi
    .trim()
    .replace(/^https?:\/\/doi\.org\//i, '')
    .replace(/^doi:/i, '')
    .toLowerCase();
}

function isLikelyDoi(doi: string): boolean {
  return /^10\.\d{4,9}\/\S+$/i.test(normalizeDoi(doi));
}

function estimateTier(citationCount: number): PaperTier {
  if (citationCount >= 300) return 'Q1';
  if (citationCount >= 100) return 'Q2';
  if (citationCount >= 30) return 'Q3';
  return 'Q4';
}

function buildFallbackBilingualAbstract(topic: string, title: string, source: string): { zh: string; en: string } {
  const zh = `该文献来自 ${source}，主题与“${topic}”相关，题为《${title}》。当前源数据未提供完整摘要。`;
  const en = `This paper was retrieved from ${source} and is related to "${topic}" with title "${title}". The source did not provide a complete abstract.`;
  return { zh, en };
}

function deriveTags(topic: string, title: string): string[] {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((item) => item.length >= 4)
    .slice(0, 4);

  return Array.from(new Set([topic.trim(), ...words].filter(Boolean))).slice(0, 5);
}

function toCandidate(
  topic: string,
  source: string,
  input: {
    title: string;
    authors: string;
    year: number;
    journal: string;
    doi: string;
    sourceUrl?: string;
    fullTextUrl?: string;
    abstractEn?: string;
    abstractZh?: string;
    citationCount?: number;
    tags?: string[];
  },
): SearchCandidate | null {
  const title = normalizeWhitespace(input.title);
  if (!title) return null;

  const year = Number.isFinite(input.year) ? input.year : new Date().getFullYear();
  const citationCount = input.citationCount ?? 0;
  const normalizedDoi = isLikelyDoi(input.doi) ? normalizeDoi(input.doi) : 'N/A';
  const fallbackAbstract = buildFallbackBilingualAbstract(topic, title, source);

  const abstractEn = normalizeWhitespace(input.abstractEn || fallbackAbstract.en);
  const abstractZh = normalizeWhitespace(input.abstractZh || fallbackAbstract.zh);

  return {
    title,
    authors: normalizeWhitespace(input.authors || 'Unknown'),
    year,
    journal: normalizeWhitespace(input.journal || source),
    tier: estimateTier(citationCount),
    doi: normalizedDoi,
    sourceUrl: input.sourceUrl,
    fullTextUrl: input.fullTextUrl || (normalizedDoi !== 'N/A' ? `https://doi.org/${normalizedDoi}` : undefined),
    abstract: abstractZh,
    abstractZh,
    abstractEn,
    tags: (input.tags && input.tags.length > 0 ? input.tags : deriveTags(topic, title)).slice(0, 5),
    citationCount,
  };
}

export function buildSubQueries(topic: string): string[] {
  const seed = topic.trim();
  if (!seed) return [];

  const templates = [
    `${seed} systematic review`,
    `${seed} methodology benchmark`,
    `${seed} recent advances`,
    `${seed} applications challenges`,
    `${seed} limitations future work`,
  ];

  return templates.slice(0, 5);
}

async function searchSemanticScholar(topic: string, query: string, limit = 4): Promise<SearchCandidate[]> {
  const params = new URLSearchParams({
    query,
    limit: String(limit),
    fields: 'title,year,authors,journal,abstract,citationCount,externalIds,venue',
  });

  const apiKey = import.meta.env.VITE_SEMANTIC_SCHOLAR_API_KEY;
  const response = await fetch(`${SEMANTIC_SCHOLAR_API}?${params.toString()}`, {
    headers: apiKey ? { 'x-api-key': apiKey } : undefined,
  });
  if (!response.ok) return [];

  const payload = (await response.json()) as {
    data?: Array<{
      title?: string;
      year?: number;
      authors?: Array<{ name?: string }>;
      journal?: { name?: string };
      venue?: string;
      abstract?: string;
      citationCount?: number;
      url?: string;
      openAccessPdf?: { url?: string };
      externalIds?: { DOI?: string };
    }>;
  };

  return (payload.data ?? [])
    .map((item) => {
      const authors = (item.authors ?? [])
        .map((author) => author.name?.trim())
        .filter((name): name is string => Boolean(name))
        .slice(0, 4)
        .join('; ');
      const journal = item.journal?.name || item.venue || 'Semantic Scholar';

      return toCandidate(topic, 'Semantic Scholar', {
        title: item.title || '',
        authors,
        year: item.year || new Date().getFullYear(),
        journal,
        doi: item.externalIds?.DOI || 'N/A',
        sourceUrl: item.url,
        fullTextUrl: item.openAccessPdf?.url,
        abstractEn: item.abstract || '',
        citationCount: item.citationCount || 0,
      });
    })
    .filter((item): item is SearchCandidate => Boolean(item));
}

function extractArxivDoi(entry: Element): string {
  const doiNode =
    entry.getElementsByTagName('arxiv:doi')[0] ||
    entry.getElementsByTagNameNS('http://arxiv.org/schemas/atom', 'doi')[0];
  return doiNode?.textContent?.trim() || 'N/A';
}

function extractArxivPdfUrl(entry: Element): string | undefined {
  const links = Array.from(entry.getElementsByTagName('link'));
  const pdfLink = links.find((link) => link.getAttribute('title') === 'pdf');
  const href = pdfLink?.getAttribute('href');
  return href || undefined;
}

async function searchArxiv(topic: string, query: string, limit = 4): Promise<SearchCandidate[]> {
  const params = new URLSearchParams({
    search_query: `all:${query}`,
    start: '0',
    max_results: String(limit),
    sortBy: 'relevance',
    sortOrder: 'descending',
  });

  const response = await fetch(`${ARXIV_API}?${params.toString()}`);
  if (!response.ok) return [];

  const xmlText = await response.text();
  const xml = new DOMParser().parseFromString(xmlText, 'application/xml');
  const entries = Array.from(xml.getElementsByTagName('entry'));

  return entries
    .map((entry) => {
      const title = normalizeWhitespace(entry.getElementsByTagName('title')[0]?.textContent || '');
      const summary = normalizeWhitespace(entry.getElementsByTagName('summary')[0]?.textContent || '');
      const published = entry.getElementsByTagName('published')[0]?.textContent || '';
      const year = Number(published.slice(0, 4)) || new Date().getFullYear();
      const authors = Array.from(entry.getElementsByTagName('author'))
        .map((author) => normalizeWhitespace(author.getElementsByTagName('name')[0]?.textContent || ''))
        .filter(Boolean)
        .slice(0, 4)
        .join('; ');
      const doi = extractArxivDoi(entry);
      const sourceUrl = normalizeWhitespace(entry.getElementsByTagName('id')[0]?.textContent || '');
      const fullTextUrl = extractArxivPdfUrl(entry);

      return toCandidate(topic, 'arXiv', {
        title,
        authors,
        year,
        journal: 'arXiv',
        doi,
        sourceUrl: sourceUrl || undefined,
        fullTextUrl,
        abstractEn: summary,
        citationCount: 0,
      });
    })
    .filter((item): item is SearchCandidate => Boolean(item));
}

async function searchSerperScholar(topic: string, query: string, limit = 4): Promise<SearchCandidate[]> {
  const apiKey = import.meta.env.VITE_SERPER_API_KEY;
  if (!apiKey) return [];

  const response = await fetch(SERPER_SCHOLAR_API, {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, num: limit }),
  });
  if (!response.ok) return [];

  const payload = (await response.json()) as {
    organic?: Array<{
      title?: string;
      snippet?: string;
      publicationInfo?: { summary?: string };
      year?: number;
      inline_links?: { cited_by?: { total?: number } };
      link?: string;
    }>;
  };

  return (payload.organic ?? [])
    .map((item) => {
      const summary = item.publicationInfo?.summary || '';
      const yearMatch = summary.match(/\b(19|20)\d{2}\b/);
      const year = item.year || (yearMatch ? Number(yearMatch[0]) : new Date().getFullYear());
      const citationCount = item.inline_links?.cited_by?.total || 0;
      let sourceFromLink = 'Google Scholar';
      if (item.link) {
        try {
          sourceFromLink = new URL(item.link).hostname.replace(/^www\./, '');
        } catch {
          sourceFromLink = 'Google Scholar';
        }
      }

      return toCandidate(topic, 'Google Scholar (Serper)', {
        title: item.title || '',
        authors: summary || 'Unknown',
        year,
        journal: sourceFromLink,
        doi: 'N/A',
        sourceUrl: item.link,
        abstractEn: item.snippet || '',
        citationCount,
      });
    })
    .filter((item): item is SearchCandidate => Boolean(item));
}

function dedupeAndRank(candidates: SearchCandidate[]): SearchCandidate[] {
  const map = new Map<string, SearchCandidate>();

  for (const paper of candidates) {
    const key =
      paper.doi !== 'N/A'
        ? `doi:${normalizeDoi(paper.doi)}`
        : `title:${paper.title.toLowerCase()}:${paper.year}`;

    const existing = map.get(key);
    if (!existing || paper.citationCount > existing.citationCount) {
      map.set(key, paper);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.citationCount !== a.citationCount) return b.citationCount - a.citationCount;
    if (a.doi === 'N/A' && b.doi !== 'N/A') return 1;
    if (b.doi === 'N/A' && a.doi !== 'N/A') return -1;
    return b.year - a.year;
  });
}

export async function multiSourceSearch(topic: string): Promise<PaperDraft[]> {
  const subQueries = buildSubQueries(topic).slice(0, 5);
  if (subQueries.length === 0) return [];

  const tasks = subQueries.flatMap((query) => [
    searchSemanticScholar(topic, query, 4),
    searchArxiv(topic, query, 4),
    searchSerperScholar(topic, query, 4),
  ]);

  const settled = await Promise.allSettled(tasks);
  const merged = settled
    .filter((result): result is PromiseFulfilledResult<SearchCandidate[]> => result.status === 'fulfilled')
    .flatMap((result) => result.value);

  const ranked = dedupeAndRank(merged).slice(0, 8);

  return ranked.map(({ citationCount: _citationCount, ...paper }) => paper);
}
