import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, ExternalLink, Trash2, Edit2, BarChart2, Download, GripVertical, X, Bot, Send, ChevronDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../api/client';
import type { JobApplication, JobStage } from '../types';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const STAGES: { key: JobStage; label: string; color: string; dot: string }[] = [
  { key: 'saved', label: 'Saved', color: 'border-gray-200 bg-gray-50 dark:bg-gray-900/50 dark:border-gray-800', dot: 'bg-gray-400' },
  { key: 'applied', label: 'Applied', color: 'border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900', dot: 'bg-blue-500' },
  { key: 'assessment', label: 'Assessment', color: 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-900', dot: 'bg-yellow-500' },
  { key: 'interview', label: 'Interview', color: 'border-purple-200 bg-purple-50 dark:bg-purple-950/30 dark:border-purple-900', dot: 'bg-purple-500' },
  { key: 'offer', label: 'Offer 🎉', color: 'border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900', dot: 'bg-green-500' },
  { key: 'rejected', label: 'Rejected', color: 'border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900', dot: 'bg-red-400' },
];

const STAGE_CHART_COLORS: Record<JobStage, string> = {
  saved: '#9ca3af', applied: '#3b82f6', assessment: '#eab308',
  interview: '#a855f7', offer: '#22c55e', rejected: '#ef4444',
};

const EMPTY_FORM = {
  company: '', role: '', jdUrl: '', stage: 'saved' as JobStage,
  recruiterName: '', salaryMin: '', salaryMax: '', followUpDate: '', notes: '', appliedDate: '',
};

export default function JobsPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<'kanban' | 'list' | 'analytics'>('kanban');
  const [showForm, setShowForm] = useState(false);
  const [editJob, setEditJob] = useState<JobApplication | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [activeJob, setActiveJob] = useState<JobApplication | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    const prefill = searchParams.get('prefill');
    if (prefill) {
      try {
        const data = JSON.parse(decodeURIComponent(prefill));
        setForm({ ...EMPTY_FORM, company: data.company || '', role: data.role || '', jdUrl: data.jdUrl || '' });
        setEditJob(null);
        setShowForm(true);
        setSearchParams({}, { replace: true });
      } catch {}
    }
  }, [searchParams]);

  const { data: jobs = [] } = useQuery<JobApplication[]>({
    queryKey: ['jobs'],
    queryFn: () => api.get('/jobs').then(r => r.data),
  });

  const { data: analytics } = useQuery({
    queryKey: ['job-analytics'],
    queryFn: () => api.get('/jobs/analytics').then(r => r.data),
    enabled: view === 'analytics',
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/jobs', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['jobs'] }); closeForm(); toast.success('Application added'); },
    onError: () => toast.error('Failed to add'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => api.patch(`/jobs/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['jobs'] }); closeForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/jobs/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['jobs'] }); toast.success('Removed'); },
  });

  async function sendChat(msg?: string) {
    const text = (msg ?? chatInput).trim();
    if (!text) return;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text }]);
    setChatLoading(true);
    try {
      const res = await api.post('/jobs/assistant', { message: text });
      setChatMessages(prev => [...prev, { role: 'assistant', text: res.data.reply }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }

  function closeForm() { setShowForm(false); setEditJob(null); setForm(EMPTY_FORM); }

  function openEdit(job: JobApplication) {
    setEditJob(job);
    setForm({ ...EMPTY_FORM, ...job, salaryMin: String(job.salaryMin ?? ''), salaryMax: String(job.salaryMax ?? '') });
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, salaryMin: form.salaryMin ? parseInt(form.salaryMin) : undefined, salaryMax: form.salaryMax ? parseInt(form.salaryMax) : undefined };
    editJob ? updateMutation.mutate({ id: editJob.id, ...payload }) : createMutation.mutate(payload);
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveJob(jobs.find(j => j.id === e.active.id) || null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveJob(null);
    const { active, over } = e;
    if (!over) return;
    const job = jobs.find(j => j.id === active.id);
    if (!job) return;
    const newStage = over.id as JobStage;
    if (STAGES.find(s => s.key === newStage) && job.stage !== newStage) {
      updateMutation.mutate({ id: job.id, stage: newStage });
    }
  }

  function exportCSV() {
    const headers = ['Company', 'Role', 'Stage', 'Applied Date', 'Salary Min', 'Salary Max', 'Recruiter', 'Follow Up', 'Notes', 'H1B Sponsor'];
    const rows = jobs.map(j => [j.company, j.role, j.stage, j.appliedDate || '', j.salaryMin || '', j.salaryMax || '', j.recruiterName || '', j.followUpDate || '', (j.notes || '').replace(/,/g, ';'), j.sponsorsH1b ? 'Yes' : 'No']);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'job-applications.csv'; a.click();
    toast.success('Exported to CSV');
  }

  const jobsByStage = STAGES.reduce((acc, s) => {
    acc[s.key] = jobs.filter(j => j.stage === s.key);
    return acc;
  }, {} as Record<JobStage, JobApplication[]>);

  const stageChartData = STAGES.map(s => ({ name: s.label.replace(' 🎉', ''), value: jobsByStage[s.key].length, stage: s.key }));

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="page-title">Application Tracker</h1>
          <p className="page-subtitle">{jobs.length} applications · {jobs.filter(j => j.stage === 'interview').length} in interview · {jobs.filter(j => j.sponsorsH1b).length} H1B sponsors</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {(['kanban', 'list', 'analytics'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={clsx('px-3 py-1.5 text-xs font-semibold capitalize transition-colors', view === v ? 'bg-brand-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800')}>
                {v === 'analytics' ? <BarChart2 size={13} /> : v}
              </button>
            ))}
          </div>
          <button onClick={exportCSV} className="btn-secondary text-xs py-1.5 px-2.5">
            <Download size={13} /> Export
          </button>
          <button onClick={() => { setEditJob(null); setForm(EMPTY_FORM); setShowForm(true); }} className="btn-primary text-sm">
            <Plus size={15} /> Add Application
          </button>
        </div>
      </div>

      {/* Kanban */}
      {view === 'kanban' && (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4 flex-1">
            {STAGES.map(({ key, label, color, dot }) => (
              <DroppableColumn key={key} stageKey={key} label={label} color={color} dot={dot} jobs={jobsByStage[key]} onEdit={openEdit} onDelete={(id: string) => deleteMutation.mutate(id)} />
            ))}
          </div>
          <DragOverlay>
            {activeJob && <JobCardKanban job={activeJob} onEdit={() => {}} onDelete={() => {}} dragging />}
          </DragOverlay>
        </DndContext>
      )}

      {/* List */}
      {view === 'list' && (
        <div className="card overflow-hidden flex-1">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  {['Company', 'Role', 'Stage', 'Applied', 'Salary', 'H1B', 'Follow-up', ''].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {jobs.map(job => (
                  <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                    <td className="px-4 py-3 font-semibold text-sm text-gray-900 dark:text-gray-100">{job.company}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{job.role}</td>
                    <td className="px-4 py-3"><StagePill stage={job.stage} /></td>
                    <td className="px-4 py-3 text-xs text-gray-500">{job.appliedDate || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {job.salaryMin ? `$${(job.salaryMin/1000).toFixed(0)}k–$${(job.salaryMax!/1000).toFixed(0)}k` : '—'}
                    </td>
                    <td className="px-4 py-3">{job.sponsorsH1b && <span className="badge badge-green text-xs">H1B</span>}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{job.followUpDate || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {job.jdUrl && <a href={job.jdUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost p-1.5 text-xs"><ExternalLink size={13} /></a>}
                        <button onClick={() => openEdit(job)} className="btn-ghost p-1.5"><Edit2 size={13} /></button>
                        <button onClick={() => deleteMutation.mutate(job.id)} className="btn-ghost p-1.5 hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!jobs.length && (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400 text-sm">No applications yet. Add your first one!</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Analytics */}
      {view === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 flex-1">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Applications by Stage</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stageChartData} barSize={32}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.12)' }} cursor={{ fill: 'rgba(0,0,0,.04)' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {stageChartData.map((d, i) => <Cell key={i} fill={STAGE_CHART_COLORS[d.stage as JobStage]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Weekly Application Volume</h3>
            {analytics?.weeklyVolume ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={analytics.weeklyVolume.slice(-8)} barSize={24}>
                  <XAxis dataKey="week" tickFormatter={d => { try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return ''; } }} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.12)' }} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-60 flex items-center justify-center text-gray-400 text-sm">Loading…</div>}
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Key Metrics</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Applications', value: jobs.length },
                { label: 'Response Rate', value: analytics ? `${analytics.responseRate}%` : '—' },
                { label: 'In Interview', value: jobs.filter(j => j.stage === 'interview').length },
                { label: 'Offers Received', value: jobs.filter(j => j.stage === 'offer').length },
                { label: 'H1B Sponsors', value: jobs.filter(j => j.sponsorsH1b).length },
                { label: 'Avg Salary', value: (() => { const s = jobs.filter(j => j.salaryMin); return s.length ? `$${Math.round(s.reduce((a, j) => a + (j.salaryMin! + (j.salaryMax || j.salaryMin!)) / 2, 0) / s.length / 1000)}k` : '—'; })() },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Top Target Companies</h3>
            <div className="space-y-2">
              {Array.from(jobs.reduce((m, j) => { m.set(j.company, (m.get(j.company) || 0) + 1); return m; }, new Map<string, number>()))
                .sort((a, b) => b[1] - a[1]).slice(0, 6).map(([company, count]) => (
                  <div key={company} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{company}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-500 rounded-full" style={{ width: `${(count / jobs.length) * 100}%` }} />
                      </div>
                      <span className="text-xs text-gray-400 w-4 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              {!jobs.length && <p className="text-sm text-gray-400">No data yet</p>}
            </div>
          </div>
        </div>
      )}

      {/* AI Chat Widget */}
      <div className={clsx(
        'fixed bottom-5 right-5 z-40 flex flex-col transition-all duration-300',
        chatOpen ? 'w-80 shadow-2xl' : 'w-auto'
      )}>
        {chatOpen && (
          <div className="card flex flex-col overflow-hidden" style={{ height: '420px' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-brand-600">
              <div className="flex items-center gap-2">
                <Bot size={15} className="text-white" />
                <span className="text-sm font-semibold text-white">Application Assistant</span>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-white/70 hover:text-white transition-colors">
                <ChevronDown size={16} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50 dark:bg-gray-900/50">
              {chatMessages.length === 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2">Ask about your applications</p>
                  {[
                    'What are my application statuses?',
                    'How many interviews do I have?',
                    'Which applications need follow-up?',
                    'What did I apply to this week?',
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

            {/* Input */}
            <div className="flex items-center gap-2 p-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
              <input
                className="input flex-1 text-xs py-2"
                placeholder="Ask about your applications…"
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
            <span>AI Assistant</span>
          </button>
        )}
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{editJob ? 'Edit Application' : 'Add Application'}</h2>
              <button onClick={closeForm} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Company *</label><input className="input" required value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
                <div><label className="label">Role *</label><input className="input" required value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} /></div>
              </div>
              <div><label className="label">Job Description URL</label><input className="input" type="url" placeholder="https://..." value={form.jdUrl} onChange={e => setForm({ ...form, jdUrl: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Stage</label>
                  <select className="input" value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value as JobStage })}>
                    {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
                <div><label className="label">Applied Date</label><input type="date" className="input" value={form.appliedDate} onChange={e => setForm({ ...form, appliedDate: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Salary Min ($)</label><input className="input" type="number" placeholder="120000" value={form.salaryMin} onChange={e => setForm({ ...form, salaryMin: e.target.value })} /></div>
                <div><label className="label">Salary Max ($)</label><input className="input" type="number" placeholder="160000" value={form.salaryMax} onChange={e => setForm({ ...form, salaryMax: e.target.value })} /></div>
              </div>
              <div><label className="label">Recruiter Name</label><input className="input" value={form.recruiterName} onChange={e => setForm({ ...form, recruiterName: e.target.value })} /></div>
              <div><label className="label">Follow-up Date</label><input type="date" className="input" value={form.followUpDate} onChange={e => setForm({ ...form, followUpDate: e.target.value })} /></div>
              <div><label className="label">Notes</label><textarea className="input resize-none" rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeForm} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editJob ? 'Save Changes' : 'Add Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function DroppableColumn({ stageKey, label, color, dot, jobs, onEdit, onDelete }: any) {
  const { setNodeRef } = useSortable({ id: stageKey, data: { type: 'column' }, disabled: true });
  return (
    <div ref={setNodeRef} className="shrink-0 w-60">
      <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl border-x border-t ${color}`}>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${dot}`} />
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">{label}</span>
        </div>
        <span className="text-xs font-bold text-gray-500 bg-white/70 dark:bg-black/30 px-1.5 py-0.5 rounded-full">{jobs.length}</span>
      </div>
      <SortableContext items={jobs.map((j: any) => j.id)} strategy={verticalListSortingStrategy}>
        <div className={`border border-t-0 rounded-b-xl min-h-40 p-2 space-y-2 ${color}`} id={stageKey}>
          {jobs.map((job: JobApplication) => (
            <SortableJobCard key={job.id} job={job} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableJobCard({ job, onEdit, onDelete }: { job: JobApplication; onEdit: (j: JobApplication) => void; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: job.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <JobCardKanban job={job} onEdit={onEdit} onDelete={onDelete} dragListeners={listeners} />
    </div>
  );
}

function JobCardKanban({ job, onEdit, onDelete, dragListeners, dragging }: any) {
  return (
    <div className={clsx('bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-sm group', dragging && 'shadow-lg rotate-1 scale-105')}>
      <div className="flex items-start justify-between gap-1 mb-1">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">{job.company}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{job.role}</p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors" {...dragListeners}>
            <GripVertical size={13} />
          </div>
          <button onClick={() => onEdit(job)} className="p-1 text-gray-300 hover:text-brand-600 rounded transition-colors opacity-0 group-hover:opacity-100"><Edit2 size={11} /></button>
          <button onClick={() => onDelete(job.id)} className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={11} /></button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mt-1.5">
        {job.sponsorsH1b && <span className="badge badge-green text-[10px] py-0">H1B</span>}
        {job.salaryMin && <span className="badge badge-gray text-[10px] py-0">${Math.round(job.salaryMin/1000)}k+</span>}
        {job.followUpDate && <span className="text-[10px] text-amber-600 dark:text-amber-400">📅 {job.followUpDate}</span>}
      </div>
    </div>
  );
}

function StagePill({ stage }: { stage: JobStage }) {
  const colors: Record<JobStage, string> = {
    saved: 'badge-gray', applied: 'badge-blue', assessment: 'badge-yellow',
    interview: 'badge-purple', offer: 'badge-green', rejected: 'badge-red',
  };
  return <span className={`badge ${colors[stage]} capitalize`}>{stage}</span>;
}
