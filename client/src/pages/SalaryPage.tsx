import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, DollarSign, Building2, MapPin, Info, Bot, Send, ChevronDown, BadgeCheck, Lightbulb } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import api from '../api/client';
import { clsx } from 'clsx';

const ROLES = ['Software Engineer', 'Data Scientist', 'ML Engineer', 'Product Manager', 'Data Engineer', 'DevOps Engineer', 'Security Engineer'];
const LOCATIONS = ['United States', 'San Francisco, CA', 'New York, NY', 'Seattle, WA', 'Austin, TX', 'Boston, MA', 'Chicago, IL'];

export default function SalaryPage() {
  const [role, setRole] = useState('Software Engineer');
  const [location, setLocation] = useState('United States');
  const [company, setCompany] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  async function sendChat(msg?: string) {
    const text = (msg ?? chatInput).trim();
    if (!text) return;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text }]);
    setChatLoading(true);
    try {
      const res = await api.post('/salary/assistant', { message: text });
      setChatMessages(prev => [...prev, { role: 'assistant', text: res.data.reply }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }

  const { data: insights } = useQuery({
    queryKey: ['salary-insights', role, location, company],
    queryFn: () => api.get('/salary/insights', { params: { role, location, company: company || undefined } }).then(r => r.data),
  });

  const { data: comparison } = useQuery({
    queryKey: ['salary-compare', location],
    queryFn: () => api.get('/salary/compare', { params: { location } }).then(r => r.data),
  });

  const bands = insights?.salaryBands;

  const chartData = bands ? [
    { label: '25th %ile', value: bands.p25, color: '#94a3b8' },
    { label: 'Median', value: bands.median, color: '#3b82f6' },
    { label: '75th %ile', value: bands.p75, color: '#8b5cf6' },
    { label: '90th %ile', value: bands.p90, color: '#f59e0b' },
  ] : [];

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="page-title">Salary Insights</h1>
        <p className="page-subtitle">Real compensation data from H1B public filings — know your worth before negotiating.</p>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Role</label>
            <select className="input" value={role} onChange={e => setRole(e.target.value)}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="label"><MapPin size={12} className="inline mr-1" />Location</label>
            <select className="input" value={location} onChange={e => setLocation(e.target.value)}>
              {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label"><Building2 size={12} className="inline mr-1" />Company (optional)</label>
            <input className="input" placeholder="Google, Meta, Amazon…" value={company}
              onChange={e => setCompany(e.target.value)}
              list="company-suggestions" />
            <datalist id="company-suggestions">
              {['Google LLC','Meta Platforms Inc','Amazon.com Inc','Apple Inc','Microsoft Corporation','Netflix Inc','Stripe Inc','Databricks Inc','NVIDIA Corporation'].map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
        </div>
      </div>

      {insights && bands && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-fade-in">
          {/* Salary bands */}
          <div className="card p-5 lg:col-span-2">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
              {role} Salaries · {insights.location}
              {company && <span className="text-gray-400 ml-2">@ {company}</span>}
            </h2>
            <p className="text-xs text-gray-400 mb-4">Based on {insights.sampleSize?.toLocaleString()} H1B filings{company && insights.companyPremium !== 'Market rate' && ` · ${insights.companyPremium}`}</p>

            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barSize={48} layout="vertical">
                <XAxis type="number" tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, 'Salary']} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.12)' }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-4 gap-3 mt-4">
              {chartData.map(d => (
                <div key={d.label} className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">${(d.value/1000).toFixed(0)}k</p>
                  <p className="text-xs text-gray-500 mt-0.5">{d.label}</p>
                </div>
              ))}
            </div>

            {insights.h1bAvgSalary && (
              <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-xl flex items-center gap-2">
                <Building2 size={14} className="text-green-600" />
                <p className="text-sm text-green-800 dark:text-green-300">
                  H1B avg at {company}: <strong>${insights.h1bAvgSalary.toLocaleString()}</strong>
                </p>
              </div>
            )}
          </div>

          {/* Negotiation tips */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <TrendingUp size={15} className="text-brand-600" /> Negotiation Tips
            </h3>
            <div className="space-y-3">
              {(insights.negotiationTips || []).map((tip: string, i: number) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i+1}</span>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl">
              <div className="flex items-center gap-1.5 mb-1">
                <Info size={12} className="text-amber-600" />
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">H1B Prevailing Wage</p>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-400">Your H1B salary must meet DOL's prevailing wage for your role and location. The median salary shown is typically above this floor.</p>
            </div>
          </div>
        </div>
      )}

      {/* Cross-role comparison */}
      {comparison && comparison.length > 0 && (
        <div className="card p-5 animate-fade-in">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Median Salary Comparison · {location}</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={comparison.filter((d: any) => d)} barSize={36}>
              <XAxis dataKey="role" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={r => r.split(' ').slice(0, 2).join(' ')} />
              <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, 'Median']} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.12)' }} />
              {comparison.find((d: any) => d?.role === role) && (
                <ReferenceLine y={comparison.find((d: any) => d?.role === role)?.median} stroke="#3b82f6" strokeDasharray="4 4" />
              )}
              <Bar dataKey="median" radius={[4, 4, 0, 0]}>
                {comparison.map((d: any, i: number) => (
                  <Cell key={i} fill={d?.role === role ? '#3b82f6' : '#cbd5e1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* H1B company salary leaders */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <DollarSign size={15} className="text-green-600" /> Top-Paying H1B Sponsors for {role}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { company: 'Jane Street Capital', salary: 230000, approval: 97.0 },
            { company: 'Two Sigma Investments', salary: 225000, approval: 96.2 },
            { company: 'DE Shaw & Co', salary: 215000, approval: 96.5 },
            { company: 'OpenAI', salary: 220000, approval: 97.5 },
            { company: 'Anthropic PBC', salary: 225000, approval: 97.8 },
            { company: 'Netflix Inc', salary: 210000, approval: 96.1 },
            { company: 'Citadel LLC', salary: 220000, approval: 95.8 },
            { company: 'NVIDIA Corporation', salary: 204000, approval: 97.1 },
            { company: 'Meta Platforms Inc', salary: 197000, approval: 97.8 },
            { company: 'Google LLC', salary: 189000, approval: 97.2 },
          ].map(c => (
            <div key={c.company} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">${(c.salary/1000).toFixed(0)}k</p>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-0.5 truncate">{c.company.split(' ')[0]}</p>
              <p className="text-[10px] text-green-600 mt-0.5">{c.approval}% approval</p>
            </div>
          ))}
        </div>
      </div>

      {/* F1/OPT/H1B Compensation Guide */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Lightbulb size={15} className="text-amber-500" /> F1/OPT/H1B Compensation Guide
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <BadgeCheck size={14} className="text-blue-600" />
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200">On CPT / OPT</h3>
            </div>
            <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1.5">
              <li>- No wage floor requirement — negotiate freely</li>
              <li>- STEM OPT extension gives 3 years total — leverage it</li>
              <li>- Employer must be E-Verify enrolled for STEM OPT</li>
              <li>- Competing offers increase leverage significantly</li>
            </ul>
          </div>
          <div className="p-4 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <BadgeCheck size={14} className="text-purple-600" />
              <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-200">H1B Transition</h3>
            </div>
            <ul className="text-xs text-purple-800 dark:text-purple-300 space-y-1.5">
              <li>- DOL prevailing wage = legal floor for H1B salary</li>
              <li>- Level II wage (~median) is typical for new grads</li>
              <li>- Employer must pay prevailing or actual wage (whichever higher)</li>
              <li>- Cap-exempt employers (universities, nonprofits) hire year-round</li>
            </ul>
          </div>
          <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <BadgeCheck size={14} className="text-green-600" />
              <h3 className="text-sm font-semibold text-green-900 dark:text-green-200">Total Comp Strategy</h3>
            </div>
            <ul className="text-xs text-green-800 dark:text-green-300 space-y-1.5">
              <li>- RSUs: 4-year vest, 1-year cliff — ask for accelerated schedule</li>
              <li>- Signing bonus: easier to flex than base salary bands</li>
              <li>- Annual bonus target: 10–25% for most tech roles</li>
              <li>- Use Levels.fyi for real TC breakdowns at top companies</li>
            </ul>
          </div>
        </div>
      </div>

      {/* AI Chat Widget */}
      <div className={clsx(
        'fixed bottom-5 right-5 z-40 flex flex-col transition-all duration-300',
        chatOpen ? 'w-80 shadow-2xl' : 'w-auto'
      )}>
        {chatOpen && (
          <div className="card flex flex-col overflow-hidden" style={{ height: '440px' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-brand-600">
              <div className="flex items-center gap-2">
                <Bot size={15} className="text-white" />
                <span className="text-sm font-semibold text-white">Salary Advisor</span>
                <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded-full">F1-aware</span>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-white/70 hover:text-white transition-colors">
                <ChevronDown size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50 dark:bg-gray-900/50">
              {chatMessages.length === 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2">Ask F1-aware salary questions</p>
                  {[
                    'Is $120k good for a new grad SWE in NYC?',
                    'How do I negotiate as an F1 student?',
                    'What is prevailing wage for H1B?',
                    'How do RSUs work in total compensation?',
                  ].map(q => (
                    <button key={q} onClick={() => sendChat(q)}
                      className="w-full text-left text-xs px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/30 transition-colors text-gray-700 dark:text-gray-300">
                      {q}
                    </button>
                  ))}
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} className={clsx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={clsx(
                    'max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap',
                    m.role === 'user'
                      ? 'bg-brand-600 text-white rounded-br-sm'
                      : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-bl-sm'
                  )}>
                    {m.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl rounded-bl-sm px-3 py-2">
                    <div className="flex gap-1 items-center h-4">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="flex items-center gap-2 p-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
              <input
                className="input flex-1 text-xs py-2"
                placeholder="Ask a salary question…"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                disabled={chatLoading}
              />
              <button onClick={() => sendChat()} disabled={chatLoading || !chatInput.trim()}
                className="btn-primary p-2 text-xs disabled:opacity-40 disabled:cursor-not-allowed">
                <Send size={13} />
              </button>
            </div>
          </div>
        )}

        {!chatOpen && (
          <button onClick={() => setChatOpen(true)}
            className="self-end flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white rounded-full px-4 py-3 shadow-lg transition-all hover:scale-105 text-sm font-semibold">
            <Bot size={16} />
            <span>Salary Advisor</span>
          </button>
        )}
      </div>
    </div>
  );
}
