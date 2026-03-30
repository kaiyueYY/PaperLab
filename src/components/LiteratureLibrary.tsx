import React, { useMemo, useState } from 'react';
import { Trash2, Upload, Search, BookOpen, ExternalLink, Download, Library, Loader2, X, Quote } from 'lucide-react';
import type { LibraryPaper, Paper } from '../types';
import { extractPaperMetadata } from '../services/geminiService';
import { normalizeError } from '../lib/appError';
import { createPaperId } from '../services/libraryService';
import { getFullTextUrl, getSourceUrl } from '../lib/paperLinks';
import { AnimatePresence, motion } from 'motion/react';

interface LiteratureLibraryProps {
  papers: LibraryPaper[];
  onRemovePaper: (id: string) => void;
  onAddPaper: (paper: Paper) => void;
}

type GroupBy = 'none' | 'source' | 'time' | 'tier';
type SortBy = 'saved_desc' | 'saved_asc' | 'year_desc' | 'title_asc';

function containsChinese(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text);
}

function getAbstractZh(paper: LibraryPaper): string {
  if (paper.abstractZh?.trim()) {
    return paper.abstractZh.trim();
  }
  return containsChinese(paper.abstract) ? paper.abstract : '暂无中文摘要';
}

function getAbstractEn(paper: LibraryPaper): string {
  if (paper.abstractEn?.trim()) {
    return paper.abstractEn.trim();
  }
  return containsChinese(paper.abstract) ? 'No English abstract available.' : paper.abstract;
}

function getSourceLabel(source: LibraryPaper['source']): string {
  return source === 'upload' ? '上传导入' : '综述检索';
}

function getTimeGroup(savedAt: string): string {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) {
    return '未知时间';
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatSavedAt(savedAt: string): string {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) {
    return '未知';
  }
  return date.toLocaleString();
}

function sortPapers(papers: LibraryPaper[], sortBy: SortBy): LibraryPaper[] {
  const sorted = [...papers];
  sorted.sort((a, b) => {
    if (sortBy === 'saved_desc') {
      return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
    }
    if (sortBy === 'saved_asc') {
      return new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime();
    }
    if (sortBy === 'year_desc') {
      return b.year - a.year;
    }
    return a.title.localeCompare(b.title, 'zh-Hans-CN');
  });
  return sorted;
}

export default function LiteratureLibrary({ papers, onRemovePaper, onAddPaper }: LiteratureLibraryProps) {
  const [query, setQuery] = useState('');
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [sortBy, setSortBy] = useState<SortBy>('saved_desc');
  const [selectedPaper, setSelectedPaper] = useState<LibraryPaper | null>(null);

  const groupedPapers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const filtered = keyword
      ? papers.filter((paper) => {
          return (
            paper.title.toLowerCase().includes(keyword) ||
            paper.authors.toLowerCase().includes(keyword) ||
            paper.journal.toLowerCase().includes(keyword) ||
            paper.tags.some((tag) => tag.toLowerCase().includes(keyword))
          );
        })
      : papers;

    const sorted = sortPapers(filtered, sortBy);
    if (groupBy === 'none') {
      return [{ key: 'all', label: `全部文献 (${sorted.length})`, papers: sorted }];
    }

    const buckets = new Map<string, LibraryPaper[]>();
    for (const paper of sorted) {
      let key = '';
      if (groupBy === 'source') {
        key = paper.source;
      } else if (groupBy === 'time') {
        key = getTimeGroup(paper.savedAt);
      } else {
        key = paper.tier;
      }
      const current = buckets.get(key) ?? [];
      current.push(paper);
      buckets.set(key, current);
    }

    const entries = Array.from(buckets.entries());
    entries.sort((a, b) => {
      if (groupBy === 'source') {
        return a[0].localeCompare(b[0]);
      }
      if (groupBy === 'time') {
        return b[0].localeCompare(a[0]);
      }
      const tierOrder = ['Q1', 'Q2', 'Q3', 'Q4'];
      return tierOrder.indexOf(a[0]) - tierOrder.indexOf(b[0]);
    });

    return entries.map(([key, list]) => {
      const label =
        groupBy === 'source'
          ? `${getSourceLabel(key as LibraryPaper['source'])} (${list.length})`
          : groupBy === 'time'
            ? `${key} 入库 (${list.length})`
            : `${key} 分区 (${list.length})`;
      return {
        key,
        label,
        papers: list,
      };
    });
  }, [papers, query, groupBy, sortBy]);

  const totalVisible = groupedPapers.reduce((count, group) => count + group.papers.length, 0);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingUpload(true);
    setError(null);

    try {
      let textContent = '';
      try {
        textContent = await file.text();
      } catch {
        textContent = `Uploaded file: ${file.name}`;
      }

      const metadata = await extractPaperMetadata(file.name, textContent || `Uploaded file: ${file.name}`);
      onAddPaper({ ...metadata, id: createPaperId('upload') });
    } catch (err) {
      const appError = normalizeError(err, '文献上传解析失败，请稍后重试。');
      setError(appError.userMessage);
    } finally {
      setLoadingUpload(false);
      e.target.value = '';
    }
  };

  return (
    <div className="custom-scrollbar h-full overflow-y-auto p-3 md:p-4">
      <div className="frost-panel mx-auto max-w-6xl p-4 md:p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="section-chip">
              <Library className="h-3 w-3" />
              Literature Library
            </p>
            <h2 className="mt-2 font-headline text-2xl font-bold text-slate-900">文献库</h2>
            <p className="mt-1 text-sm text-muted">集中管理上传文献和综述模块加入的核心文献，数据保存在本地浏览器。</p>
          </div>

          <label className="neo-button cursor-pointer">
            {loadingUpload ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            上传文献到文献库
            <input
              type="file"
              className="hidden"
              onChange={handleUpload}
              accept=".pdf,.doc,.docx,.txt,.md"
              disabled={loadingUpload}
            />
          </label>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="按标题 / 作者 / 期刊 / 关键词筛选"
              className="neo-input neo-input-icon"
            />
          </div>

          <select
            className="neo-input"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
          >
            <option value="none">不分组</option>
            <option value="source">按来源分组</option>
            <option value="time">按入库时间分组</option>
            <option value="tier">按分区分组</option>
          </select>

          <select
            className="neo-input"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
          >
            <option value="saved_desc">最近入库</option>
            <option value="saved_asc">最早入库</option>
            <option value="year_desc">发表年份新到旧</option>
            <option value="title_asc">标题 A-Z</option>
          </select>
        </div>

        <p className="mb-4 text-xs text-muted">当前显示 {totalVisible} 篇文献</p>

        {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

        {totalVisible === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-slate-50 px-6 py-12 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm text-muted">文献库还没有内容，先上传文献或从综述模块添加。</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedPapers.map((group) => (
              <section key={group.key}>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">{group.label}</h3>
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {group.papers.map((paper) => (
                    <article
                      key={paper.id}
                      className="cursor-pointer rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-secondary/30"
                      onClick={() => setSelectedPaper(paper)}
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <h3 className="line-clamp-2 font-headline text-lg font-bold text-slate-900">{paper.title}</h3>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{paper.tier}</span>
                      </div>
                      <p className="text-sm text-muted">
                        {paper.authors} · {paper.journal} ({paper.year})
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">来源：{getSourceLabel(paper.source)}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">入库：{formatSavedAt(paper.savedAt)}</span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {paper.tags.slice(0, 4).map((tag) => (
                          <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] text-muted">
                            #{tag}
                          </span>
                        ))}
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <a
                          href={getFullTextUrl(paper)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="neo-button-secondary justify-center"
                          title="优先通过 DOI 跳转，若无 DOI 将打开 PDF 检索"
                        >
                          <Download className="h-4 w-4" />
                          下载全文
                        </a>
                        <a
                          href={getSourceUrl(paper)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="neo-button-secondary justify-center"
                        >
                          <ExternalLink className="h-4 w-4" />
                          访问源站
                        </a>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            onRemovePaper(paper.id);
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                        >
                          <Trash2 className="h-4 w-4" />
                          删除
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedPaper && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="frost-panel max-h-[88vh] w-full max-w-3xl overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-border bg-white/65 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-headline text-lg font-bold text-slate-900">文献详情</h3>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Library Metadata</p>
                  </div>
                </div>
                <button onClick={() => setSelectedPaper(null)} className="rounded-full p-2 text-muted transition-colors hover:bg-slate-100 hover:text-primary">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="custom-scrollbar max-h-[70vh] space-y-6 overflow-y-auto px-6 py-6 md:px-8">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${selectedPaper.tier === 'Q1' ? 'bg-emerald-100 text-emerald-700' : selectedPaper.tier === 'Q2' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-700'}`}>
                      {selectedPaper.tier} 期刊
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{selectedPaper.journal}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{getSourceLabel(selectedPaper.source)}</span>
                  </div>
                  <h2 className="font-headline text-2xl font-bold text-slate-900">{selectedPaper.title}</h2>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
                    <div>
                      <span className="font-semibold text-slate-900">作者：</span>
                      {selectedPaper.authors}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900">年份：</span>
                      {selectedPaper.year}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900">入库时间：</span>
                      {formatSavedAt(selectedPaper.savedAt)}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900">DOI：</span>
                      <a href={`https://doi.org/${selectedPaper.doi}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-secondary hover:underline">
                        {selectedPaper.doi}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
                    <Quote className="h-3 w-3 text-secondary" />
                    Abstract / 摘要
                  </h4>
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm italic leading-relaxed text-slate-700">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">中文摘要</p>
                      {getAbstractZh(selectedPaper)}
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm italic leading-relaxed text-slate-700">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">English Abstract</p>
                      {getAbstractEn(selectedPaper)}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">Keywords / 关键词</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedPaper.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-border bg-white px-3 py-1 text-xs text-slate-600">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
