import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, Bot, User, Plus, AlertCircle, Trash2, Info } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../api/client';
import type { AIConversation, AIMessage } from '../types';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

const SUGGESTED_QUESTIONS = [
  "Can I work part-time on campus during OPT?",
  "What happens if I get laid off during STEM OPT?",
  "How do I negotiate salary as an F1 student?",
  "What's the H1B lottery process and timeline?",
  "Can I work for multiple employers on OPT?",
  "How do I write a cold outreach to a recruiter?",
  "What is STEM OPT and how do I apply?",
  "Can my employer change my job title on OPT?",
];

export default function AssistantPage() {
  const qc = useQueryClient();
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: conversations = [] } = useQuery<AIConversation[]>({
    queryKey: ['conversations'],
    queryFn: () => api.get('/assistant/conversations').then(r => r.data),
  });

  const { data: aiStatus } = useQuery<{ hasOpenAI: boolean; mode: string }>({
    queryKey: ['assistant-status'],
    queryFn: () => api.get('/assistant/status').then(r => r.data),
    staleTime: Infinity,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  async function loadConversation(id: string) {
    setActiveConvId(id);
    const { data } = await api.get(`/assistant/conversations/${id}`);
    setMessages(data.messages);
  }

  async function sendMessage(text?: string) {
    const msg = (text || input).trim();
    if (!msg || sending) return;
    setInput('');
    setSending(true);

    const userMsg: AIMessage = { id: Date.now().toString(), conversationId: activeConvId || '', role: 'user', content: msg, createdAt: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);

    try {
      const { data } = await api.post('/assistant/chat', { ...(activeConvId ? { conversationId: activeConvId } : {}), message: msg });
      if (!activeConvId) setActiveConvId(data.conversationId);
      setMessages(prev => [...prev, data.message]);
      qc.invalidateQueries({ queryKey: ['conversations'] });
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now().toString(), conversationId: '', role: 'assistant' as const,
        content: 'Sorry, something went wrong. Please try again.', createdAt: new Date().toISOString()
      }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await api.delete(`/assistant/conversations/${id}`);
    qc.invalidateQueries({ queryKey: ['conversations'] });
    if (activeConvId === id) { setActiveConvId(null); setMessages([]); }
    toast.success('Conversation deleted');
  }

  function newConversation() { setActiveConvId(null); setMessages([]); }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-3">
      {aiStatus && !aiStatus.hasOpenAI && (
        <div className="flex items-center gap-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300 shrink-0">
          <Info size={15} className="shrink-0" />
          <span>Running in <strong>fallback mode</strong> — add <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded text-xs">OPENAI_API_KEY</code> to <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded text-xs">.env</code> for full AI responses. Fallback covers common F1/OPT questions.</span>
        </div>
      )}
    <div className="flex gap-4 flex-1 min-h-0">
      {/* Sidebar */}
      <div className="w-56 shrink-0 flex flex-col gap-2">
        <button onClick={newConversation} className="btn-primary w-full justify-center">
          <Plus size={15} /> New Chat
        </button>
        <div className="card flex-1 overflow-y-auto p-2 space-y-0.5">
          {conversations.length === 0 ? (
            <div className="text-center py-6">
              <Bot size={28} className="text-gray-200 dark:text-gray-700 mx-auto mb-2" />
              <p className="text-xs text-gray-400">No conversations yet</p>
            </div>
          ) : conversations.map(c => (
            <div key={c.id}
              onClick={() => loadConversation(c.id)}
              className={clsx('w-full text-left px-3 py-2 rounded-lg cursor-pointer transition-colors group flex items-start justify-between gap-1', activeConvId === c.id ? 'bg-brand-50 dark:bg-brand-950/40' : 'hover:bg-gray-50 dark:hover:bg-gray-800')}>
              <div className="flex-1 min-w-0">
                <p className={clsx('text-xs font-medium truncate', activeConvId === c.id ? 'text-brand-700 dark:text-brand-300' : 'text-gray-700 dark:text-gray-300')}>{c.title}</p>
                {c.lastMessage && <p className="text-[11px] text-gray-400 truncate mt-0.5">{c.lastMessage}</p>}
              </div>
              <button onClick={e => deleteConversation(c.id, e)} className="shrink-0 p-0.5 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all">
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col card overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-brand-700 rounded-full flex items-center justify-center">
            <Bot size={17} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">F1Forge AI Assistant</p>
            <p className="text-[11px] text-green-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />Online · Expert on F1 visa, OPT, job search & career</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {messages.length === 0 && (
            <div className="space-y-5 animate-fade-in">
              <div className="text-center py-6">
                <div className="w-14 h-14 bg-brand-50 dark:bg-brand-950/40 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Bot size={28} className="text-brand-600" />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1">How can I help?</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">Ask me anything about F1 visa, OPT/CPT rules, job search strategies, or career advice.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SUGGESTED_QUESTIONS.map(q => (
                  <button key={q} onClick={() => sendMessage(q)}
                    className="text-left p-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-brand-50 dark:hover:bg-brand-950/30 border border-gray-200 dark:border-gray-700 hover:border-brand-200 dark:hover:border-brand-800 rounded-xl text-xs text-gray-600 dark:text-gray-400 hover:text-brand-700 dark:hover:text-brand-300 transition-all">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={clsx('flex gap-3 animate-fade-in', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 bg-gradient-to-br from-brand-500 to-brand-700 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={13} className="text-white" />
                </div>
              )}
              <div className={clsx('max-w-[82%] rounded-2xl px-4 py-3', msg.role === 'user' ? 'bg-brand-600 text-white rounded-br-sm' : 'bg-gray-100 dark:bg-gray-800 rounded-bl-sm')}>
                {msg.role === 'assistant' ? (
                  <div className="prose-chat">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                )}
                {msg.role === 'assistant' && msg.sources && (msg.sources as string[]).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-1">
                    {(msg.sources as string[]).map(s => (
                      <span key={s} className="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">{s}</span>
                    ))}
                  </div>
                )}
                {msg.flaggedForEscalation && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-2.5 py-1.5">
                    <AlertCircle size={12} /> Complex question — consider consulting your DSO
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 bg-brand-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <User size={13} className="text-white" />
                </div>
              )}
            </div>
          ))}

          {sending && (
            <div className="flex gap-3 animate-fade-in">
              <div className="w-7 h-7 bg-gradient-to-br from-brand-500 to-brand-700 rounded-full flex items-center justify-center shrink-0">
                <Bot size={13} className="text-white" />
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1 items-center h-4">
                  {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-800">
          <div className="flex gap-2 items-end">
            <textarea ref={inputRef}
              className="input flex-1 resize-none min-h-[42px] max-h-32 py-2.5 leading-snug"
              placeholder="Ask about OPT, CPT, H1B, job search, negotiations…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              rows={1}
            />
            <button onClick={() => sendMessage()} disabled={!input.trim() || sending} className="btn-primary px-3 h-[42px] shrink-0">
              <Send size={15} />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 text-center">Not a substitute for legal advice. Consult your DSO for complex immigration questions.</p>
        </div>
      </div>
    </div>
    </div>
  );
}
