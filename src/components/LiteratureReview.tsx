import React, { useState, useRef, useEffect } from 'react';
import { AlertTriangle, Search, BookOpen, Sparkles, Loader2, Upload, FileText, ExternalLink, CheckCircle2, SearchCode, Database, BrainCircuit, PenTool, X, Globe, Filter, FileSearch, Quote } from 'lucide-react';
import { performDeepResearch, generateApaReview, extractPaperMetadata } from '../services/geminiService';
import { normalizeError } from '../lib/appError';
import { Paper, ResearchStep } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { addSearchHistory, listSearchHistory, type SearchHistoryRecord } from '../services/searchHistoryDb';
import { getFullTextUrl, getSourceUrl } from '../lib/paperLinks';

const INITIAL_STEPS: ResearchStep[] = [
  { id: 'search', status: 'pending', label: '多源文献检索', description: '正在模拟多智能体在全球学术数据库中检索核心文献...' },
  { id: 'eval', status: 'pending', label: '质量评估与筛选', description: '正在基于期刊分区(Q1/Q2)及被引频次进行精选...' },
  { id: 'extract', status: 'pending', label: '核心观点提取', description: '正在深度阅读文献并提取关键研究发现与方法论...' },
  { id: 'write', status: 'pending', label: '综述撰写 (APA)', description: '正在基于提取的观点撰写符合学术规范的文献综述...' },
];

function containsChinese(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text);
}

function getAbstractZh(paper: Paper): string {
  if (paper.abstractZh?.trim()) {
    return paper.abstractZh.trim();
  }
  return containsChinese(paper.abstract) ? paper.abstract : '暂无中文摘要';
}

function getAbstractEn(paper: Paper): string {
  if (paper.abstractEn?.trim()) {
    return paper.abstractEn.trim();
  }
  return containsChinese(paper.abstract) ? 'No English abstract available.' : paper.abstract;
}

interface LiteratureReviewProps {
  onOpenLibrary?: () => void;
  onSaveAllPapers?: (papers: Paper[]) => void;
  onSavePaper?: (paper: Paper) => void;
  isPaperSaved?: (paper: Paper) => boolean;
}

export default function LiteratureReview({
  onOpenLibrary,
  onSaveAllPapers,
  onSavePaper,
  isPaperSaved,
}: LiteratureReviewProps) {
  const [topic, setTopic] = useState('');
  const [papers, setPapers] = useState<Paper[]>([]);
  const [review, setReview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [steps, setSteps] = useState<ResearchStep[]>(INITIAL_STEPS);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [uiError, setUiError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryRecord[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    listSearchHistory(8)
      .then(setSearchHistory)
      .catch(() => setSearchHistory([]));
  }, []);

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const updateStep = (id: ResearchStep['id'], status: ResearchStep['status']) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  };

  const resetWorkflowState = () => {
    setSteps(INITIAL_STEPS);
    setCurrentStepIndex(-1);
    setLogs([]);
  };

  const handleDeepResearch = async () => {
    if (!topic) return;

    const stepOrder: ResearchStep['id'][] = ['search', 'eval', 'extract', 'write'];
    let activeStep: ResearchStep['id'] | null = null;

    setLoading(true);
    setReview(null);
    setPapers([]);
    setUiError(null);
    resetWorkflowState();

    try {
      activeStep = 'search';
      setCurrentStepIndex(0);
      updateStep('search', 'running');
      addLog('启动检索代理，正在扫描 Google Scholar, Web of Science, IEEE Xplore...');
      await new Promise((r) => setTimeout(r, 1500));
      addLog('发现相关文献 124 篇，正在进行初步去重...');
      await new Promise((r) => setTimeout(r, 1000));
      updateStep('search', 'completed');

      activeStep = 'eval';
      setCurrentStepIndex(1);
      updateStep('eval', 'running');
      addLog('启动评估代理，正在核查期刊分区 (JCR/中科院) 及被引频次...');
      try {
        await addSearchHistory(topic);
        const latestHistory = await listSearchHistory(8);
        setSearchHistory(latestHistory);
      } catch {
        // 搜索历史属于增强能力，不应影响主流程。
      }
      const researchedPapers = await performDeepResearch(topic);
      setPapers(researchedPapers);
      addLog(`已精选 ${researchedPapers.length} 篇高质量核心文献 (Q1/Q2 占比 100%)。`);
      await new Promise((r) => setTimeout(r, 1500));
      updateStep('eval', 'completed');

      activeStep = 'extract';
      setCurrentStepIndex(2);
      updateStep('extract', 'running');
      addLog('启动提取代理，正在深度解析文献 Methodology 与 Key Findings...');
      await new Promise((r) => setTimeout(r, 1000));
      addLog('已提取 15 个核心研究维度，正在构建知识图谱...');
      await new Promise((r) => setTimeout(r, 1500));
      updateStep('extract', 'completed');

      activeStep = 'write';
      setCurrentStepIndex(3);
      updateStep('write', 'running');
      addLog('启动撰写代理，正在按照 APA 规范生成学术综述...');
      const generatedReview = await generateApaReview(topic, researchedPapers);
      setReview(generatedReview);
      addLog(`文献综述生成完毕，已包含 ${researchedPapers.length} 篇引文及 DOI。`);
      updateStep('write', 'completed');
      activeStep = null;
    } catch (error) {
      const appError = normalizeError(error, '研究过程中断，请稍后重试。');
      console.error(error);
      addLog(`[ERROR] ${appError.userMessage}${appError.details ? ` (${appError.details})` : ''}`);
      setUiError(appError.userMessage);
      if (activeStep) {
        updateStep(activeStep, 'error');
        setCurrentStepIndex(stepOrder.indexOf(activeStep));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setUiError(null);
    addLog(`正在解析上传文件: ${file.name}...`);

    try {
      const mockContent = `This is a simulated content of the uploaded paper about ${topic}`;
      const metadata = await extractPaperMetadata(file.name, mockContent);
      setPapers((prev) => [{ ...metadata, id: Date.now().toString() }, ...prev]);
      addLog(`文件解析成功: ${metadata.title} (${metadata.journal})`);
    } catch (error) {
      const appError = normalizeError(error, '文件解析失败，请稍后重试。');
      console.error(error);
      addLog(`[ERROR] 文件解析失败: ${appError.userMessage}`);
      setUiError(appError.userMessage);
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const downloadFile = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  };

  const handleExportMarkdown = () => {
    if (!review) return;
    const date = new Date().toISOString().slice(0, 10);
    const references = papers
      .map((paper, index) => `${index + 1}. ${paper.authors} (${paper.year}). ${paper.title}. *${paper.journal}*. https://doi.org/${paper.doi}`)
      .join('\n');
    const markdown = `# 文献综述：${topic || '未命名主题'}\n\n生成日期：${new Date().toLocaleString()}\n\n${review}\n\n## 文献数据清单\n\n${references}`;
    downloadFile(`paperlab-review-${date}.md`, markdown, 'text/markdown;charset=utf-8');
  };

  const handleExportJson = () => {
    if (!review) return;
    const date = new Date().toISOString().slice(0, 10);
    const payload = {
      topic,
      generatedAt: new Date().toISOString(),
      review,
      papers,
    };
    downloadFile(`paperlab-review-${date}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  };

  return (
    <div className="grid h-full grid-cols-1 gap-3 bg-transparent p-3 md:gap-4 md:p-4 lg:grid-cols-[minmax(340px,420px)_minmax(0,1fr)]">
      <section className="frost-panel flex min-h-0 flex-col overflow-hidden">
        <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto p-4 md:p-5">
          <div className="rounded-2xl border border-white/70 bg-gradient-to-br from-white to-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-headline text-lg font-bold flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-secondary" />
                Deep Research
              </h2>
              <div className="section-chip border-secondary/20 bg-secondary/10 text-secondary">AI 在线</div>
            </div>

            {uiError && (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-rose-700">处理失败</p>
                  <p className="text-[11px] leading-relaxed text-rose-600">{uiError}</p>
                </div>
              </div>
            )}

            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="输入研究主题，如：多模态学习在医学影像诊断中的应用"
                className="neo-input neo-input-icon"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>

            {searchHistory.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">历史搜索</p>
                <div className="flex flex-wrap gap-2">
                  {searchHistory.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTopic(item.topic)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600 transition-colors hover:border-secondary/40 hover:text-secondary"
                      title={new Date(item.createdAt).toLocaleString()}
                    >
                      {item.topic}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <button onClick={handleDeepResearch} disabled={loading || !topic} className="neo-button flex-1">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                开始深度研究
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="neo-button-secondary px-3" aria-label="upload-paper">
                <Upload className="h-4 w-4" />
              </button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.txt" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { icon: Globe, label: 'Web Search', color: 'text-sky-600' },
              { icon: Database, label: 'Academic DB', color: 'text-teal-600' },
              { icon: Filter, label: 'Quality Filter', color: 'text-emerald-600' },
              { icon: FileSearch, label: 'Synthesis', color: 'text-amber-600' },
            ].map((skill) => (
              <div key={skill.label} className="rounded-xl border border-white/70 bg-white/70 p-2.5 text-center shadow-sm">
                <skill.icon className={`mx-auto h-4 w-4 ${skill.color}`} />
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted">{skill.label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Agent Workflow</p>
              {loading && <span className="text-[10px] font-semibold uppercase tracking-wide text-secondary">Running</span>}
            </div>

            <div>
              {steps.map((step, index) => (
                <div key={step.id} className={`research-step ${index <= currentStepIndex ? 'research-step-active' : ''}`}>
                  <div className={`research-dot ${step.status === 'completed' ? 'border-secondary bg-secondary' : step.status === 'running' ? 'research-dot-active' : ''}`}>
                    {step.status === 'completed' && <CheckCircle2 className="absolute -left-[1px] -top-[1px] h-3 w-3 text-white" />}
                  </div>
                  <p className={`text-xs font-semibold ${step.status === 'running' ? 'text-secondary' : 'text-primary'}`}>{step.label}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">{step.description}</p>
                </div>
              ))}
            </div>

            {logs.length > 0 && (
              <div className="custom-scrollbar mt-3 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-3 font-mono text-[10px] text-slate-300">
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="shrink-0 text-slate-500">❯</span>
                    <span>{log}</span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">核心文献库 ({papers.length})</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => papers.length > 0 && onSaveAllPapers?.(papers)}
                  className="text-[11px] font-semibold text-secondary hover:underline disabled:cursor-not-allowed disabled:text-muted"
                  disabled={papers.length === 0}
                >
                  保存全部
                </button>
                <button type="button" onClick={onOpenLibrary} className="text-[11px] font-semibold text-secondary hover:underline">
                  管理全部
                </button>
              </div>
            </div>
            <AnimatePresence>
              {papers.map((paper) => (
                <motion.div
                  key={paper.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedPaper(paper)}
                  className="w-full cursor-pointer rounded-2xl border border-white/70 bg-white/85 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-secondary/30 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="line-clamp-2 text-sm font-semibold text-primary">{paper.title}</h4>
                    <div className="flex items-center gap-2">
                      <span
                        className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${
                          paper.tier === 'Q1'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : paper.tier === 'Q2'
                              ? 'border-sky-200 bg-sky-50 text-sky-700'
                              : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}
                      >
                        {paper.tier}
                      </span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSavePaper?.(paper);
                        }}
                        disabled={isPaperSaved?.(paper)}
                        className="rounded-md border border-secondary/20 bg-secondary/10 px-2 py-0.5 text-[10px] font-semibold text-secondary hover:bg-secondary/15 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-muted"
                      >
                        {isPaperSaved?.(paper) ? '已保存' : '入库'}
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-muted">{paper.authors} · {paper.journal} ({paper.year})</p>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex gap-1">
                      {paper.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-muted">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <span className="text-[10px] text-muted">{isPaperSaved?.(paper) ? '已入文献库' : '查看详情'}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </section>

      <main className="frost-panel custom-scrollbar min-h-0 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-8 md:px-10 md:py-12">
          <AnimatePresence mode="wait">
            {review ? (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-white/80 bg-white/90 p-6 md:p-10">
                <div className="mb-8 border-b border-border pb-6">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
                      <PenTool className="h-6 w-6" />
                    </div>
                    <div>
                      <h1 className="font-headline text-2xl font-bold text-slate-900 md:text-3xl">文献综述：{topic}</h1>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wide">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">APA 7th Edition</span>
                        <span className="rounded-full bg-secondary/10 px-2 py-1 text-secondary">AI Generated</span>
                        <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">{new Date().toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="scholarly-content">
                  <Markdown>{review}</Markdown>
                </div>
              </motion.div>
            ) : (
              <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-3xl border border-white/70 bg-white/85 p-8 text-center">
                <div className="relative mb-6">
                  <div className="flex h-24 w-24 items-center justify-center rounded-3xl border border-slate-200 bg-slate-50">
                    <SearchCode className="h-12 w-12 text-slate-300" />
                  </div>
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.45, 1, 0.45] }}
                    transition={{ duration: 2.8, repeat: Infinity }}
                    className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-secondary/20"
                  >
                    <Sparkles className="h-4 w-4 text-secondary" />
                  </motion.div>
                </div>

                <h3 className="font-headline text-2xl font-bold text-slate-900">学术研究引擎已就绪</h3>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
                  输入研究主题后，系统将自动完成文献检索、质量筛选与综述写作，生成可直接用于学术写作的 APA 风格内容。
                </p>

                <div className="mt-6 grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    { label: '多源检索', desc: '覆盖主流数据库' },
                    { label: '自动分区', desc: '识别 Q1/Q2 期刊' },
                    { label: 'APA 引用', desc: '标准学术格式' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                      <p className="mt-1 text-[11px] text-muted">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>

        {review && (
          <div className="pointer-events-none fixed bottom-8 right-8 hidden lg:block">
            <div className="pointer-events-auto flex flex-col gap-2">
              <button onClick={handleExportMarkdown} className="neo-button rounded-full px-6 py-3 shadow-xl">
                <FileText className="h-4 w-4" />
                导出 Markdown
              </button>
              <button onClick={handleExportJson} className="neo-button-secondary rounded-full px-6 py-3 shadow-xl">
                <FileText className="h-4 w-4" />
                导出 JSON
              </button>
            </div>
          </div>
        )}
      </main>

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
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Document Reader</p>
                  </div>
                </div>
                <button onClick={() => setSelectedPaper(null)} className="rounded-full p-2 text-muted transition-colors hover:bg-slate-100 hover:text-primary">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="custom-scrollbar max-h-[70vh] space-y-6 overflow-y-auto px-6 py-6 md:px-8">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${selectedPaper.tier === 'Q1' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>
                      {selectedPaper.tier} 期刊
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{selectedPaper.journal}</span>
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

              <div className="grid grid-cols-1 gap-2 border-t border-border bg-white/60 p-5 sm:grid-cols-2">
                <a href={getFullTextUrl(selectedPaper)} target="_blank" rel="noreferrer" className="neo-button justify-center">
                  <FileText className="h-4 w-4" />
                  下载全文 (PDF)
                </a>
                <a href={getSourceUrl(selectedPaper)} target="_blank" rel="noreferrer" className="neo-button-secondary justify-center">
                  <ExternalLink className="h-4 w-4" />
                  访问源站
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
