import React, { useEffect, useState } from 'react';
import { BookOpen, Settings, Bell, ChevronRight, Zap, Activity, Layers, Sparkles, Library } from 'lucide-react';
import LiteratureReview from './components/LiteratureReview';
import LiteratureLibrary from './components/LiteratureLibrary';
import { LibraryPaper, LibrarySource, Paper, ViewType } from './types';
import { motion, AnimatePresence } from 'motion/react';
import {
  getPaperSignature,
  loadLibraryPapers,
  persistLibraryPapers,
  removeLibraryPaper,
  upsertLibraryPaper,
} from './services/libraryService';

export default function App() {
  const [activeView, setActiveView] = useState<ViewType>('literature');
  const [libraryPapers, setLibraryPapers] = useState<LibraryPaper[]>(() => loadLibraryPapers());

  useEffect(() => {
    persistLibraryPapers(libraryPapers);
  }, [libraryPapers]);

  const handleAddPaperToLibrary = (paper: Paper, source: LibrarySource) => {
    setLibraryPapers((prev) => upsertLibraryPaper(prev, paper, source));
  };

  const handleRemovePaperFromLibrary = (id: string) => {
    setLibraryPapers((prev) => removeLibraryPaper(prev, id));
  };

  const isPaperInLibrary = (paper: Paper) => {
    const signature = getPaperSignature(paper);
    return libraryPapers.some((item) => getPaperSignature(item) === signature);
  };

  return (
    <div className="app-shell text-primary">
      <div className="relative z-10 flex h-full gap-3 md:gap-4">
        <aside className="frost-panel hidden w-72 shrink-0 p-4 lg:flex lg:flex-col">
          <div className="rounded-2xl border border-white/70 bg-gradient-to-br from-white to-slate-50 p-5">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-headline text-xl font-bold tracking-tight">PaperLab</h1>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Intelligence Studio</p>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-muted">面向研究者的科研工作台</p>
          </div>

          <div className="mt-6 flex-1 space-y-2">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Workspace</p>
            <button
              onClick={() => setActiveView('literature')}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                activeView === 'literature'
                  ? 'border-secondary/30 bg-secondary/10 shadow-sm'
                  : 'border-transparent bg-white/50 hover:border-border hover:bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <BookOpen className={`mt-0.5 h-5 w-5 ${activeView === 'literature' ? 'text-secondary' : 'text-muted'}`} />
                <div>
                  <p className="font-headline text-sm font-bold">文献综述</p>
                  <p className="text-[11px] text-muted">Deep Review Generator</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setActiveView('library')}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                activeView === 'library'
                  ? 'border-secondary/30 bg-secondary/10 shadow-sm'
                  : 'border-transparent bg-white/50 hover:border-border hover:bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <Library className={`mt-0.5 h-5 w-5 ${activeView === 'library' ? 'text-secondary' : 'text-muted'}`} />
                <div>
                  <p className="font-headline text-sm font-bold">文献库</p>
                  <p className="text-[11px] text-muted">Local Paper Manager</p>
                </div>
              </div>
            </button>

            <div className="rounded-2xl border border-dashed border-border bg-white/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-muted">
                <Layers className="h-4 w-4" />
                <p className="text-[11px] font-semibold uppercase tracking-wider">Upcoming Modules</p>
              </div>
              <p className="text-xs text-muted">Knowledge Graph, Method Benchmark, Citation QA</p>
            </div>
          </div>

          <div className="space-y-3 pt-3">
            <div className="rounded-2xl border border-border/80 bg-white/70 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-secondary" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary">System</p>
              </div>
              <p className="text-xs text-muted">Research Engine v5.1 running stable</p>
            </div>
            <button className="neo-button-secondary w-full justify-start">
              <Settings className="h-4 w-4" />
              Settings
            </button>
          </div>
        </aside>

        <section className="frost-panel flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="border-b border-white/70 bg-white/55 px-4 py-3 md:px-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="section-chip">
                  <Sparkles className="h-3 w-3" />
                  Research Session
                </div>
                <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                  <span>PaperLab</span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="text-secondary">{activeView === 'literature' ? 'Literature Review' : 'Literature Library'}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button className="relative rounded-xl border border-border bg-white/80 p-2 text-muted transition-colors hover:text-primary">
                  <Bell className="h-4 w-4" />
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
                </button>
                <div className="hidden items-center gap-3 rounded-xl border border-border bg-white/80 px-3 py-2 sm:flex">
                  <div className="h-8 w-8 overflow-hidden rounded-full border border-border">
                    <img src="https://picsum.photos/seed/researcher/100/100" alt="Avatar" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold">Research Lead</p>
                    <p className="text-[10px] text-muted">Online</p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="h-full"
              >
                {activeView === 'literature' ? (
                  <LiteratureReview
                    onOpenLibrary={() => setActiveView('library')}
                    onSavePaper={(paper) => handleAddPaperToLibrary(paper, 'search')}
                    onSaveAllPapers={(papers) => {
                      setLibraryPapers((prev) =>
                        papers.reduce((next, paper) => upsertLibraryPaper(next, paper, 'search'), prev),
                      );
                    }}
                    isPaperSaved={isPaperInLibrary}
                  />
                ) : (
                  <LiteratureLibrary
                    papers={libraryPapers}
                    onRemovePaper={handleRemovePaperFromLibrary}
                    onAddPaper={(paper) => handleAddPaperToLibrary(paper, 'upload')}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </section>
      </div>
    </div>
  );
}
