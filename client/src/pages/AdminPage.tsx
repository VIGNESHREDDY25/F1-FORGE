import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Briefcase,
  FileText,
  Search,
  X,
  ChevronRight,
  ShieldAlert,
  TrendingUp,
  Calendar,
  GraduationCap,
  Mail,
  BarChart2,
  BookOpen,
} from 'lucide-react';
import api from '../api/client';
import { formatDistanceToNow } from 'date-fns';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AdminStats {
  totalUsers: number;
  totalApplications: number;
  totalResumesOptimized: number;
  signupsPerWeek: { week: string; count: number }[];
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  university: string | null;
  major: string | null;
  createdAt: string;
  applicationCount: number;
  resumeCount: number;
}

interface UserDetail {
  profile: Record<string, any>;
  jobApplications: any[];
  resumeOptimizations: any[];
  referralContacts: any[];
  optCompliance: any[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="card flex items-start gap-4 p-5">
      <div className="p-2.5 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-50 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Detail Drawer ──────────────────────────────────────────────────────────────

function UserDetailDrawer({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useQuery<UserDetail>({
    queryKey: ['admin-user', userId],
    queryFn: () => api.get(`/admin/users/${userId}`).then((r) => r.data),
    retry: 1,
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-2xl h-full bg-white dark:bg-gray-900 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">User Detail</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <ShieldAlert size={40} className="text-red-400" />
              <p className="text-gray-700 dark:text-gray-300 font-medium">Failed to load user data</p>
            </div>
          )}

          {data && (
            <>
              {/* Profile */}
              <section>
                <SectionTitle icon={<Users size={15} />} title="Profile" />
                <div className="card p-4 space-y-3">
                  <ProfileRow label="Email" value={data.profile.email} />
                  <ProfileRow
                    label="Name"
                    value={
                      [data.profile.firstName, data.profile.lastName]
                        .filter(Boolean)
                        .join(' ') || '—'
                    }
                  />
                  <ProfileRow label="University" value={data.profile.university || '—'} />
                  <ProfileRow label="Major" value={data.profile.major || '—'} />
                  <ProfileRow label="Visa Type" value={data.profile.visaType || '—'} />
                  <ProfileRow label="Graduation" value={data.profile.graduationDate || '—'} />
                  {data.profile.targetRoles?.length > 0 && (
                    <ProfileRow
                      label="Target Roles"
                      value={
                        <div className="flex flex-wrap gap-1">
                          {data.profile.targetRoles.map((r: string, i: number) => (
                            <span key={i} className="badge-blue">{r}</span>
                          ))}
                        </div>
                      }
                    />
                  )}
                  {data.profile.targetCompanies?.length > 0 && (
                    <ProfileRow
                      label="Target Companies"
                      value={
                        <div className="flex flex-wrap gap-1">
                          {data.profile.targetCompanies.map((c: string, i: number) => (
                            <span key={i} className="badge-purple">{c}</span>
                          ))}
                        </div>
                      }
                    />
                  )}
                  <ProfileRow
                    label="Joined"
                    value={
                      data.profile.createdAt
                        ? new Date(data.profile.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })
                        : '—'
                    }
                  />
                </div>
              </section>

              {/* Job Applications */}
              <section>
                <SectionTitle
                  icon={<Briefcase size={15} />}
                  title={`Job Applications (${data.jobApplications.length})`}
                />
                {data.jobApplications.length === 0 ? (
                  <EmptyState text="No applications yet" />
                ) : (
                  <div className="space-y-2">
                    {data.jobApplications.map((app: any) => (
                      <div
                        key={app.id}
                        className="card p-3 flex items-center gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                            {app.company} — {app.role}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {app.appliedDate
                              ? `Applied ${new Date(app.appliedDate).toLocaleDateString()}`
                              : 'No applied date'}
                          </p>
                        </div>
                        <span
                          className={`badge shrink-0 ${
                            app.stage === 'offer'
                              ? 'badge-green'
                              : app.stage === 'rejected'
                              ? 'badge-red'
                              : app.stage === 'interview'
                              ? 'badge-purple'
                              : app.stage === 'assessment'
                              ? 'badge-yellow'
                              : 'badge-gray'
                          }`}
                        >
                          {app.stage}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Resume Optimizations */}
              <section>
                <SectionTitle
                  icon={<FileText size={15} />}
                  title={`Resume Optimizations (${data.resumeOptimizations.length})`}
                />
                {data.resumeOptimizations.length === 0 ? (
                  <EmptyState text="No resume optimizations yet" />
                ) : (
                  <div className="space-y-3">
                    {data.resumeOptimizations.map((opt: any, idx: number) => (
                      <div key={opt.id ?? idx} className="card p-4 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {opt.createdAt
                              ? formatDistanceToNow(new Date(opt.createdAt), { addSuffix: true })
                              : '—'}
                          </p>
                          {opt.atsScore != null && (
                            <span
                              className={`badge ${
                                opt.atsScore >= 80
                                  ? 'badge-green'
                                  : opt.atsScore >= 60
                                  ? 'badge-yellow'
                                  : 'badge-red'
                              }`}
                            >
                              ATS {opt.atsScore}%
                            </span>
                          )}
                        </div>

                        {opt.jobDescription && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                              Job Description
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                              {opt.jobDescription}
                            </p>
                          </div>
                        )}

                        {opt.resumeText && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                              Resume Text
                            </p>
                            <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 rounded-lg p-3 max-h-48 overflow-y-auto font-mono leading-relaxed border border-gray-200 dark:border-gray-700">
                              {opt.resumeText}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Referral Contacts */}
              {data.referralContacts.length > 0 && (
                <section>
                  <SectionTitle
                    icon={<Mail size={15} />}
                    title={`Referral Contacts (${data.referralContacts.length})`}
                  />
                  <div className="space-y-2">
                    {data.referralContacts.map((c: any) => (
                      <div key={c.id} className="card p-3">
                        <p className="font-medium text-sm text-gray-900 dark:text-gray-100">
                          {c.targetCompany}
                          {c.contactName ? ` — ${c.contactName}` : ''}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Status: {c.status?.replace(/_/g, ' ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* OPT Compliance */}
              {data.optCompliance.length > 0 && (
                <section>
                  <SectionTitle
                    icon={<Calendar size={15} />}
                    title="OPT Compliance"
                  />
                  <div className="space-y-2">
                    {data.optCompliance.map((o: any) => (
                      <div key={o.id} className="card p-3 space-y-1">
                        <ProfileRow label="OPT Start" value={o.optStartDate || '—'} />
                        <ProfileRow label="OPT End" value={o.optEndDate || '—'} />
                        <ProfileRow
                          label="Risk"
                          value={
                            <span
                              className={`badge ${
                                o.riskStatus === 'green'
                                  ? 'badge-green'
                                  : o.riskStatus === 'yellow'
                                  ? 'badge-yellow'
                                  : 'badge-red'
                              }`}
                            >
                              {o.riskStatus}
                            </span>
                          }
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tiny helpers ───────────────────────────────────────────────────────────────

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-brand-500 dark:text-brand-400">{icon}</span>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
    </div>
  );
}

function ProfileRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="w-32 shrink-0 text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-gray-900 dark:text-gray-100 break-all">{value}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="card p-4 text-center text-sm text-gray-500 dark:text-gray-400">{text}</div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Stats
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
  } = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then((r) => r.data),
    retry: 1,
  });

  // Users list
  const {
    data: users = [],
    isLoading: usersLoading,
    isError: usersError,
    error: usersErrorObj,
  } = useQuery<AdminUser[]>({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then((r) => r.data),
    retry: 1,
  });

  // 403 check
  const is403 =
    (statsError || usersError) &&
    (usersErrorObj as any)?.response?.status === 403;

  if (is403) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <ShieldAlert size={48} className="text-red-400" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Admin Access Required</h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-sm">
          You do not have permission to view this page. Contact the platform owner if you believe
          this is a mistake.
        </p>
      </div>
    );
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.university ?? '').toLowerCase().includes(q) ||
      (u.major ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
          <ShieldAlert size={22} />
        </div>
        <div>
          <h1 className="page-title">Admin Panel</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Platform-wide data — access strictly controlled
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<Users size={20} />}
          label="Total Users"
          value={statsLoading ? '…' : (stats?.totalUsers ?? '—')}
          sub="registered accounts"
        />
        <StatCard
          icon={<Briefcase size={20} />}
          label="Total Applications"
          value={statsLoading ? '…' : (stats?.totalApplications ?? '—')}
          sub="across all users"
        />
        <StatCard
          icon={<FileText size={20} />}
          label="Resumes Optimized"
          value={statsLoading ? '…' : (stats?.totalResumesOptimized ?? '—')}
          sub="optimization runs"
        />
      </div>

      {/* Signups per week sparkline */}
      {stats && stats.signupsPerWeek.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-brand-500 dark:text-brand-400" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Signups — Last 8 Weeks
            </h2>
          </div>
          <div className="flex items-end gap-2 h-20">
            {stats.signupsPerWeek.map((w) => {
              const max = Math.max(...stats.signupsPerWeek.map((x) => x.count), 1);
              const pct = (w.count / max) * 100;
              return (
                <div key={w.week} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">{w.count}</span>
                  <div
                    className="w-full rounded-t bg-brand-500 dark:bg-brand-400 transition-all"
                    style={{ height: `${Math.max(pct, 4)}%` }}
                  />
                  <span className="text-[9px] text-gray-400 dark:text-gray-500 truncate w-full text-center">
                    {w.week}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="card overflow-hidden p-0">
        {/* Table header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <BarChart2 size={16} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              All Users
              {!usersLoading && (
                <span className="ml-2 text-xs font-normal text-gray-400">
                  {filtered.length} / {users.length}
                </span>
              )}
            </h2>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search users…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-8 py-1.5 text-sm w-56"
            />
          </div>
        </div>

        {usersLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
          </div>
        )}

        {usersError && !is403 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
            <ShieldAlert size={32} className="text-red-400" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Failed to load users</p>
          </div>
        )}

        {!usersLoading && !usersError && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <BookOpen size={32} className="text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No users found</p>
          </div>
        )}

        {!usersLoading && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-100 dark:border-gray-800">
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">School</th>
                  <th className="px-4 py-3 font-medium text-center">Apps</th>
                  <th className="px-4 py-3 font-medium text-center">Resumes</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer transition-colors group"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 flex items-center justify-center font-semibold text-sm shrink-0 select-none">
                          {(u.name?.[0] ?? u.email[0]).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            {u.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                        <GraduationCap size={14} className="text-gray-400 shrink-0" />
                        <span className="truncate max-w-[160px]">
                          {u.university || <span className="text-gray-400">—</span>}
                        </span>
                      </div>
                      {u.major && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate max-w-[160px]">
                          {u.major}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="badge-blue">{u.applicationCount}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="badge-gray">{u.resumeCount}</span>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                      {u.createdAt
                        ? formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })
                        : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <ChevronRight
                        size={16}
                        className="text-gray-300 dark:text-gray-600 group-hover:text-brand-500 dark:group-hover:text-brand-400 transition-colors"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selectedUserId && (
        <UserDetailDrawer
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
}
