import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Briefcase, Shield, FileText, Bot, Users, Mic, Code2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Clock, ExternalLink, Rss, Search, Zap } from 'lucide-react';
import api from '../api/client';
import type { DashboardData } from '../types';
import { useAuthStore } from '../store/authStore';
import { formatDistanceToNow } from 'date-fns';

const NEWS_CATEGORIES = ['All', 'Immigration', 'Tech Jobs', 'AI/Tech', 'Career', 'Security'] as const;
type NewsCategory = typeof NEWS_CATEGORIES[number];

export default function DashboardPage() {
  const user = useAuthStore(s => s.user);
  const [newsCategory, setNewsCategory] = useState<NewsCategory>('All');

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then(r => r.data),
  });

  const { data: newsArticles = [] } = useQuery<any[]>({
    queryKey: ['news'],
    queryFn: () => api.get('/news').then(r => r.data),
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) return <PageSkeleton />;

  const apps = data?.applications;
  const weekTrend = apps ? apps.thisWeek - apps.lastWeek : 0;
  const f1News = newsArticles.filter(a => a.isF1Relevant);
  const profilePct = data?.user?.profileCompletePct ?? user?.profileCompletePct ?? 0;

  const filteredNews = newsCategory === 'All'
    ? newsArticles
    : newsArticles.filter(a => a.category === newsCategory);

  // H1B countdown calculation
  const h1bCountdown = (() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    let nextMarch1 = new Date(currentYear, 2, 1);
    if (today >= nextMarch1) nextMarch1 = new Date(currentYear + 1, 2, 1);
    return {
      days: Math.ceil((nextMarch1.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      year: nextMarch1.getFullYear(),
    };
  })();

  // Today's actions
  const todaysActions: { type: 'urgent' | 'warning' | 'info'; message: string; href: string; label: string }[] = [];
  if ((apps?.followUpsToday ?? 0) > 0) {
    todaysActions.push({ type: 'urgent', message: `${apps!.followUpsToday} follow-up${apps!.followUpsToday > 1 ? 's' : ''} due today`, href: '/jobs', label: 'View Jobs' });
  }
  if (data?.optDaysRemaining != null && data.optDaysRemaining < 30) {
    todaysActions.push({ type: 'urgent', message: `OPT expires in ${data.optDaysRemaining} days — take action now!`, href: '/compliance', label: 'View Compliance' });
  }
  if (data?.optDaysRemaining == null) {
    todaysActions.push({ type: 'info', message: 'Set up your OPT compliance tracker to monitor deadlines', href: '/compliance', label: 'Set Up Now' });
  }
  if (profilePct < 80) {
    todaysActions.push({ type: 'warning', message: `Profile is ${profilePct}% complete — finish it to unlock personalized recommendations`, href: '/profile', label: 'Complete Profile' });
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Good morning, {data?.user?.firstName || user?.firstName} 👋
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Here's your career progress at a glance.</p>
      </div>

      {/* Live News Feed — hero section, top of dashboard */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
            </span>
            Live News Feed
            <span className="text-xs font-normal text-gray-400 dark:text-gray-500">· immigration &amp; tech, updated continuously</span>
          </h2>
          <div className="flex items-center gap-2">
            {f1News.length > 0 && (
              <span className="badge badge-blue">{f1News.length} visa/career relevant</span>
            )}
            {newsArticles.length === 0 && (
              <span className="text-xs text-gray-400">Loading…</span>
            )}
          </div>
        </div>

        {/* Category filter bar */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          {NEWS_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setNewsCategory(cat)}
              className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                newsCategory === cat
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-brand-300 hover:text-brand-600'
              }`}
            >
              {cat}
              {cat !== 'All' && newsArticles.filter(a => a.category === cat).length > 0 && (
                <span className={`ml-1.5 ${newsCategory === cat ? 'text-brand-200' : 'text-gray-400'}`}>
                  {newsArticles.filter(a => a.category === cat).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {newsArticles.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => <NewsCardSkeleton key={i} />)}
          </div>
        ) : filteredNews.length === 0 ? (
          <div className="py-10 text-center">
            <Rss size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No {newsCategory} articles right now</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredNews.slice(0, 24).map(a => <NewsCard key={a.id} article={a} />)}
          </div>
        )}
      </div>

      {/* Today's Actions */}
      {todaysActions.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Zap size={16} className="text-amber-500" /> Today's Actions
          </h2>
          <div className="space-y-2">
            {todaysActions.map((action, i) => (
              <div
                key={i}
                className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${
                  action.type === 'urgent'
                    ? 'bg-red-50 border-red-200'
                    : action.type === 'warning'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {action.type === 'urgent' ? (
                    <AlertTriangle size={15} className="text-red-500 shrink-0" />
                  ) : action.type === 'warning' ? (
                    <AlertTriangle size={15} className="text-amber-500 shrink-0" />
                  ) : (
                    <CheckCircle2 size={15} className="text-blue-500 shrink-0" />
                  )}
                  <p className={`text-sm font-medium ${
                    action.type === 'urgent' ? 'text-red-800' : action.type === 'warning' ? 'text-amber-800' : 'text-blue-800'
                  }`}>{action.message}</p>
                </div>
                <Link
                  to={action.href}
                  className={`text-xs font-semibold shrink-0 px-2.5 py-1 rounded-md ${
                    action.type === 'urgent'
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : action.type === 'warning'
                      ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  }`}
                >
                  {action.label}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profile completion banner */}
      {profilePct < 80 && (
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-brand-800 text-sm">Complete your profile</p>
            <p className="text-brand-600 text-xs mt-0.5">{profilePct}% complete — unlock personalized recommendations</p>
          </div>
          <Link to="/profile" className="btn-primary text-xs py-1.5 px-3">Complete Profile</Link>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Applications this week" value={apps?.thisWeek ?? 0} trend={weekTrend} icon={<Briefcase size={18} className="text-brand-600" />} href="/jobs" />
        <StatCard label="Active interviews" value={apps?.inInterview ?? 0} icon={<Mic size={18} className="text-purple-600" />} href="/jobs" highlight />
        <StatCard label="OPT days remaining" value={data?.optDaysRemaining != null ? `${data.optDaysRemaining}/90` : '—'} icon={<Shield size={18} className={riskColor(data?.compliance?.riskStatus)} />} href="/compliance" status={data?.compliance?.riskStatus} />
        <StatCard label="Resume ATS score" value={data?.latestResumeScore != null ? `${data.latestResumeScore}%` : '—'} icon={<FileText size={18} className="text-green-600" />} href="/resume" />
      </div>

      {/* H1B Countdown stat card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Link
          to="/compliance"
          className="card p-4 hover:shadow-md transition-shadow border-brand-200 bg-gradient-to-br from-brand-50 to-indigo-50 col-span-1"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-lg bg-white border border-brand-100 flex items-center justify-center shadow-sm text-lg">🎫</div>
          </div>
          <p className="text-3xl font-bold text-brand-800">
            {h1bCountdown.days}
            <span className="text-base font-normal text-brand-600 ml-1">days</span>
          </p>
          <p className="text-xs text-brand-600 font-semibold mt-0.5">Until H1B Registration Opens</p>
          <p className="text-xs text-gray-500 mt-0.5">March 1, {h1bCountdown.year} — Start finding sponsors now</p>
        </Link>

        <div className="lg:col-span-2 grid grid-cols-1 gap-4">
          {/* empty space placeholder — the main content below fills the rest of the row */}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick actions */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Actions</h2>
          <div className="space-y-1.5">
            {[
              { label: 'Track a new application', href: '/jobs', icon: Briefcase, color: 'text-brand-600 bg-brand-50' },
              { label: 'Search jobs (LinkedIn)', href: '/job-discovery', icon: Search, color: 'text-indigo-600 bg-indigo-50' },
              { label: 'Optimize your resume', href: '/resume', icon: FileText, color: 'text-green-600 bg-green-50' },
              { label: 'Ask the AI assistant', href: '/assistant', icon: Bot, color: 'text-purple-600 bg-purple-50' },
              { label: 'Practice DSA & coding', href: '/practice', icon: Code2, color: 'text-orange-600 bg-orange-50' },
              { label: 'Find alumni referrals', href: '/referrals', icon: Users, color: 'text-teal-600 bg-teal-50' },
            ].map(({ label, href, icon: Icon, color }) => (
              <Link key={href} to={href} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}><Icon size={15} /></div>
                <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">{label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Notifications</h2>
          {data?.notifications?.length ? (
            <div className="space-y-2">
              {data.notifications.slice(0, 5).map(n => (
                <div key={n.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${n.type.includes('alert') || n.type.includes('opt') ? 'bg-red-500' : 'bg-brand-500'}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{n.title}</p>
                    {n.message && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{n.message}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 size={36} className="text-green-400 mb-2" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">You're all caught up!</p>
            </div>
          )}
          {(apps?.followUpsToday ?? 0) > 0 && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
              <Clock size={16} className="text-amber-500" />
              <p className="text-sm text-amber-800 font-medium">{apps!.followUpsToday} follow-up{apps!.followUpsToday > 1 ? 's' : ''} due today</p>
              <Link to="/jobs" className="ml-auto text-xs text-brand-600 hover:underline">View →</Link>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

// Deterministic gradient per source so the fallback banner looks intentional, not broken.
const NEWS_GRADIENTS = [
  'from-blue-500 to-indigo-600', 'from-violet-500 to-purple-600', 'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600', 'from-rose-500 to-pink-600', 'from-cyan-500 to-blue-600',
  'from-fuchsia-500 to-purple-600', 'from-lime-500 to-emerald-600',
];
function gradientFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return NEWS_GRADIENTS[h % NEWS_GRADIENTS.length];
}

function NewsImage({ article }: { article: any }) {
  const [error, setError] = useState(false);
  const grad = gradientFor(article.title || article.id || article.source || 'news');
  const showReal = article.image && !error;
  return (
    <div className="h-36 relative overflow-hidden">
      {/* Branded gradient always sits underneath — guarantees a visual for every article */}
      <div className={`absolute inset-0 bg-gradient-to-br ${grad} flex items-center justify-center`}>
        <span className="text-white/95 font-bold text-2xl tracking-tight drop-shadow-sm px-3 text-center line-clamp-2">
          {article.source || 'News'}
        </span>
        <Rss size={16} className="absolute top-2 right-2 text-white/70" />
      </div>
      {showReal && (
        <img
          src={article.image}
          alt=""
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={() => setError(true)}
        />
      )}
      <span className="absolute bottom-2 left-2 z-10 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-black/55 text-white backdrop-blur-sm">
        {article.category}
      </span>
    </div>
  );
}

function NewsCard({ article }: { article: any; compact?: boolean }) {
  const timeAgo = (() => {
    try { return formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true }); } catch { return ''; }
  })();

  return (
    <a href={article.url} target="_blank" rel="noopener noreferrer"
      className="card-hover overflow-hidden group flex flex-col">
      <NewsImage article={article} />
      <div className="p-3 flex flex-col flex-1">
        <div className="flex items-center gap-1.5 mb-1.5">
          {article.sourceIcon && (
            <img src={article.sourceIcon} alt="" className="w-3.5 h-3.5 rounded-sm"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{article.source}</span>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">{timeAgo}</span>
        </div>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{article.title}</p>
        {article.summary && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{article.summary}</p>
        )}
        <div className="flex items-center gap-1 mt-2 flex-wrap pt-2 mt-auto">
          {article.isF1Relevant && <span className="badge badge-blue text-xs">🎓 F1 relevant</span>}
          <ExternalLink size={11} className="text-gray-400 ml-auto group-hover:text-brand-500 transition-colors" />
        </div>
      </div>
    </a>
  );
}

function NewsCardSkeleton() {
  return (
    <div className="card overflow-hidden animate-pulse">
      <div className="h-36 bg-gray-200 dark:bg-gray-800" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/3" />
        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
      </div>
    </div>
  );
}

function StatCard({ label, value, trend, icon, href, highlight, status }: {
  label: string; value: string | number; trend?: number; icon: React.ReactNode;
  href: string; highlight?: boolean; status?: 'green' | 'yellow' | 'red';
}) {
  return (
    <Link to={href} className={`card p-4 hover:shadow-md transition-shadow ${highlight ? 'border-brand-200 bg-brand-50' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="w-9 h-9 rounded-lg bg-white border border-gray-100 flex items-center justify-center shadow-sm">{icon}</div>
        {trend !== undefined && trend !== 0 && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${trend > 0 ? 'text-green-600' : 'text-red-500'}`}>
            {trend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{Math.abs(trend)}
          </span>
        )}
        {status === 'red' && <AlertTriangle size={14} className="text-red-500" />}
        {status === 'yellow' && <AlertTriangle size={14} className="text-amber-500" />}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </Link>
  );
}

function riskColor(status?: 'green' | 'yellow' | 'red') {
  if (status === 'red') return 'text-red-600';
  if (status === 'yellow') return 'text-amber-500';
  return 'text-green-600';
}

function PageSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
      <div className="h-8 w-64 bg-gray-200 rounded" />
      <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-gray-200 rounded-xl" />)}</div>
      <div className="grid grid-cols-3 gap-4">
        <div className="h-64 bg-gray-200 rounded-xl" />
        <div className="h-64 bg-gray-200 rounded-xl col-span-2" />
      </div>
      <div className="h-64 bg-gray-200 rounded-xl" />
    </div>
  );
}
