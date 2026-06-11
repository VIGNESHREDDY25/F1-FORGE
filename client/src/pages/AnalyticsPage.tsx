import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import { TrendingUp, Briefcase, Award, Target, BarChart2, Mail, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FunnelItem {
  stage: string;
  count: number;
}

interface WeeklyItem {
  week: string;
  label: string;
  count: number;
}

interface CompanyItem {
  company: string;
  count: number;
}

interface StatusItem {
  stage: string;
  count: number;
}

interface AnalyticsData {
  total: number;
  totalApplied: number;
  funnel: FunnelItem[];
  interviewRate: number;
  offerRate: number;
  responseRate: number;
  weeklyActivity: WeeklyItem[];
  topCompanies: CompanyItem[];
  statusDistribution: StatusItem[];
}

// ── Color palette (dark-mode safe, explicit hex) ──────────────────────────────

const STAGE_COLORS: Record<string, string> = {
  saved: '#6366f1',      // indigo-500
  applied: '#3b82f6',    // blue-500
  assessment: '#f59e0b', // amber-500
  interview: '#8b5cf6',  // violet-500
  offer: '#10b981',      // emerald-500
  rejected: '#ef4444',   // red-500
};

const STAGE_LABELS: Record<string, string> = {
  saved: 'Saved',
  applied: 'Applied',
  assessment: 'Assessment',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
};

const PIE_COLORS = ['#3b82f6', '#6366f1', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444'];

const AREA_GRADIENT_START = '#3b82f6';
const AREA_GRADIENT_STOP = '#3b82f610';

// ── Custom tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-xl text-xs">
      {label && <p className="text-gray-400 mb-1">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <p key={i} className="font-semibold" style={{ color: entry.color || entry.fill || '#fff' }}>
          {entry.name ? `${entry.name}: ` : ''}{entry.value}
        </p>
      ))}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className={`card p-5 border-l-4`} style={{ borderLeftColor: accent }}>
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${accent}20` }}
        >
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900 dark:text-gray-50 leading-none">{value}</p>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
        <BarChart2 size={32} className="text-indigo-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
        No applications yet
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
        Start tracking your job applications to see your pipeline analytics, activity trends, and conversion rates here.
      </p>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-56 bg-gray-200 dark:bg-gray-800 rounded" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-gray-200 dark:bg-gray-800 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl" />
        <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl" />
      </div>
      <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl" />
    </div>
  );
}

// ── Custom bar shape for pipeline funnel (uniform rounded top) ────────────────

function RoundedBar(props: any) {
  const { x, y, width, height, fill } = props;
  if (!height || height <= 0) return null;
  const r = Math.min(6, width / 2);
  return (
    <path
      d={`M${x + r},${y} h${width - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${height - r} h${-(width)} v${-(height - r)} a${r},${r} 0 0 1 ${r},${-r}z`}
      fill={fill}
    />
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['analytics'],
    queryFn: () => api.get('/dashboard/analytics').then(r => r.data),
    staleTime: 60_000,
  });

  if (isLoading) return <div className="max-w-6xl mx-auto"><Skeleton /></div>;

  if (!data || data.total === 0) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="page-header">
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Your job-search funnel, activity, and conversion rates.</p>
        </div>
        <div className="card">
          <EmptyState />
        </div>
      </div>
    );
  }

  // Enrich funnel with colors + labels for charts
  const funnelData = data.funnel.map(f => ({
    ...f,
    label: STAGE_LABELS[f.stage] ?? f.stage,
    fill: STAGE_COLORS[f.stage] ?? '#6366f1',
  }));

  const topCompaniesData = data.topCompanies.slice(0, 8);

  const pieData = data.statusDistribution.map((s, i) => ({
    name: STAGE_LABELS[s.stage] ?? s.stage,
    value: s.count,
    fill: PIE_COLORS[i % PIE_COLORS.length],
  }));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Analytics</h1>
        <p className="page-subtitle">Your job-search funnel, activity, and conversion rates.</p>
      </div>

      {/* Gmail automation banner */}
      <div className="flex items-center justify-between gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-900 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
            <Mail size={17} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
              <Zap size={13} className="text-blue-500" /> Automate your tracker with Gmail
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
              Connect Gmail and F1Forge will auto-detect application confirmations and update your tracker — no manual entry.
            </p>
          </div>
        </div>
        <Link to="/settings" className="btn-primary text-xs shrink-0 whitespace-nowrap">
          Connect Gmail
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Applications"
          value={data.total}
          sub={`${data.totalApplied} actively applied`}
          icon={<Briefcase size={18} style={{ color: '#3b82f6' }} />}
          accent="#3b82f6"
        />
        <StatCard
          label="Response Rate"
          value={`${data.responseRate}%`}
          sub="Assessment + interview + offer"
          icon={<TrendingUp size={18} style={{ color: '#6366f1' }} />}
          accent="#6366f1"
        />
        <StatCard
          label="Interview Rate"
          value={`${data.interviewRate}%`}
          sub="Interviews ÷ applied"
          icon={<Target size={18} style={{ color: '#8b5cf6' }} />}
          accent="#8b5cf6"
        />
        <StatCard
          label="Offer Rate"
          value={`${data.offerRate}%`}
          sub={`${data.funnel.find(f => f.stage === 'offer')?.count ?? 0} offer${(data.funnel.find(f => f.stage === 'offer')?.count ?? 0) !== 1 ? 's' : ''} received`}
          icon={<Award size={18} style={{ color: '#10b981' }} />}
          accent="#10b981"
        />
      </div>

      {/* Pipeline funnel + weekly activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pipeline bar chart */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Application Pipeline</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={funnelData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="count" name="Applications" shape={<RoundedBar />} maxBarSize={52}>
                {funnelData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly activity area chart */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Weekly Activity
            <span className="text-xs font-normal text-gray-400 dark:text-gray-500 ml-2">last 8 weeks</span>
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.weeklyActivity} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={AREA_GRADIENT_START} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={AREA_GRADIENT_STOP} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area
                type="monotone"
                dataKey="count"
                name="Applications"
                stroke={AREA_GRADIENT_START}
                strokeWidth={2}
                fill="url(#blueGradient)"
                dot={{ fill: AREA_GRADIENT_START, r: 3, strokeWidth: 0 }}
                activeDot={{ fill: '#fff', stroke: AREA_GRADIENT_START, r: 4, strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top companies + status distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top companies */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Top Companies Applied To</h2>
          {topCompaniesData.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No company data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={topCompaniesData}
                layout="vertical"
                barCategoryGap="25%"
                margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="company"
                  width={110}
                  tick={{ fill: '#d1d5db', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="count" name="Applications" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status distribution pie */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Status Breakdown</h2>
          {pieData.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="42%"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`pie-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span style={{ color: '#9ca3af', fontSize: '11px' }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
