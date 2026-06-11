import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Code2, Play, Terminal, Lightbulb, RotateCcw, CheckCircle2, XCircle, Cpu,
  Sparkles, Search, ExternalLink, Loader2, Star, Tag, ChevronLeft,
} from 'lucide-react';
import { clsx } from 'clsx';
import api from '../api/client';
import { useAuthStore } from '../store/authStore';

interface Language { id: string; label: string; ext: string }
interface CatalogItem { slug: string; title: string; difficulty: string; frontendId?: number; acRate?: number; topic?: string; featured?: boolean }
interface ProblemDetail {
  slug: string; title: string; difficulty: string; topic: string;
  prompt: string; promptIsHtml?: boolean; hints: string[];
  examples?: { input: string; output: string; explanation?: string }[];
  starter: Record<string, string>; url: string | null; featured?: boolean;
}
interface TopicTag { slug: string; label: string }

const DIFFS = ['All', 'Easy', 'Medium', 'Hard'];
const DIFF_BADGE: Record<string, string> = { Easy: 'badge-green', Medium: 'badge-yellow', Hard: 'badge-red' };
const DIFF_DOT: Record<string, string> = { Easy: 'bg-green-400', Medium: 'bg-yellow-400', Hard: 'bg-red-400' };

function runJsInBrowser(source: string): { output: string; code: number } {
  const logs: string[] = [];
  const fmt = (x: unknown) => (typeof x === 'object' && x !== null ? JSON.stringify(x) : String(x));
  const sandbox = { log: (...a: unknown[]) => logs.push(a.map(fmt).join(' ')) };
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('console', source);
    fn(sandbox);
    return { output: logs.join('\n') || '(no output)', code: 0 };
  } catch (e) {
    return { output: `${logs.join('\n')}${logs.length ? '\n' : ''}${e}`, code: 1 };
  }
}

function CodeEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const lineCount = useMemo(() => value.split('\n').length, [value]);
  const onScroll = () => { if (gutterRef.current && taRef.current) gutterRef.current.scrollTop = taRef.current.scrollTop; };
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const s = ta.selectionStart, en = ta.selectionEnd;
      onChange(value.slice(0, s) + '  ' + value.slice(en));
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 2; });
    }
  };
  return (
    <div className="relative flex font-mono text-[13px] leading-[1.55] bg-gray-950 rounded-b-xl overflow-hidden" style={{ height: 380 }}>
      <div ref={gutterRef} aria-hidden className="select-none overflow-hidden text-right text-gray-600 bg-gray-900/60 py-3 px-2.5 border-r border-gray-800">
        {Array.from({ length: lineCount }, (_, i) => <div key={i}>{i + 1}</div>)}
      </div>
      <textarea
        ref={taRef} value={value} onChange={e => onChange(e.target.value)} onScroll={onScroll} onKeyDown={onKeyDown}
        spellCheck={false} autoCapitalize="off" autoCorrect="off"
        className="flex-1 resize-none bg-transparent text-gray-100 caret-brand-400 py-3 px-3 outline-none whitespace-pre overflow-auto"
      />
    </div>
  );
}

export default function PracticePage() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [difficulty, setDifficulty] = useState('All');
  const [topic, setTopic] = useState('');
  const [showTopics, setShowTopics] = useState(false);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [featured, setFeatured] = useState<CatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [language, setLanguage] = useState('python');
  const [codeMap, setCodeMap] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ output: string; code: number; provider?: string } | null>(null);
  const [showHints, setShowHints] = useState(false);
  const [solved, setSolved] = useState<Record<string, boolean>>({});

  // Fetch topics list
  const { data: topicsData } = useQuery<{ topics: TopicTag[] }>({
    queryKey: ['practice-topics'],
    queryFn: () => api.get('/practice/topics').then(r => r.data),
    staleTime: Infinity,
  });
  const topics = topicsData?.topics ?? [];

  // Debounce search input
  useEffect(() => { const t = setTimeout(() => setDebounced(search), 350); return () => clearTimeout(t); }, [search]);

  // Fetch catalog (reset on search/difficulty/topic change, append on page change)
  const fetchList = useCallback(async (pg: number, reset: boolean) => {
    setLoadingList(true);
    try {
      const r = await api.get('/practice/problems', {
        params: {
          q: debounced || undefined,
          difficulty: difficulty === 'All' ? undefined : difficulty,
          topic: topic || undefined,
          page: pg,
          limit: 50,
        },
      });
      const d = r.data;
      setLanguages(d.languages || []);
      setTotal(d.total || 0);
      setHasMore(!!d.hasMore);
      if (pg === 1) setFeatured(d.featured || []);
      setItems(prev => (reset ? d.problems : [...prev, ...d.problems]));
    } finally {
      setLoadingList(false);
    }
  }, [debounced, difficulty, topic]);

  useEffect(() => { setPage(1); fetchList(1, true); }, [debounced, difficulty, topic, fetchList]);

  // Default selection
  useEffect(() => {
    if (!selectedSlug && (featured[0] || items[0])) setSelectedSlug((featured[0] || items[0]).slug);
  }, [featured, items, selectedSlug]);

  const { data: detail, isFetching: detailLoading } = useQuery<ProblemDetail>({
    queryKey: ['practice-problem', selectedSlug],
    queryFn: () => api.get(`/practice/problem/${selectedSlug}`).then(r => r.data),
    enabled: !!selectedSlug,
    staleTime: 60 * 60 * 1000,
  });

  const codeKey = `${selectedSlug}:${language}`;
  const starterCode = detail?.starter?.[language] ?? '';
  const code = codeMap[codeKey] ?? starterCode;
  const setCode = useCallback((v: string) => setCodeMap(m => ({ ...m, [codeKey]: v })), [codeKey]);
  const resetCode = useCallback(() => { setCodeMap(m => ({ ...m, [codeKey]: starterCode })); setResult(null); }, [codeKey, starterCode]);

  const run = useCallback(async () => {
    setRunning(true); setResult(null);
    if (language === 'javascript') {
      const r = runJsInBrowser(code);
      setResult({ ...r, provider: 'browser' });
      if (r.code === 0 && selectedSlug) setSolved(s => ({ ...s, [selectedSlug]: true }));
      setRunning(false);
      return;
    }
    try {
      const token = useAuthStore.getState().token;
      const resp = await fetch('/api/practice/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ language, source: code }),
      });
      const d = await resp.json();
      if (!resp.ok) setResult({ output: `⚠️ ${d.error || 'Runner unavailable'}${d.hint ? `\n\n${d.hint}` : ''}`, code: 1 });
      else { setResult({ output: d.output, code: d.code, provider: d.provider }); if (d.code === 0 && selectedSlug) setSolved(s => ({ ...s, [selectedSlug]: true })); }
    } catch {
      setResult({ output: '⚠️ Could not reach the code runner.', code: 1 });
    } finally { setRunning(false); }
  }, [language, code, selectedSlug]);

  const solvedCount = Object.values(solved).filter(Boolean).length;
  const cleanHtml = useMemo(
    () => (detail?.prompt || '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, ''),
    [detail?.prompt]
  );

  function ProblemRow({ p }: { p: CatalogItem }) {
    const active = p.slug === selectedSlug;
    return (
      <button
        onClick={() => { setSelectedSlug(p.slug); setResult(null); setShowHints(false); }}
        className={clsx('w-full text-left px-2.5 py-2 rounded-lg transition-colors flex items-center gap-2 group',
          active ? 'bg-brand-50 dark:bg-brand-950/40 ring-1 ring-brand-200 dark:ring-brand-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800/60')}
      >
        {solved[p.slug]
          ? <CheckCircle2 size={14} className="text-green-500 shrink-0" />
          : <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', DIFF_DOT[p.difficulty] || 'bg-gray-400')} />}
        {p.frontendId ? <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums shrink-0 w-7">{p.frontendId}</span> : null}
        <span className={clsx('text-[13px] truncate flex-1', active ? 'font-semibold text-brand-700 dark:text-brand-300' : 'text-gray-700 dark:text-gray-300')}>{p.title}</span>
        {p.featured && <Star size={11} className="text-amber-400 shrink-0" />}
        {typeof p.acRate === 'number' && p.acRate > 0 && <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">{p.acRate}%</span>}
      </button>
    );
  }

  const activeTopic = topics.find(t => t.slug === topic);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-5 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 flex items-center gap-2">
            <Code2 size={24} className="text-brand-500" /> Practice
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            {activeTopic
              ? <>{total ? total.toLocaleString() : '…'} <span className="text-brand-500 font-medium">{activeTopic.label}</span> problems on LeetCode</>
              : <>{total ? total.toLocaleString() : '1,800+'} real LeetCode problems · live multi-language IDE · built for interview prep.</>}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="badge badge-purple flex items-center gap-1"><Sparkles size={12} /> {total ? total.toLocaleString() : '…'} problems</span>
          <span className="badge badge-green flex items-center gap-1"><CheckCircle2 size={12} /> {solvedCount} run clean</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-4">
        {/* Catalog */}
        <div className="card p-3 h-fit lg:sticky lg:top-4 flex flex-col" style={{ maxHeight: 'calc(100vh - 7rem)' }}>

          {/* Topics browser toggle */}
          {showTopics ? (
            <div className="flex flex-col min-h-0">
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => setShowTopics(false)}
                  className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                >
                  <ChevronLeft size={14} /> Back
                </button>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                  <Tag size={13} className="text-brand-500" /> Browse by Topic
                </span>
              </div>
              <div className="overflow-y-auto -mx-1 px-1">
                <div className="flex flex-wrap gap-1.5 pb-2">
                  {topics.map(t => (
                    <button
                      key={t.slug}
                      onClick={() => { setTopic(t.slug); setShowTopics(false); setPage(1); setSelectedSlug(null); }}
                      className={clsx(
                        'text-xs px-2.5 py-1 rounded-full font-medium border transition-colors',
                        topic === t.slug
                          ? 'bg-brand-600 text-white border-brand-600 dark:bg-brand-500 dark:border-brand-500'
                          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-brand-400 dark:hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-300'
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="relative mb-2">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search problems…"
                  className="input pl-8 h-9 text-sm"
                />
              </div>
              <div className="flex gap-1 mb-2">
                {DIFFS.map(d => (
                  <button key={d} onClick={() => setDifficulty(d)}
                    className={clsx('flex-1 text-xs py-1 rounded-md font-medium transition-colors',
                      difficulty === d ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800')}>
                    {d}
                  </button>
                ))}
              </div>

              {/* Active topic pill + Browse Topics button */}
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                {activeTopic && (
                  <span className="flex items-center gap-1 text-xs bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 rounded-full px-2.5 py-0.5 font-medium">
                    <Tag size={10} /> {activeTopic.label}
                    <button onClick={() => { setTopic(''); setPage(1); }} className="ml-1 text-brand-400 hover:text-brand-600 dark:hover:text-brand-200 font-bold leading-none">&times;</button>
                  </span>
                )}
                <button
                  onClick={() => setShowTopics(true)}
                  className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors border border-dashed border-gray-300 dark:border-gray-700 rounded-full px-2.5 py-0.5"
                >
                  <Tag size={10} /> {activeTopic ? 'Change topic' : 'Browse topics'}
                </button>
              </div>

              <div className="overflow-y-auto -mx-1 px-1 space-y-0.5">
                {featured.length > 0 && difficulty === 'All' && !debounced && !topic && (
                  <>
                    <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide px-2 pt-1.5 pb-1 flex items-center gap-1"><Star size={10} /> Featured · instant-run</p>
                    {featured.map(p => <ProblemRow key={`f-${p.slug}`} p={{ ...p, featured: true }} />)}
                    <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide px-2 pt-2 pb-1">All problems</p>
                  </>
                )}
                {activeTopic && !debounced && items.length > 0 && (
                  <p className="text-[10px] font-semibold text-brand-500 uppercase tracking-wide px-2 pt-1.5 pb-1 flex items-center gap-1">
                    <Tag size={10} /> {activeTopic.label} · {total.toLocaleString()} problems
                  </p>
                )}
                {items.map(p => <ProblemRow key={p.slug} p={p} />)}
                {loadingList && <div className="py-4 text-center"><Loader2 size={16} className="animate-spin text-gray-400 mx-auto" /></div>}
                {!loadingList && items.length === 0 && (
                  <div className="py-8 text-center">
                    <p className="text-sm text-gray-400">
                      {activeTopic ? `No ${activeTopic.label} problems found` : 'No problems found'}{difficulty !== 'All' ? ` at ${difficulty}` : ''}.
                    </p>
                    {activeTopic && (
                      <button onClick={() => { setTopic(''); setPage(1); }} className="mt-2 text-xs text-brand-600 dark:text-brand-400 hover:underline">
                        Clear topic filter
                      </button>
                    )}
                  </div>
                )}
                {hasMore && !loadingList && (
                  <button onClick={() => { const n = page + 1; setPage(n); fetchList(n, false); }}
                    className="w-full text-xs text-brand-600 dark:text-brand-400 hover:underline py-2">Load more ↓</button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Detail + editor */}
        <div className="space-y-4 min-w-0">
          <div className="card p-5">
            {detailLoading && !detail ? (
              <div className="py-10 flex items-center justify-center text-gray-400"><Loader2 size={20} className="animate-spin mr-2" /> Loading problem…</div>
            ) : detail ? (
              <>
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50">{detail.title}</h2>
                  <span className={DIFF_BADGE[detail.difficulty] || 'badge-gray'}>{detail.difficulty}</span>
                  {detail.topic && <span className="badge badge-gray">{detail.topic}</span>}
                  {detail.url && (
                    <a href={detail.url} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
                      LeetCode <ExternalLink size={11} />
                    </a>
                  )}
                </div>

                {detail.promptIsHtml ? (
                  <div className="lc-content text-sm text-gray-700 dark:text-gray-300" dangerouslySetInnerHTML={{ __html: cleanHtml }} />
                ) : (
                  <>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{detail.prompt}</p>
                    <div className="mt-4 space-y-2">
                      {(detail.examples || []).map((ex, i) => (
                        <div key={i} className="rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 px-3 py-2 text-[13px] font-mono">
                          <div className="text-gray-500 dark:text-gray-400">Input: <span className="text-gray-800 dark:text-gray-200">{ex.input}</span></div>
                          <div className="text-gray-500 dark:text-gray-400">Output: <span className="text-gray-800 dark:text-gray-200">{ex.output}</span></div>
                          {ex.explanation && <div className="text-gray-400 dark:text-gray-500 mt-0.5 font-sans text-xs">{ex.explanation}</div>}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {detail.hints?.length > 0 && (
                  <>
                    <button onClick={() => setShowHints(s => !s)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline">
                      <Lightbulb size={13} /> {showHints ? 'Hide hints' : `Show hints (${detail.hints.length})`}
                    </button>
                    {showHints && (
                      <ul className="mt-2 space-y-1 animate-fade-in">
                        {detail.hints.map((h, i) => (
                          <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex gap-2"><span className="text-amber-500">{i + 1}.</span> <span dangerouslySetInnerHTML={{ __html: h }} /></li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400 py-8 text-center">Select a problem to begin.</p>
            )}
          </div>

          {/* Editor */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60">
              <div className="flex items-center gap-1">
                {languages.map(l => (
                  <button key={l.id} onClick={() => { setLanguage(l.id); setResult(null); }}
                    className={clsx('text-xs px-2.5 py-1 rounded-md font-medium transition-colors',
                      language === l.id ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800')}>
                    {l.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={resetCode} title="Reset to starter code" className="btn-ghost !px-2 !py-1 text-xs"><RotateCcw size={13} /> Reset</button>
                <button onClick={run} disabled={running} className="btn-primary !py-1.5 !px-3 text-xs">
                  {running ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Play size={13} />}
                  Run
                </button>
              </div>
            </div>
            <CodeEditor value={code} onChange={setCode} />
            <div className="px-3 py-1.5 text-[11px] text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40">
              💡 LeetCode starters are method stubs — add a call (e.g. <code className="text-gray-500">print(Solution().method(...))</code>) and hit Run to see output.
            </div>
          </div>

          {/* Output */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1.5"><Terminal size={13} /> Output</span>
              {result && (
                <span className={clsx('text-xs flex items-center gap-1', result.code === 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                  {result.code === 0 ? <CheckCircle2 size={12} /> : <XCircle size={12} />} exit {result.code}
                  {result.provider && <span className="text-gray-400 dark:text-gray-500 ml-1 flex items-center gap-0.5"><Cpu size={11} /> {result.provider}</span>}
                </span>
              )}
            </div>
            <pre className="font-mono text-[13px] leading-relaxed p-3 min-h-[72px] max-h-64 overflow-auto whitespace-pre-wrap bg-gray-950 text-gray-100">
              {running ? <span className="text-gray-500">Running…</span>
                : result ? <span className={result.code === 0 ? 'text-gray-100' : 'text-red-300'}>{result.output}</span>
                : <span className="text-gray-600">Press <span className="text-brand-400">Run</span> to execute your code.</span>}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
