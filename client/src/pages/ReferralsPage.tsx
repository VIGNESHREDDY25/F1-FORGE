import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Zap, ExternalLink, Copy, Check, BookmarkPlus,
  Users, ChevronDown, ChevronUp, Briefcase, UserPlus,
  GraduationCap, Trash2, Loader2,
} from 'lucide-react';
import api from '../api/client';
import type { ReferralContact } from '../types';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OutreachMessages {
  connectionNote: string;
  email: string;
  emailSubject?: string;
}

interface TargetResult {
  type: 'alumni' | 'recruiters' | 'role';
  label: string;
  description: string;
  linkedinUrl: string;
  linkedinKeywords: string;
  messages: OutreachMessages;
}

interface GenerateResult {
  company: string;
  role: string;
  userContext: { firstName: string; university: string; major: string };
  targets: TargetResult[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['not_contacted', 'contacted', 'responded', 'no_response'] as const;
const STATUS_LABELS: Record<string, string> = {
  not_contacted: 'Not Contacted',
  contacted: 'Contacted',
  responded: 'Responded',
  no_response: 'No Response',
};
const TYPE_ICONS: Record<string, React.ReactNode> = {
  alumni: <GraduationCap size={18} />,
  recruiters: <UserPlus size={18} />,
  role: <Briefcase size={18} />,
};

const TYPE_COLORS: Record<string, string> = {
  alumni:     'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
  recruiters: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800',
  role:       'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800',
};

// ── Utility ───────────────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`${label} copied!`);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md
        bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700
        text-gray-600 dark:text-gray-300 transition-colors"
    >
      {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// ── Target card ───────────────────────────────────────────────────────────────

function TargetCard({
  target,
  onSave,
  saving,
}: {
  target: TargetResult;
  onSave: (type: string, label: string) => void;
  saving: boolean;
}) {
  const [showEmail, setShowEmail] = useState(false);

  return (
    <div className={`card border rounded-xl overflow-hidden`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b border-current/10 ${TYPE_COLORS[target.type]}`}>
        <div className="flex items-center gap-2 font-semibold text-sm">
          {TYPE_ICONS[target.type]}
          {target.label}
        </div>
        <span className="text-xs opacity-70">{target.description}</span>
      </div>

      <div className="p-4 space-y-4">
        {/* LinkedIn search button */}
        <div className="flex items-center gap-3">
          <a
            href={target.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary flex-1 justify-center text-sm"
          >
            <ExternalLink size={14} />
            Search on LinkedIn
          </a>
          <button
            onClick={() => onSave(target.type, target.label)}
            disabled={saving}
            className="btn-secondary text-sm flex items-center gap-1.5"
            title="Save to tracker"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <BookmarkPlus size={14} />}
            Save
          </button>
        </div>

        {/* Connection note */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              LinkedIn Connection Note <span className="font-normal normal-case text-gray-400">(under 300 chars)</span>
            </p>
            <CopyButton text={target.messages.connectionNote} label="Connection note" />
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300 leading-relaxed border border-gray-200 dark:border-gray-700">
            {target.messages.connectionNote}
          </div>
        </div>

        {/* Email / InMail toggle */}
        <div className="space-y-1.5">
          <button
            onClick={() => setShowEmail(v => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hover:text-gray-700 dark:hover:text-gray-200 transition-colors w-full"
          >
            Email / InMail Template
            {showEmail ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showEmail && (
            <div className="space-y-2">
              {target.messages.emailSubject && (
                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/60 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700">
                  <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">Subject:</span>
                  <span className="text-sm text-gray-800 dark:text-gray-200 flex-1">{target.messages.emailSubject}</span>
                  <CopyButton text={target.messages.emailSubject} label="Subject line" />
                </div>
              )}
              <div className="relative bg-gray-50 dark:bg-gray-800/60 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300 leading-relaxed border border-gray-200 dark:border-gray-700 whitespace-pre-wrap">
                {target.messages.email}
                <div className="absolute top-2 right-2">
                  <CopyButton text={target.messages.email} label="Email body" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ReferralsPage() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);

  const [companyInput, setCompanyInput] = useState('');
  const [roleInput, setRoleInput] = useState('');
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [savingType, setSavingType] = useState<string | null>(null);
  const [filterCompany, setFilterCompany] = useState('');

  const targetCompanies: string[] = user?.targetCompanies ?? [];
  const targetRoles: string[] = user?.targetRoles ?? [];

  // ── Data queries ──────────────────────────────────────────────────────────

  const { data: contacts = [] } = useQuery<ReferralContact[]>({
    queryKey: ['referrals', filterCompany],
    queryFn: () => api.get('/referrals', { params: { company: filterCompany || undefined } }).then(r => r.data),
  });

  const { data: stats } = useQuery({
    queryKey: ['referral-stats'],
    queryFn: () => api.get('/referrals/stats').then(r => r.data),
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const generateMutation = useMutation({
    mutationFn: (body: { company: string; role?: string }) => api.post('/referrals/generate', body).then(r => r.data),
    onSuccess: (data: GenerateResult) => setResult(data),
    onError: () => toast.error('Failed to generate — try again'),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.post('/referrals', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['referrals'] });
      qc.invalidateQueries({ queryKey: ['referral-stats'] });
      toast.success('Saved to tracker');
      setSavingType(null);
    },
    onError: () => { toast.error('Failed to save'); setSavingType(null); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => api.patch(`/referrals/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['referrals'] }); toast.success('Updated'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/referrals/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['referrals'] });
      qc.invalidateQueries({ queryKey: ['referral-stats'] });
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    const company = companyInput.trim();
    if (!company) return;
    generateMutation.mutate({ company, role: roleInput.trim() || undefined });
  };

  const handleSave = (type: string, label: string) => {
    if (!result) return;
    setSavingType(type);
    saveMutation.mutate({
      targetCompany: result.company,
      contactRole: label,
      notes: `Auto-generated via Referral Finder. Target role: ${result.role}`,
    });
  };

  const handleChipClick = (company: string) => {
    setCompanyInput(company);
  };

  const handleRoleChipClick = (role: string) => {
    setRoleInput(role);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Zap size={24} className="text-brand-500" />
          Referral Finder
        </h1>
        <p className="page-subtitle mt-1">
          Enter a company to instantly find alumni, recruiters, and engineers — plus ready-to-send outreach messages.
        </p>
      </div>

      {/* ── Stats strip ── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Tracked', value: stats.total, color: 'text-gray-900 dark:text-gray-100' },
            { label: 'Contacted', value: stats.contacted, color: 'text-blue-600 dark:text-blue-400' },
            { label: 'Responded', value: stats.responded, color: 'text-green-600 dark:text-green-400' },
            { label: 'Meetings', value: stats.meetings, color: 'text-amber-600 dark:text-amber-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card p-4 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Generator form ── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Zap size={16} className="text-brand-500" />
          <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Find People to Reach Out To</span>
        </div>

        <form onSubmit={handleGenerate} className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label">Target Company</label>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  className="input pl-9"
                  placeholder="e.g. Google, Meta, Stripe…"
                  value={companyInput}
                  onChange={e => setCompanyInput(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="w-52">
              <label className="label">Target Role (optional)</label>
              <input
                className="input"
                placeholder="e.g. Software Engineer"
                value={roleInput}
                onChange={e => setRoleInput(e.target.value)}
              />
            </div>
          </div>

          {/* Company quick-chips */}
          {targetCompanies.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-gray-400 self-center mr-1">Your targets:</span>
              {targetCompanies.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleChipClick(c)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border
                    ${companyInput === c
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400'
                    }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {/* Role quick-chips */}
          {targetRoles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-gray-400 self-center mr-1">Your roles:</span>
              {targetRoles.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRoleChipClick(r)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border
                    ${roleInput === r
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400'
                    }`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}

          <button
            type="submit"
            disabled={generateMutation.isPending || !companyInput.trim()}
            className="btn-primary w-full justify-center"
          >
            {generateMutation.isPending
              ? <><Loader2 size={15} className="animate-spin" /> Generating…</>
              : <><Zap size={15} /> Find Alumni, Recruiters & Engineers</>
            }
          </button>
        </form>
      </div>

      {/* ── Results ── */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Results for <span className="text-brand-600 dark:text-brand-400">{result.company}</span>
              {result.role && <span className="text-gray-500 font-normal text-sm ml-1">· {result.role}</span>}
            </h2>
            <p className="text-xs text-gray-400">Click a LinkedIn button to open the search, then copy your outreach message.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-1">
            {result.targets.map(target => (
              <TargetCard
                key={target.type}
                target={target}
                onSave={handleSave}
                saving={savingType === target.type && saveMutation.isPending}
              />
            ))}
          </div>

          <div className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/40 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <strong>Tip:</strong> Click <em>Search on LinkedIn</em> to open the people search in a new tab.
            Personalize the connection note with their name before sending.
            Use the <em>Save</em> button to track your outreach progress.
          </div>
        </div>
      )}

      {/* ── Tracker ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Users size={16} />
            Outreach Tracker
          </h2>
          <div className="relative w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              className="input pl-8 text-sm h-8"
              placeholder="Filter by company…"
              value={filterCompany}
              onChange={e => setFilterCompany(e.target.value)}
            />
          </div>
        </div>

        <div className="card overflow-hidden">
          {contacts.length === 0 ? (
            <div className="py-14 text-center">
              <Users size={40} className="text-gray-200 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No contacts tracked yet.</p>
              <p className="text-gray-400 text-xs mt-1">Use the generator above and hit <strong>Save</strong> to start tracking.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    {['Company', 'Type / Role', 'University', 'Status', 'Notes', ''].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {contacts.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.targetCompany}</p>
                        {c.contactName && <p className="text-xs text-gray-400">{c.contactName}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{c.contactRole || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{c.university || '—'}</td>
                      <td className="px-4 py-3">
                        <select
                          className={`text-xs rounded px-2 py-1 border font-medium bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700`}
                          value={c.status}
                          onChange={e => updateMutation.mutate({ id: c.id, status: e.target.value })}
                        >
                          {STATUS_OPTIONS.map(s => (
                            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-xs text-gray-400 truncate">{c.notes || '—'}</p>
                        {c.linkedinUrl && (
                          <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline mt-0.5">
                            <ExternalLink size={11} /> LinkedIn
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteMutation.mutate(c.id)}
                          className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors"
                          title="Remove"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
