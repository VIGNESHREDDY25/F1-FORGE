import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bot, X, Send, Sparkles, Loader2, Maximize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { clsx } from 'clsx';
import api from '../api/client';

interface Msg { role: 'user' | 'assistant'; content: string; sources?: string[] }

// Pages that already host their own contextual assistant — skip the global one there.
const SKIP_ROUTES = ['/jobs', '/salary', '/assistant'];

const SUGGESTIONS = [
  'How many unemployment days do I get on OPT?',
  'Explain the H1B cap-gap for me',
  'Tips to find H1B sponsors',
  'How do I negotiate salary on OPT?',
];

export default function AssistantWidget() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, loading, open]);

  const send = useCallback(async (text: string) => {
    const msg = text.trim();
    if (!msg || loading) return;
    setMsgs(m => [...m, { role: 'user', content: msg }]);
    setInput('');
    setLoading(true);
    try {
      const { data } = await api.post('/assistant/chat', { ...(convId ? { conversationId: convId } : {}), message: msg });
      if (data.conversationId) setConvId(data.conversationId);
      const content = data.message?.content ?? data.content ?? 'Sorry, I could not generate a response.';
      setMsgs(m => [...m, { role: 'assistant', content, sources: data.message?.sources }]);
    } catch {
      setMsgs(m => [...m, { role: 'assistant', content: '⚠️ I had trouble reaching the assistant. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }, [convId, loading]);

  if (SKIP_ROUTES.includes(pathname)) return null;

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open AI assistant"
          className="fixed bottom-5 right-5 z-50 group flex items-center gap-2 pl-3.5 pr-4 py-3 rounded-full
                     bg-gradient-to-br from-brand-600 to-indigo-600 text-white shadow-xl shadow-brand-600/30
                     hover:shadow-2xl hover:shadow-brand-600/40 hover:-translate-y-0.5 transition-all"
        >
          <span className="relative flex h-5 w-5 items-center justify-center">
            <span className="absolute inline-flex h-full w-full rounded-full bg-white/30 animate-ping" />
            <Bot size={18} className="relative" />
          </span>
          <span className="text-sm font-semibold">Ask AI</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[min(92vw,400px)] h-[min(80vh,560px)] flex flex-col
                        card !rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-brand-600 to-indigo-600 text-white shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/20 grid place-items-center"><Bot size={18} /></div>
              <div className="leading-tight">
                <div className="font-semibold text-sm">AI Career Assistant</div>
                <div className="text-[11px] text-white/80 flex items-center gap-1"><Sparkles size={10} /> F1 · OPT · H1B expert</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Link to="/assistant" onClick={() => setOpen(false)} title="Open full assistant"
                className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"><Maximize2 size={15} /></Link>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"><X size={16} /></button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 bg-gray-50/60 dark:bg-gray-950/40">
            {msgs.length === 0 && (
              <div className="text-center py-6">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-brand-100 dark:bg-brand-950/50 grid place-items-center text-brand-600 dark:text-brand-400 mb-3">
                  <Bot size={22} />
                </div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">How can I help your job search?</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">Ask me anything about F1, OPT, H1B, resumes, or interviews.</p>
                <div className="space-y-1.5">
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => send(s)}
                      className="block w-full text-left text-xs px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-brand-300 dark:hover:border-brand-700 hover:text-brand-700 dark:hover:text-brand-300 transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={clsx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={clsx('max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm',
                  m.role === 'user'
                    ? 'bg-brand-600 text-white rounded-br-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-bl-sm')}>
                  {m.role === 'assistant'
                    ? <div className="lc-content text-[13px] leading-relaxed"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown></div>
                    : <span className="whitespace-pre-wrap">{m.content}</span>}
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {m.sources.map((s, j) => <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{s}</span>)}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-sm px-4 py-3">
                  <span className="flex gap-1">
                    {[0, 1, 2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={e => { e.preventDefault(); send(input); }}
            className="p-2.5 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0 flex items-center gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about OPT, H1B, resumes…"
              className="input !py-2.5 text-sm flex-1"
            />
            <button type="submit" disabled={loading || !input.trim()} className="btn-primary !px-3 !py-2.5 shrink-0">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
