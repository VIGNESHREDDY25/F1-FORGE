import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Plus, Copy, Check, Lightbulb, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../api/client';
import type { NetworkingMessage } from '../types';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

// LinkedIn people-search shortcuts for the extracted company — recruiters,
// your university's alumni, and peers in the same role.
function PeopleToReachOut({ company, role }: { company: string; role: string }) {
  const user = useAuthStore(s => s.user);
  const university = (user as any)?.university || '';
  const enc = encodeURIComponent;
  const targets = [
    {
      icon: '🧲', label: `Recruiters at ${company}`,
      desc: 'They decide who gets a first call — connect with 2-3.',
      url: `https://www.linkedin.com/search/results/people/?keywords=${enc(`"${company}" recruiter OR "talent acquisition"`)}`,
    },
    {
      icon: '🎓', label: university ? `${university} alumni at ${company}` : `Alumni at ${company}`,
      desc: 'Alumni reply 3-4x more often — your warmest path to a referral.',
      url: `https://www.linkedin.com/search/results/people/?keywords=${enc(`"${company}" ${university ? `"${university}"` : 'alumni'}`)}`,
    },
    {
      icon: '👩‍💻', label: `${role || 'People'} at ${company}`,
      desc: 'Future teammates — ask about the team, not for a job.',
      url: `https://www.linkedin.com/search/results/people/?keywords=${enc(`"${company}" "${role || 'engineer'}"`)}`,
    },
  ];
  return (
    <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 p-4">
      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide mb-2">
        People you can reach out to for this job
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {targets.map(t => (
          <a key={t.label} href={t.url} target="_blank" rel="noopener noreferrer"
            className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 hover:border-emerald-400 hover:shadow-sm transition-all group">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
              {t.icon} {t.label}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t.desc}</p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1.5 group-hover:underline">Open LinkedIn search →</p>
          </a>
        ))}
      </div>
    </div>
  );
}

const MESSAGE_TYPES = [
  { value: 'linkedin_connect', label: 'LinkedIn Connection' },
  { value: 'cold_email', label: 'Cold Email' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'referral_ask', label: 'Referral Ask' },
  { value: 'thank_you', label: 'Thank You' },
  { value: 'negotiation', label: 'Negotiation' },
];

const OUTCOME_COLORS: Record<string, string> = {
  pending: 'badge-yellow', responded: 'badge-green', no_response: 'badge-red', meeting_scheduled: 'badge-blue',
};

const STATS_CONFIG = [
  { key: 'total', label: 'Total Generated', color: 'text-brand-600' },
  { key: 'pending', label: 'Pending', color: 'text-yellow-600' },
  { key: 'responded', label: 'Responded', color: 'text-green-600' },
  { key: 'meetings', label: 'Meetings Scheduled', color: 'text-blue-600' },
] as const;

const MESSAGE_TEMPLATES = [
  {
    id: 'linkedin_connect',
    label: 'LinkedIn Connection Request',
    note: '< 300 chars',
    icon: '🔗',
    text: `Hi [Name], I came across your profile and was impressed by your work at [Company]. As a fellow [University] alum pursuing opportunities in [Field], I'd love to connect and learn from your experience. Would you be open to a quick chat?`,
  },
  {
    id: 'cold_email',
    label: 'Cold Email to Recruiter',
    icon: '📧',
    text: `Subject: [Role] Opportunity — F1/OPT Candidate

Hi [Recruiter Name],

I'm [Your Name], a [Degree] graduate from [University] with [X] years of experience in [Skill Area]. I'm currently on F1/OPT and actively targeting [Company] for [Role] roles.

I'd love to learn more about open positions and share how my background in [Specific Skill] could be a strong fit. Would you have 15 minutes this week?

Thank you,
[Your Name]`,
  },
  {
    id: 'referral_ask',
    label: 'Referral Request to Alumni',
    icon: '🎓',
    text: `Hi [Name],

I hope you're doing well! I'm [Your Name], a [Major] grad from [University] ('XX). I noticed you're at [Company] as a [Role] — congratulations!

I'm currently applying for [Position] at [Company] and would be incredibly grateful if you'd be willing to refer me or share any advice. I'm on F1/OPT, so having an internal advocate would mean a lot.

I've attached my resume for reference. Happy to meet virtually first if you'd prefer. Thank you so much!

Best,
[Your Name]`,
  },
  {
    id: 'thank_you',
    label: 'Thank You After Interview',
    icon: '🤝',
    text: `Subject: Thank You — [Role] Interview

Hi [Interviewer Name],

Thank you so much for taking the time to speak with me today about the [Role] position at [Company]. I really enjoyed our conversation about [Specific Topic Discussed] and came away even more excited about the team's work on [Project/Area].

Our discussion reinforced my enthusiasm for this opportunity. I'm confident my background in [Skill] aligns well with what you're looking for, and I'm eager to contribute.

Please don't hesitate to reach out if you need any additional information.

Warm regards,
[Your Name]`,
  },
];

const F1_TIPS = [
  { tip: 'Always mention your OPT status proactively — it removes uncertainty and shows transparency.' },
  { tip: 'Target alumni from your university at target companies; shared alma mater significantly increases response rates.' },
  { tip: "Seek out F1/OPT alumni specifically — they've navigated the same path and are often willing to help." },
  { tip: 'Best time to reach out: 3-4 months before your OPT start date to give hiring managers lead time.' },
  { tip: 'LinkedIn InMail has a higher response rate than cold email for initial contact with recruiters.' },
  { tip: 'Follow up exactly once after 7 days with no response — more than one follow-up can hurt your chances.' },
];

export default function NetworkingPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);
  const [showTips, setShowTips] = useState(true);
  const [form, setForm] = useState({ messageType: 'linkedin_connect', targetName: '', targetCompany: '', targetRole: '', sharedContext: '' });
  const [hmForm, setHmForm] = useState({ jobDescription: '', hiringManagerInfo: '', hiringManagerLinkedin: '' });
  const [hmResult, setHmResult] = useState<{
    name: string; title: string; company: string; role: string;
    linkedinUrl: string; message: string; connectionNote: string;
    usedResume?: boolean;
  } | null>(null);
  const [hmSaved, setHmSaved] = useState(false);

  const { data: messages = [] } = useQuery<NetworkingMessage[]>({
    queryKey: ['networking'],
    queryFn: () => api.get('/networking').then(r => r.data),
  });

  const { data: stats } = useQuery({
    queryKey: ['networking-stats'],
    queryFn: () => api.get('/networking/stats').then(r => r.data),
  });

  const generateMutation = useMutation({
    mutationFn: (data: any) => api.post('/networking/generate', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['networking'] }); qc.invalidateQueries({ queryKey: ['networking-stats'] }); setShowForm(false); toast.success('Message generated!'); },
    onError: () => toast.error('Failed to generate message'),
  });

  const updateOutcome = useMutation({
    mutationFn: ({ id, outcome }: any) => api.patch(`/networking/${id}/outcome`, { outcome }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['networking'] }); qc.invalidateQueries({ queryKey: ['networking-stats'] }); },
  });

  const hiringManagerMutation = useMutation({
    mutationFn: (data: typeof hmForm) => api.post('/networking/hiring-manager', data).then(r => r.data),
    onSuccess: (data) => {
      setHmResult(data);
      setHmSaved(false);
      toast.success('Outreach card ready — review and hit Save');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Could not generate — check both paste boxes'),
  });

  const hmSaveMutation = useMutation({
    mutationFn: () => api.post('/networking/hiring-manager/save', {
      name: hmResult!.name, title: hmResult!.title, company: hmResult!.company,
      role: hmResult!.role, linkedinUrl: hmResult!.linkedinUrl,
      message: hmResult!.message, connectionNote: hmResult!.connectionNote,
    }).then(r => r.data),
    onSuccess: () => {
      setHmSaved(true);
      toast.success('Saved to Referral Finder → your pending outreach list');
    },
    onError: () => toast.error('Could not save. Try again.'),
  });

  function copyMessage(msg: NetworkingMessage) {
    const text = msg.subjectLine ? `Subject: ${msg.subjectLine}\n\n${msg.generatedMessage}` : msg.generatedMessage;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(msg.id);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function copyTemplate(tpl: typeof MESSAGE_TEMPLATES[number]) {
    navigator.clipboard.writeText(tpl.text).then(() => {
      setCopiedTemplateId(tpl.id);
      toast.success('Template copied!');
      setTimeout(() => setCopiedTemplateId(null), 2000);
    });
  }

  // Compute stats with pending count derived from messages
  const pendingCount = messages.filter(m => m.outcome === 'pending').length;
  const enhancedStats = stats ? { ...stats, pending: pendingCount } : null;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Networking Assistant</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">AI-generated personalized outreach messages.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus size={16} /> Generate Message
        </button>
      </div>

      {/* LinkedIn automation banner */}
      <div className="flex items-center justify-between gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-900 rounded-xl">
        <div>
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">⚡ Automate your follow-ups</p>
          <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
            Connect LinkedIn in Integrations and F1Forge can send your approved outreach messages and follow-ups automatically — you confirm, it sends.
          </p>
        </div>
        <Link to="/settings" className="btn-primary text-xs shrink-0 whitespace-nowrap">Connect LinkedIn</Link>
      </div>

      {/* ── Hiring Manager Console ── */}
      <div className="card p-5 border-2 border-brand-200 dark:border-brand-800">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🎯</span>
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Hiring Manager Outreach</h2>
          <span className="badge badge-purple text-[10px]">AI</span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Paste the whole LinkedIn job description and the hiring manager's profile info (select-all → copy from their page). F1Forge extracts their name, title, company, and role, then crafts your message using your profile. Hit Save and it files into <strong>Referral Finder → pending outreach</strong>.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="label">1 · Job description paste *</label>
            <textarea className="input min-h-[140px] font-mono text-xs" placeholder={'Paste the entire LinkedIn job description here…\n\ne.g.\nSoftware Engineer II\nGoogle · Mountain View, CA (Hybrid)\nAbout the job…'}
              value={hmForm.jobDescription}
              onChange={e => setHmForm({ ...hmForm, jobDescription: e.target.value })} />
          </div>
          <div>
            <label className="label">2 · Hiring manager profile paste *</label>
            <textarea className="input min-h-[140px] font-mono text-xs" placeholder={'Open their LinkedIn profile, copy the top section, paste here…\n\ne.g.\nJane Smith\nEngineering Manager at Google\nMountain View, CA'}
              value={hmForm.hiringManagerInfo}
              onChange={e => setHmForm({ ...hmForm, hiringManagerInfo: e.target.value })} />
          </div>
          <div className="lg:col-span-2">
            <label className="label">3 · Their LinkedIn profile URL <span className="text-gray-400 font-normal">(paste from the address bar — used for your follow-up card)</span></label>
            <input className="input" placeholder="https://www.linkedin.com/in/…" value={hmForm.hiringManagerLinkedin}
              onChange={e => setHmForm({ ...hmForm, hiringManagerLinkedin: e.target.value })} />
          </div>
        </div>

        <button
          onClick={() => hiringManagerMutation.mutate(hmForm)}
          disabled={hiringManagerMutation.isPending || hmForm.jobDescription.length < 30 || hmForm.hiringManagerInfo.length < 3}
          className="btn-primary"
        >
          {hiringManagerMutation.isPending
            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : '✨'} Extract & craft message
        </button>

        {hmResult && (
          <div className="mt-4 space-y-3 animate-fade-in">
            {/* Parsed contact card */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Extracted contact card</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><p className="text-xs text-gray-400">Name</p><p className="font-semibold text-gray-900 dark:text-gray-100">{hmResult.name || '—'}</p></div>
                <div><p className="text-xs text-gray-400">Title</p><p className="font-medium text-gray-700 dark:text-gray-300">{hmResult.title || '—'}</p></div>
                <div><p className="text-xs text-gray-400">Company</p><p className="font-medium text-gray-700 dark:text-gray-300">{hmResult.company || '—'}</p></div>
                <div><p className="text-xs text-gray-400">Role</p><p className="font-medium text-gray-700 dark:text-gray-300">{hmResult.role || '—'}</p></div>
              </div>
              {hmResult.linkedinUrl && (
                <a href={hmResult.linkedinUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-block mt-2 text-xs text-brand-600 dark:text-brand-400 hover:underline">
                  {hmResult.linkedinUrl}
                </a>
              )}
            </div>

            {/* People you can reach out to for this job */}
            {hmResult.company && <PeopleToReachOut company={hmResult.company} role={hmResult.role} />}

            <div className="rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50/60 dark:bg-brand-950/30 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-brand-700 dark:text-brand-300 uppercase tracking-wide">Connection request note <span className="font-normal normal-case text-gray-400">(send with your invite)</span></p>
                <button className="btn-secondary text-xs py-1 px-2"
                  onClick={() => { navigator.clipboard.writeText(hmResult.connectionNote); toast.success('Connection note copied!'); }}>
                  <Copy size={11} /> Copy
                </button>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{hmResult.connectionNote}</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                  LinkedIn message <span className="font-normal normal-case text-gray-400">(send after they accept)</span>
                  {hmResult.usedResume && <span className="badge badge-green text-[10px] ml-2 normal-case">📄 Personalized from your resume</span>}
                </p>
                <button className="btn-secondary text-xs py-1 px-2"
                  onClick={() => { navigator.clipboard.writeText(hmResult.message); toast.success('Message copied!'); }}>
                  <Copy size={11} /> Copy
                </button>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{hmResult.message}</p>
              {!hmResult.usedResume && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  💡 Run your resume through the <Link to="/resume" className="underline">Resume Optimizer</Link> once and these messages will cite your real projects automatically.
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => hmSaveMutation.mutate()}
                disabled={hmSaved || hmSaveMutation.isPending || !hmResult.name || !hmResult.company}
                className={hmSaved ? 'btn-secondary cursor-default' : 'btn-primary'}
              >
                {hmSaved ? <><Check size={14} /> Saved to Referrals & Outreach</>
                  : hmSaveMutation.isPending ? 'Saving…'
                  : '💾 Save to Referrals & Outreach'}
              </button>
              {hmSaved && (
                <Link to="/referrals" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
                  View pending outreach →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stats row */}
      {enhancedStats && (
        <div className="grid grid-cols-4 gap-3">
          {STATS_CONFIG.map(({ key, label, color }) => (
            <div key={key} className={`card p-4 text-center border-t-2 ${key === 'total' ? 'border-brand-400' : key === 'pending' ? 'border-yellow-400' : key === 'responded' ? 'border-green-400' : 'border-blue-400'}`}>
              <p className={`text-2xl font-bold ${color}`}>{enhancedStats[key as keyof typeof enhancedStats] ?? 0}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tips for F1 Students */}
      <div className="card p-4 border border-amber-200 bg-amber-50">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setShowTips(s => !s)}
        >
          <div className="flex items-center gap-2">
            <Lightbulb size={16} className="text-amber-500 shrink-0" />
            <span className="text-sm font-semibold text-amber-900">Networking Tips for F1 Students</span>
          </div>
          {showTips ? <ChevronUp size={15} className="text-amber-600" /> : <ChevronDown size={15} className="text-amber-600" />}
        </button>
        {showTips && (
          <ul className="mt-3 space-y-2">
            {F1_TIPS.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                {t.tip}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Message Templates */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <FileText size={16} className="text-brand-600" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Message Templates</h2>
          <span className="text-xs text-gray-400">— click to copy and customize</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MESSAGE_TEMPLATES.map(tpl => (
            <div key={tpl.id} className="card p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-base mr-1.5">{tpl.icon}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{tpl.label}</span>
                  {tpl.note && <span className="ml-1.5 text-xs text-gray-400">{tpl.note}</span>}
                </div>
                <button
                  onClick={() => copyTemplate(tpl)}
                  className="btn-secondary text-xs py-1 px-2 shrink-0"
                >
                  {copiedTemplateId === tpl.id ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap line-clamp-3 leading-relaxed">{tpl.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Generated messages list */}
      <div className="space-y-3">
        {messages.length > 0 && (
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <MessageSquare size={16} className="text-brand-600" /> Your Messages
          </h2>
        )}
        {messages.length === 0 ? (
          <div className="card p-12 text-center">
            <MessageSquare size={40} className="text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Generate your first personalized outreach message.</p>
          </div>
        ) : messages.map(msg => (
          <div key={msg.id} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="badge badge-blue capitalize">{msg.messageType.replace(/_/g, ' ')}</span>
                  <span className={`badge ${OUTCOME_COLORS[msg.outcome]} capitalize`}>{msg.outcome.replace(/_/g, ' ')}</span>
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{msg.targetName} · {msg.targetRole} at {msg.targetCompany}</p>
                {msg.subjectLine && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Subject: {msg.subjectLine}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => copyMessage(msg)} className="btn-secondary text-xs py-1 px-2">
                  {copiedId === msg.id ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                </button>
              </div>
            </div>

            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg border border-gray-200 dark:border-gray-800">
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{msg.generatedMessage}</p>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-gray-400">Outcome:</span>
              <select
                className="text-xs border border-gray-200 dark:border-gray-800 rounded px-2 py-1 bg-white dark:bg-gray-900"
                value={msg.outcome}
                onChange={e => updateOutcome.mutate({ id: msg.id, outcome: e.target.value })}
              >
                <option value="pending">Pending</option>
                <option value="responded">Responded</option>
                <option value="no_response">No Response</option>
                <option value="meeting_scheduled">Meeting Scheduled</option>
              </select>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Generate Outreach Message</h2>
            <form onSubmit={e => { e.preventDefault(); generateMutation.mutate(form); }} className="space-y-3">
              <div>
                <label className="label">Message Type</label>
                <select className="input" value={form.messageType} onChange={e => setForm({ ...form, messageType: e.target.value })}>
                  {MESSAGE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Contact Name *</label>
                <input className="input" required value={form.targetName} onChange={e => setForm({ ...form, targetName: e.target.value })} placeholder="Jane Smith" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Company *</label>
                  <input className="input" required value={form.targetCompany} onChange={e => setForm({ ...form, targetCompany: e.target.value })} placeholder="Google" />
                </div>
                <div>
                  <label className="label">Their Role *</label>
                  <input className="input" required value={form.targetRole} onChange={e => setForm({ ...form, targetRole: e.target.value })} placeholder="Senior SWE" />
                </div>
              </div>
              <div>
                <label className="label">Shared Context / Connection</label>
                <textarea className="input resize-none" rows={3} value={form.sharedContext}
                  onChange={e => setForm({ ...form, sharedContext: e.target.value })}
                  placeholder="Went to same university, met at career fair, interested in their ML work..." />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={generateMutation.isPending} className="btn-primary flex-1">
                  {generateMutation.isPending ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
