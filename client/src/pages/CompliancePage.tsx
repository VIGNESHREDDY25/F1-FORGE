import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, AlertTriangle, CheckCircle2, Calendar, Clock, Info, BookOpen } from 'lucide-react';
import api from '../api/client';
import type { OPTCompliance } from '../types';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

export default function CompliancePage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    optStartDate: '',
    optEndDate: '',
    employmentStartDate: '',
    stemOptEligible: false,
    stemOptStartDate: '',
    stemOptEndDate: '',
    usedFullTimeCpt: false,
  });

  const { data: compliance, isLoading } = useQuery<OPTCompliance | null>({
    queryKey: ['compliance'],
    queryFn: () => api.get('/compliance').then(r => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.post('/compliance', data),
    onSuccess: (res) => { qc.setQueryData(['compliance'], res.data); setShowForm(false); toast.success('Compliance data saved'); },
    onError: () => toast.error('Failed to save'),
  });

  if (isLoading) return <div className="animate-pulse space-y-4"><div className="h-32 bg-gray-200 rounded-xl" /></div>;

  const riskColors = { green: 'text-green-600 bg-green-50 border-green-200', yellow: 'text-amber-600 bg-amber-50 border-amber-200', red: 'text-red-600 bg-red-50 border-red-200' };
  const riskIcons = { green: CheckCircle2, yellow: AlertTriangle, red: AlertTriangle };

  // Grace period calculation
  const gracePeriodEnd = (() => {
    if (!compliance?.optEndDate) return null;
    const end = new Date(compliance.optEndDate);
    end.setDate(end.getDate() + 60);
    return end;
  })();

  // OPT countdown color
  const optCountdownColor = (() => {
    const days = compliance?.daysUntilOptEnd ?? 0;
    if (days > 90) return { bg: 'bg-green-500', text: 'text-green-700', bg2: 'bg-green-50', border: 'border-green-200' };
    if (days > 30) return { bg: 'bg-amber-400', text: 'text-amber-700', bg2: 'bg-amber-50', border: 'border-amber-200' };
    return { bg: 'bg-red-500', text: 'text-red-700', bg2: 'bg-red-50', border: 'border-red-200' };
  })();

  // H1B countdown
  const h1bDaysRemaining = (() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    let nextMarch1 = new Date(currentYear, 2, 1); // March 1
    if (today >= nextMarch1) nextMarch1 = new Date(currentYear + 1, 2, 1);
    const diff = Math.ceil((nextMarch1.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return { days: diff, year: nextMarch1.getFullYear() };
  })();

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">OPT/CPT Compliance</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Track your authorization status and never miss a deadline.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          {compliance ? 'Update Dates' : 'Set Up Tracker'}
        </button>
      </div>

      {!compliance ? (
        <div className="card p-10 text-center">
          <Shield size={48} className="text-gray-200 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700 dark:text-gray-300">Set up your OPT tracker</h3>
          <p className="text-gray-400 text-sm mt-1">Enter your OPT dates to track deadlines and unemployment days.</p>
          <button onClick={() => setShowForm(true)} className="btn-primary mt-4">Get Started</button>
        </div>
      ) : (
        <>
          {/* Risk status */}
          {(() => {
            const RiskIcon = riskIcons[compliance.riskStatus];
            return (
              <div className={`card p-5 border ${riskColors[compliance.riskStatus]}`}>
                <div className="flex items-center gap-3">
                  <RiskIcon size={24} />
                  <div>
                    <p className="font-semibold capitalize">
                      {compliance.riskStatus === 'green' ? "You're in good standing" : compliance.riskStatus === 'yellow' ? 'Action recommended soon' : 'Immediate attention required'}
                    </p>
                    <p className="text-sm mt-0.5 opacity-80">
                      {compliance.unemploymentDaysRemaining} unemployment days remaining · {compliance.daysUntilOptEnd} days until OPT end
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* OPT Countdown Banner */}
          <div className={`card p-5 border ${optCountdownColor.bg2} ${optCountdownColor.border}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">OPT Authorization Countdown</p>
                <p className={`text-4xl font-bold ${optCountdownColor.text}`}>{compliance.daysUntilOptEnd}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">days remaining on your OPT</p>
              </div>
              <div className="relative w-24 h-24 shrink-0">
                <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-gray-200" strokeWidth="2.5" />
                  <circle
                    cx="18" cy="18" r="15.9" fill="none"
                    className={clsx(
                      'transition-all duration-700',
                      compliance.daysUntilOptEnd > 90 ? 'stroke-green-500' : compliance.daysUntilOptEnd > 30 ? 'stroke-amber-400' : 'stroke-red-500'
                    )}
                    strokeWidth="2.5"
                    strokeDasharray={`${Math.max(0, Math.min(100, (compliance.daysUntilOptEnd / 365) * 100))} 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-xs font-bold ${optCountdownColor.text}`}>
                    {Math.round((compliance.daysUntilOptEnd / 365) * 100)}%
                  </span>
                </div>
              </div>
            </div>
            {compliance.daysUntilOptEnd < 30 && (
              <div className="mt-3 flex items-center gap-2 p-2 bg-red-100 rounded-lg border border-red-200">
                <AlertTriangle size={14} className="text-red-600 shrink-0" />
                <p className="text-xs text-red-700 font-medium">Less than 30 days left! Start your STEM OPT extension or H1B process immediately.</p>
              </div>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-4">
            <UnemploymentRing
              used={compliance.unemploymentDaysUsed}
              max={compliance.stemOptEligible ? 150 : 90}
              danger={compliance.unemploymentDaysUsed > (compliance.stemOptEligible ? 135 : 75)}
              warning={compliance.unemploymentDaysUsed > (compliance.stemOptEligible ? 120 : 60)}
            />
            <MetricCard
              label="Days Until OPT End"
              value={compliance.daysUntilOptEnd}
              unit="days"
              danger={compliance.daysUntilOptEnd < 14}
              warning={compliance.daysUntilOptEnd < 30}
            />
            <MetricCard
              label="Unemployment Days Left"
              value={compliance.unemploymentDaysRemaining}
              max={compliance.stemOptEligible ? 150 : 90}
              unit="days"
              danger={compliance.unemploymentDaysRemaining < 15}
              warning={compliance.unemploymentDaysRemaining < 30}
            />
          </div>

          {/* Grace Period Card */}
          <div className="card p-5 border border-blue-200 bg-blue-50">
            <div className="flex items-start gap-3">
              <Info size={20} className="text-blue-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">60-Day Grace Period</h3>
                <p className="text-sm text-blue-700 mb-3">
                  After your OPT ends, you have a 60-day grace period during which you must depart the US, apply for a change of status, or begin another authorized stay.
                </p>
                {gracePeriodEnd ? (
                  <div className="flex items-center gap-3">
                    <div className="bg-white dark:bg-gray-900 rounded-lg px-3 py-2 border border-blue-200 text-center">
                      <p className="text-xs text-blue-500 font-medium">Grace Period Ends</p>
                      <p className="text-sm font-bold text-blue-900 mt-0.5">
                        {gracePeriodEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <p className="text-xs text-blue-600">
                      You cannot work during this period. Use it to transfer to a new visa status or prepare for departure.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-blue-600 italic">Set your OPT end date to see grace period calculation.</p>
                )}
              </div>
            </div>
          </div>

          {/* Key Rules Section */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <BookOpen size={16} className="text-brand-600" /> Key OPT Compliance Rules
            </h3>
            <div className="grid grid-cols-1 gap-2.5">
              {[
                { rule: 'Report employment changes to your DSO within 10 days', icon: '⏱️', critical: false },
                { rule: 'Maximum 90 days unemployment during standard OPT', icon: '📅', critical: true },
                { rule: 'STEM OPT extension: Maximum 150 days total unemployment (90 + 60 additional)', icon: '🔬', critical: false },
                { rule: 'Must be employed full-time (minimum 40 hours/week)', icon: '💼', critical: false },
                { rule: 'Report address changes to your DSO within 10 days', icon: '🏠', critical: false },
                { rule: 'Cannot be unemployed for more than 90 consecutive days at any time', icon: '⚠️', critical: true },
              ].map(({ rule, icon, critical }, i) => (
                <div key={i} className={clsx('flex items-start gap-3 p-3 rounded-lg', critical ? 'bg-red-50 border border-red-100' : 'bg-gray-50')}>
                  <span className="text-base shrink-0">{icon}</span>
                  <p className={clsx('text-sm', critical ? 'text-red-800 font-medium' : 'text-gray-700')}>{rule}</p>
                  {critical && <span className="ml-auto shrink-0 text-xs bg-red-100 text-red-600 font-semibold px-1.5 py-0.5 rounded">Critical</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2"><Calendar size={16} /> Key Dates</h3>
            <div className="space-y-3">
              {compliance.timelines.map((t, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className={clsx('w-3 h-3 rounded-full shrink-0', t.type === 'deadline' ? 'bg-red-400' : t.type === 'warning' ? 'bg-amber-400' : 'bg-green-400')} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.label}</p>
                    <p className="text-xs text-gray-400">{new Date(t.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* H1B Lottery */}
          <div className="card p-5 bg-brand-50 border-brand-200">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-brand-900">H1B Lottery {new Date(compliance.nextH1bLottery.registrationStart).getFullYear()}</h3>
              <div className="text-right">
                <p className="text-xs text-brand-600 font-medium">Registration opens in</p>
                <p className="text-2xl font-bold text-brand-800">{h1bDaysRemaining.days}<span className="text-sm font-normal ml-1">days</span></p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Registration Opens', date: compliance.nextH1bLottery.registrationStart },
                { label: 'Registration Closes', date: compliance.nextH1bLottery.registrationEnd },
                { label: 'Lottery Date', date: compliance.nextH1bLottery.lotterDate },
              ].map(({ label, date }) => (
                <div key={label} className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-brand-100">
                  <p className="text-xs text-brand-600 font-medium">{label}</p>
                  <p className="text-sm font-bold text-brand-900 mt-1">
                    {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-xs text-brand-600 mt-3">
              The H1B cap-subject lottery opens March 1 each year. You must have a sponsoring employer to file. Registration fee: $215.
            </p>
          </div>

          {/* Manual unemployment day counter */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2"><Clock size={16} /> Update Unemployment Days</h3>
            <div className="flex items-center gap-3">
              <input
                type="number"
                className="input w-32"
                min={0}
                max={90}
                defaultValue={compliance.unemploymentDaysUsed}
                id="unemploymentDays"
              />
              <button
                onClick={() => {
                  const val = parseInt((document.getElementById('unemploymentDays') as HTMLInputElement).value);
                  api.patch('/compliance/unemployment-days', { days: val })
                    .then(r => { qc.setQueryData(['compliance'], r.data); toast.success('Updated'); })
                    .catch(() => toast.error('Failed'));
                }}
                className="btn-primary"
              >
                Update
              </button>
              <p className="text-xs text-gray-400">Track your actual unemployment days</p>
            </div>
          </div>
        </>
      )}

      {/* Setup/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">OPT Details</h2>
            <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">OPT Start Date</label>
                  <input type="date" className="input" required value={form.optStartDate} onChange={e => setForm({ ...form, optStartDate: e.target.value })} />
                </div>
                <div>
                  <label className="label">OPT End Date</label>
                  <input type="date" className="input" required value={form.optEndDate} onChange={e => setForm({ ...form, optEndDate: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Employment Start Date</label>
                <input type="date" className="input" value={form.employmentStartDate} onChange={e => setForm({ ...form, employmentStartDate: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="stemOpt" checked={form.stemOptEligible} onChange={e => setForm({ ...form, stemOptEligible: e.target.checked })} className="rounded" />
                <label htmlFor="stemOpt" className="text-sm text-gray-700 dark:text-gray-300 font-medium">STEM OPT Eligible</label>
              </div>
              {form.stemOptEligible && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">STEM OPT Start</label>
                    <input type="date" className="input" value={form.stemOptStartDate} onChange={e => setForm({ ...form, stemOptStartDate: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">STEM OPT End</label>
                    <input type="date" className="input" value={form.stemOptEndDate} onChange={e => setForm({ ...form, stemOptEndDate: e.target.value })} />
                  </div>
                </div>
              )}

              {/* CPT History */}
              <div className="border-t pt-3 mt-1">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">CPT History</p>
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="usedFullTimeCpt"
                    checked={form.usedFullTimeCpt}
                    onChange={e => setForm({ ...form, usedFullTimeCpt: e.target.checked })}
                    className="rounded mt-0.5"
                  />
                  <label htmlFor="usedFullTimeCpt" className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                    I have used 12+ months of full-time CPT
                  </label>
                </div>
                {form.usedFullTimeCpt && (
                  <div className="mt-2 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">
                      <strong>Warning:</strong> Using 12 or more months of full-time CPT makes you ineligible for OPT. Contact your DSO immediately to discuss your options.
                    </p>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1">Part-time CPT does not count toward this limit.</p>
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saveMutation.isPending} className="btn-primary flex-1">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function UnemploymentRing({ used, max, danger, warning }: { used: number; max: number; danger?: boolean; warning?: boolean }) {
  const pct = Math.min((used / max) * 100, 100);
  const colorClass = danger ? 'stroke-red-500' : warning ? 'stroke-amber-400' : 'stroke-green-500';
  const textColor = danger ? 'text-red-600' : warning ? 'text-amber-600' : 'text-gray-900';
  const bgClass = danger ? 'border-red-200 bg-red-50' : warning ? 'border-amber-200 bg-amber-50' : '';

  return (
    <div className={clsx('card p-4 flex flex-col items-center', bgClass)}>
      <div className="relative w-20 h-20 mb-2">
        <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-gray-200" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="15.9" fill="none"
            className={`${colorClass} transition-all duration-700`}
            strokeWidth="3"
            strokeDasharray={`${pct} 100`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-lg font-bold leading-none ${textColor}`}>{used}</span>
          <span className="text-xs text-gray-400">/{max}</span>
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">Unemployment Days Used</p>
      <div className="mt-1.5 w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full', danger ? 'bg-red-500' : warning ? 'bg-amber-400' : 'bg-green-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MetricCard({ label, value, max, danger, warning }: { label: string; value: number; max?: number; unit?: string; danger?: boolean; warning?: boolean }) {
  return (
    <div className={clsx('card p-4', danger ? 'border-red-200 bg-red-50' : warning ? 'border-amber-200 bg-amber-50' : '')}>
      <p className={clsx('text-2xl font-bold', danger ? 'text-red-600' : warning ? 'text-amber-600' : 'text-gray-900')}>
        {value}
        {max && <span className="text-sm font-normal text-gray-400">/{max}</span>}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
      {max && (
        <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className={clsx('h-full rounded-full', danger ? 'bg-red-500' : warning ? 'bg-amber-400' : 'bg-green-500')}
            style={{ width: `${Math.min((value / max) * 100, 100)}%` }} />
        </div>
      )}
    </div>
  );
}
