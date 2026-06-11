import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search, MapPin, ExternalLink, CheckCircle2,
  TrendingUp, DollarSign, Briefcase, Filter, Clock,
  Wifi, Users, ChevronDown, ChevronUp, Star, Zap,
  Globe, BookOpen, X, SlidersHorizontal, Download, Sparkles,
  LayoutList, Copy, GraduationCap,
} from 'lucide-react';
import api from '../api/client';
import { useAuthStore } from '../store/authStore';
import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

interface Job {
  id: string;
  title: string;
  company: string;
  companyLogo?: string;
  location: string;
  locationType: 'remote' | 'hybrid' | 'onsite' | 'unknown';
  description: string;
  postedAt: string;
  jobType: 'full-time' | 'part-time' | 'contract' | 'internship' | 'unknown';
  experienceLevel: 'entry' | 'mid' | 'senior' | 'director' | 'unknown';
  salary?: string;
  salaryMin?: number;
  applyUrl: string;
  source: string;
  sponsorsH1b: boolean;
  h1bApprovalRate?: number;
  h1bPetitions?: number;
  h1bAvgSalary?: number;
  tags: string[];
  resumeMatchScore?: number;
}

interface Filters {
  h1bOnly: boolean;
  remote: boolean;
  jobType: string;
  expLevel: string;
  salaryMin: string;
  datePosted: string;
}

interface OutreachRow extends Job {
  recruiterSearchUrl: string;
  alumniSearchUrl: string;
  outreachMessage: string;
}

const DATE_POSTED_OPTIONS: { label: string; value: string }[] = [
  { label: 'Any time',     value: '' },
  { label: 'Past 1 hour',  value: '1h' },
  { label: 'Past 5 hours', value: '5h' },
  { label: 'Past 24 hours', value: '24h' },
  { label: 'Past 3 days',  value: '3days' },
  { label: 'Past 5 days',  value: '5days' },
  { label: 'Past week',    value: 'week' },
  { label: 'Past month',   value: 'month' },
];

const ROLE_CHIPS = [
  'Software Engineer', 'Data Scientist', 'ML Engineer', 'Product Manager',
  'Data Engineer', 'DevOps Engineer', 'Security Engineer', 'Backend Engineer',
  'Frontend Engineer', 'Full Stack', 'Cloud Architect', 'SRE',
];

const EXP_LABELS: Record<string, string> = {
  internship: 'Internship',
  entry:      'Entry Level',
  associate:  'Associate',
  mid:        'Mid-Senior',
  senior:     'Senior',
  director:   'Director',
  executive:  'Executive',
};

const TYPE_LABELS: Record<string, string> = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
};

const LOC_COLORS: Record<string, string> = {
  remote: 'badge-green',
  hybrid: 'badge-blue',
  onsite: 'badge-gray',
  unknown: 'badge-gray',
};

function getInitials(company: string) {
  return company.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function CompanyLogo({ company, logo }: { company: string; logo?: string }) {
  const [err, setErr] = useState(false);
  const colors = ['bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700', 'bg-green-100 text-green-700', 'bg-orange-100 text-orange-700', 'bg-pink-100 text-pink-700'];
  const color = colors[company.charCodeAt(0) % colors.length];

  if (logo && !err) {
    return <img src={logo} alt={company} onError={() => setErr(true)} className="w-12 h-12 rounded-lg object-contain border border-gray-100 dark:border-gray-700 bg-white p-1" />;
  }
  return (
    <div className={clsx('w-12 h-12 rounded-lg flex items-center justify-center font-bold text-sm shrink-0', color)}>
      {getInitials(company)}
    </div>
  );
}

export default function JobDiscoveryPage() {
  const [query, setQuery] = useState('Software Engineer');
  const [location, setLocation] = useState('United States');
  const [inputQuery, setInputQuery] = useState('Software Engineer');
  const [inputLocation, setInputLocation] = useState('United States');
  const [filters, setFilters] = useState<Filters>({ h1bOnly: false, remote: false, jobType: '', expLevel: '', salaryMin: '', datePosted: '24h' });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [page] = useState(1);
  const [postedWithin, setPostedWithin] = useState('today');
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [boardOpen, setBoardOpen] = useState(false);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardRows, setBoardRows] = useState<OutreachRow[]>([]);
  const [boardMeta, setBoardMeta] = useState<{ total: number; university: string; source: string } | null>(null);

  const activeFilterCount = [filters.h1bOnly, filters.remote, filters.jobType, filters.expLevel, filters.salaryMin, filters.datePosted && filters.datePosted !== '24h' ? filters.datePosted : ''].filter(Boolean).length;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['job-discovery', query, location, filters, page],
    queryFn: () => api.get('/job-discovery/search', {
      params: {
        q: query, location,
        h1bOnly: filters.h1bOnly ? 'true' : undefined,
        remote: filters.remote ? 'true' : undefined,
        jobType: filters.jobType || undefined,
        expLevel: filters.expLevel || undefined,
        salaryMin: filters.salaryMin || undefined,
        datePosted: filters.datePosted || undefined,
        page,
      }
    }).then(r => r.data),
    staleTime: 15 * 60 * 1000,
  });

  const { data: trending = [] } = useQuery({
    queryKey: ['trending-roles'],
    queryFn: () => api.get('/job-discovery/trending').then(r => r.data),
    staleTime: 60 * 60 * 1000,
  });

  const jobs: Job[] = data?.jobs ?? [];

  const handleSearch = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    setQuery(inputQuery);
    setLocation(inputLocation);
    setSelectedJob(null);
  }, [inputQuery, inputLocation]);

  const setFilterKey = useCallback(<K extends keyof Filters>(key: K, val: Filters[K]) => {
    setFilters(prev => ({ ...prev, [key]: val }));
    setSelectedJob(null);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ h1bOnly: false, remote: false, jobType: '', expLevel: '', salaryMin: '', datePosted: '24h' });
  }, []);

  // Outreach automation: download a recruiter + alumni CSV for the freshest matches.
  // Uses fetch (not the axios client) so the response-transform interceptor
  // doesn't mangle the CSV blob; still carries the JWT for auth.
  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportMsg(null);
    try {
      const token = useAuthStore.getState().token;
      const params = new URLSearchParams({
        q: query, location, postedWithin, limit: '30',
        ...(filters.h1bOnly ? { h1bOnly: 'true' } : {}),
        ...(filters.remote ? { remote: 'true' } : {}),
        ...(filters.jobType ? { jobType: filters.jobType } : {}),
        ...(filters.expLevel ? { expLevel: filters.expLevel } : {}),
        ...(filters.salaryMin ? { salaryMin: filters.salaryMin } : {}),
      });
      const resp = await fetch(`/api/job-discovery/export?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) throw new Error(`Export failed (${resp.status})`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `f1forge-outreach-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportMsg('Downloaded — open it for clickable recruiter & alumni links.');
    } catch (err) {
      setExportMsg('Export failed. Try again in a moment.');
    } finally {
      setExporting(false);
      setTimeout(() => setExportMsg(null), 6000);
    }
  }, [query, location, postedWithin, filters]);

  const handleOpenBoard = useCallback(async () => {
    setBoardOpen(true);
    setBoardLoading(true);
    setBoardRows([]);
    setBoardMeta(null);
    try {
      const token = useAuthStore.getState().token;
      const params = new URLSearchParams({
        q: query, location, postedWithin, limit: '30', format: 'json',
        ...(filters.h1bOnly ? { h1bOnly: 'true' } : {}),
        ...(filters.remote ? { remote: 'true' } : {}),
        ...(filters.jobType ? { jobType: filters.jobType } : {}),
        ...(filters.expLevel ? { expLevel: filters.expLevel } : {}),
        ...(filters.salaryMin ? { salaryMin: filters.salaryMin } : {}),
      });
      const resp = await fetch(`/api/job-discovery/export?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) throw new Error(`Board fetch failed (${resp.status})`);
      const data = await resp.json() as { total: number; source: string; university: string; rows: OutreachRow[] };
      setBoardRows(data.rows ?? []);
      setBoardMeta({ total: data.total, university: data.university, source: data.source });
    } catch {
      toast.error('Could not load outreach board. Try again.');
      setBoardOpen(false);
    } finally {
      setBoardLoading(false);
    }
  }, [query, location, postedWithin, filters]);

  const topMatch = jobs.find(j => j.resumeMatchScore && j.resumeMatchScore >= 80);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Job Discovery</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
          Live jobs scraped straight from LinkedIn · H1B sponsorship data · AI resume matching
        </p>
      </div>

      {/* Search bar — LinkedIn style */}
      <form onSubmit={handleSearch} className="card p-4 mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9 h-11"
              placeholder="Job title, company, or keywords..."
              value={inputQuery}
              onChange={e => setInputQuery(e.target.value)}
            />
          </div>
          <div className="relative w-52">
            <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9 h-11"
              placeholder="City, state, or remote"
              value={inputLocation}
              onChange={e => setInputLocation(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary h-11 px-6 shrink-0">
            {isLoading || isFetching
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Search size={16} />}
            Search
          </button>
        </div>

        {/* Role chips */}
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {ROLE_CHIPS.map(r => (
            <button key={r} type="button"
              onClick={() => { setInputQuery(r); setQuery(r); setSelectedJob(null); }}
              className={clsx('text-xs px-3 py-1 rounded-full border transition-colors',
                query === r
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-brand-300 hover:text-brand-700 dark:hover:text-brand-400')}>
              {r}
            </button>
          ))}
        </div>

        {/* Outreach automation bar */}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
            <Sparkles size={13} className="text-brand-500" /> Outreach automation
          </span>
          <div className="relative">
            <Clock size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={postedWithin}
              onChange={e => setPostedWithin(e.target.value)}
              className="select h-8 pl-7 pr-7 text-xs w-auto"
              title="How fresh the postings should be"
            >
              <option value="1h">Past 1 hour</option>
              <option value="5h">Past 5 hours</option>
              <option value="today">Past 24 hours</option>
              <option value="3days">Past 3 days</option>
              <option value="5days">Past 5 days</option>
              <option value="week">Past week</option>
              <option value="month">Past month</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="btn-secondary h-8 px-3 text-xs"
            title="Export the freshest matching roles with clickable LinkedIn recruiter + alumni searches as a CSV"
          >
            {exporting
              ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              : <Download size={13} />}
            Export CSV
          </button>
          <button
            type="button"
            onClick={handleOpenBoard}
            disabled={boardLoading}
            className="btn-primary h-8 px-3 text-xs"
            title="Open an in-app outreach board with one-click Apply, Recruiter Search, Alumni Search, and Copy message actions"
          >
            {boardLoading
              ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <LayoutList size={13} />}
            Open outreach board
          </button>
          {exportMsg && (
            <span className="text-xs text-gray-500 dark:text-gray-400 animate-fade-in">{exportMsg}</span>
          )}
        </div>
      </form>

      <div className="flex gap-4">
        {/* Left: Filters sidebar */}
        <div className="w-56 shrink-0 hidden lg:block">
          <div className="card p-4 sticky top-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-1.5">
                <SlidersHorizontal size={14} /> Filters
              </h3>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="text-xs text-brand-600 hover:text-brand-700">Clear all</button>
              )}
            </div>

            {/* Date posted */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1"><Clock size={11} /> Date Posted</p>
              <div className="space-y-1">
                {DATE_POSTED_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFilterKey('datePosted', opt.value)}
                    className={clsx('w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors',
                      filters.datePosted === opt.value
                        ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 font-medium ring-1 ring-brand-200 dark:ring-brand-800'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800')}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* H1B Visa */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Visa</p>
              <label className="flex items-center gap-2 cursor-pointer group">
                <div
                  onClick={() => setFilterKey('h1bOnly', !filters.h1bOnly)}
                  className={clsx('w-4 h-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer',
                    filters.h1bOnly ? 'bg-brand-600 border-brand-600' : 'border-gray-300 dark:border-gray-600'
                  )}>
                  {filters.h1bOnly && <span className="text-white text-xs">✓</span>}
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">
                  H1B Sponsors Only
                </span>
              </label>
            </div>

            {/* Work type */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Work Type</p>
              <div className="space-y-1.5">
                {[
                  { label: 'Remote', val: 'remote' },
                  { label: 'Hybrid', val: 'hybrid' },
                  { label: 'On-site', val: 'onsite' },
                ].map(opt => (
                  <label key={opt.val} className="flex items-center gap-2 cursor-pointer group">
                    <div
                      onClick={() => setFilterKey('remote', opt.val === 'remote' ? !filters.remote : filters.remote)}
                      className={clsx('w-4 h-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer',
                        filters.remote && opt.val === 'remote' ? 'bg-brand-600 border-brand-600' : 'border-gray-300 dark:border-gray-600'
                      )}>
                      {filters.remote && opt.val === 'remote' && <span className="text-white text-xs">✓</span>}
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Job type */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1"><Briefcase size={11} /> Job Type</p>
              <div className="space-y-1">
                {Object.entries(TYPE_LABELS).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setFilterKey('jobType', filters.jobType === val ? '' : val)}
                    className={clsx('w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors',
                      filters.jobType === val
                        ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 font-medium ring-1 ring-brand-200 dark:ring-brand-800'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Experience Level */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1"><Briefcase size={11} /> Experience Level</p>
              <div className="space-y-1">
                {Object.entries(EXP_LABELS).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setFilterKey('expLevel', filters.expLevel === val ? '' : val)}
                    className={clsx('w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors',
                      filters.expLevel === val
                        ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 font-medium ring-1 ring-brand-200 dark:ring-brand-800'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Salary */}
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Min Salary</p>
              <select
                value={filters.salaryMin}
                onChange={e => setFilterKey('salaryMin', e.target.value)}
                className="select text-sm w-full">
                <option value="">Any</option>
                <option value="80000">$80k+</option>
                <option value="100000">$100k+</option>
                <option value="130000">$130k+</option>
                <option value="150000">$150k+</option>
                <option value="180000">$180k+</option>
                <option value="200000">$200k+</option>
              </select>
            </div>
          </div>
        </div>

        {/* Center: Job list */}
        <div className="flex-1 min-w-0">
          {/* Mobile filter button */}
          <div className="lg:hidden mb-3">
            <button onClick={() => setShowFilters(!showFilters)}
              className={clsx('btn-secondary text-sm', activeFilterCount > 0 && 'border-brand-300 text-brand-700')}>
              <Filter size={14} />
              Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
              {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {/* Results stats */}
          {(jobs.length > 0 || isLoading) && (
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isLoading ? 'Searching...' : (
                  <><span className="font-semibold text-gray-900 dark:text-gray-100">{jobs.length}</span> jobs for "<span className="font-medium">{query}</span>"</>
                )}
                {data?.source === 'jsearch' && <span className="ml-2 badge badge-blue"><Zap size={9} /> Live jobs</span>}
                {data?.source === 'linkedin' && <span className="ml-2 badge badge-blue"><Zap size={9} /> Live from LinkedIn</span>}
                {data?.source === 'curated' && <span className="ml-2 badge badge-gray">Curated listings</span>}
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <CheckCircle2 size={12} className="text-green-500" />
                {jobs.filter(j => j.sponsorsH1b).length} H1B sponsors
              </div>
            </div>
          )}

          {/* AI top pick banner */}
          {topMatch && !isLoading && (
            <div className="card p-3 mb-3 border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-950/40">
              <div className="flex items-center gap-2">
                <Star size={14} className="text-brand-600 shrink-0" />
                <p className="text-sm text-brand-800 dark:text-brand-300">
                  <span className="font-semibold">Top AI Match:</span> {topMatch.title} at {topMatch.company} — {topMatch.resumeMatchScore}% match with your profile
                </p>
                <button onClick={() => setSelectedJob(topMatch)} className="ml-auto text-xs text-brand-600 hover:text-brand-700 font-medium whitespace-nowrap">
                  View →
                </button>
              </div>
            </div>
          )}

          {/* Trending roles (empty state) */}
          {!jobs.length && !isLoading && trending.length > 0 && (
            <div className="card p-5 mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2 text-sm">
                <TrendingUp size={15} className="text-brand-600" /> Trending in Tech Right Now
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {trending.map((t: any) => (
                  <button key={t.role}
                    onClick={() => { setInputQuery(t.role); setQuery(t.role); setSelectedJob(null); }}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 hover:bg-brand-50 dark:hover:bg-brand-950/40 border border-gray-200 dark:border-gray-700 hover:border-brand-200 rounded-lg transition-colors text-left">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t.role}</p>
                      <p className="text-xs text-gray-400">{t.count.toLocaleString()} openings · <span className="text-green-600">{t.growth}</span></p>
                    </div>
                    <p className="text-xs font-semibold text-green-600">${(t.avgSalary / 1000).toFixed(0)}k</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Skeleton loader */}
          {isLoading && (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => <JobCardSkeleton key={i} />)}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && jobs.length === 0 && query && (
            <div className="card p-12 text-center">
              <Briefcase size={40} className="text-gray-200 dark:text-gray-700 mx-auto mb-3" />
              <p className="font-medium text-gray-600 dark:text-gray-300">No jobs found</p>
              <p className="text-sm text-gray-400 mt-1">Try a different search or clear your filters.</p>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="btn-secondary mt-4 mx-auto">Clear filters</button>
              )}
            </div>
          )}

          {/* Job cards */}
          {!isLoading && jobs.length > 0 && (
            <div className="space-y-2">
              {jobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  selected={selectedJob?.id === job.id}
                  onClick={() => setSelectedJob(prev => prev?.id === job.id ? null : job)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: Job detail panel */}
        {selectedJob && (
          <div className="w-[380px] shrink-0">
            <JobDetail job={selectedJob} onClose={() => setSelectedJob(null)} />
          </div>
        )}
      </div>

      {/* Outreach Board Modal */}
      {boardOpen && (
        <OutreachBoard
          rows={boardRows}
          loading={boardLoading}
          meta={boardMeta}
          query={query}
          postedWithin={postedWithin}
          onClose={() => setBoardOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────
function JobCard({ job, selected, onClick }: { job: Job; selected: boolean; onClick: () => void }) {
  const timeAgo = (() => {
    try { return formatDistanceToNow(new Date(job.postedAt), { addSuffix: true }); }
    catch { return 'Recently'; }
  })();

  return (
    <div
      onClick={onClick}
      className={clsx(
        'card p-4 cursor-pointer transition-all hover:shadow-md',
        selected
          ? 'border-brand-400 dark:border-brand-500 ring-1 ring-brand-200 dark:ring-brand-800 bg-brand-50/30 dark:bg-brand-950/20'
          : 'hover:border-gray-300 dark:hover:border-gray-600'
      )}>
      <div className="flex gap-3">
        <CompanyLogo company={job.company} logo={job.companyLogo} />

        <div className="flex-1 min-w-0">
          {/* Title + match score */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-tight truncate">
                {job.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{job.company}</p>
            </div>
            {job.resumeMatchScore !== undefined && (
              <div className={clsx('shrink-0 text-center px-2 py-0.5 rounded-full text-xs font-bold',
                job.resumeMatchScore >= 80 ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
                job.resumeMatchScore >= 60 ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' :
                'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
              )}>
                {job.resumeMatchScore}% match
              </div>
            )}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
            <span className="flex items-center gap-1"><MapPin size={11} />{job.location}</span>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span className="flex items-center gap-1"><Clock size={11} />{timeAgo}</span>
            {job.salary && (
              <>
                <span className="text-gray-300 dark:text-gray-600">·</span>
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                  <DollarSign size={10} />{job.salary}
                </span>
              </>
            )}
          </div>

          {/* Badge row */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {job.sponsorsH1b && (
              <span className="badge badge-green text-xs flex items-center gap-0.5">
                <CheckCircle2 size={10} /> H1B Sponsor
                {job.h1bApprovalRate && <span className="opacity-75 ml-0.5">{job.h1bApprovalRate.toFixed(0)}%</span>}
              </span>
            )}
            <span className={clsx('badge text-xs', LOC_COLORS[job.locationType])}>
              {job.locationType === 'remote' && <Wifi size={9} className="mr-0.5" />}
              {job.locationType === 'remote' ? 'Remote' : job.locationType === 'hybrid' ? 'Hybrid' : 'On-site'}
            </span>
            {job.jobType === 'internship' && <span className="badge badge-purple text-xs">Internship</span>}
            {EXP_LABELS[job.experienceLevel] && (
              <span className="badge badge-gray text-xs">{EXP_LABELS[job.experienceLevel]}</span>
            )}
            {job.tags.slice(0, 3).map(t => (
              <span key={t} className="badge badge-gray text-xs">{t}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Job Detail Panel ─────────────────────────────────────────────────────────
function JobDetail({ job, onClose }: { job: Job; onClose: () => void }) {
  const navigate = useNavigate();
  const timeAgo = (() => {
    try { return formatDistanceToNow(new Date(job.postedAt), { addSuffix: true }); }
    catch { return 'Recently'; }
  })();

  return (
    <div className="card sticky top-4 max-h-[calc(100vh-5rem)] overflow-y-auto">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex gap-3">
            <CompanyLogo company={job.company} logo={job.companyLogo} />
            <div>
              <h3 className="font-bold text-gray-900 dark:text-gray-50 text-base leading-tight">{job.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{job.company}</p>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
                <MapPin size={11} />{job.location}
                <span>·</span>
                <Clock size={11} />{timeAgo}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0 mt-0.5">
            <X size={18} />
          </button>
        </div>

        {/* Quick facts */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5">
            <p className="text-xs text-gray-400 mb-0.5">Job Type</p>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 capitalize">{job.jobType.replace('-', ' ')}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5">
            <p className="text-xs text-gray-400 mb-0.5">Work Mode</p>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 capitalize">{job.locationType}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5">
            <p className="text-xs text-gray-400 mb-0.5">Experience</p>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{EXP_LABELS[job.experienceLevel] ?? 'Not specified'}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5">
            <p className="text-xs text-gray-400 mb-0.5">Source</p>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{job.source}</p>
          </div>
        </div>

        {/* Salary */}
        {job.salary && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <DollarSign size={16} className="text-green-600 shrink-0" />
            <div>
              <p className="text-xs text-green-600 dark:text-green-400">Salary Range</p>
              <p className="text-sm font-bold text-green-800 dark:text-green-300">{job.salary}</p>
            </div>
          </div>
        )}

        {/* AI Match score */}
        {job.resumeMatchScore !== undefined && (
          <div className="mb-4 p-3 bg-brand-50 dark:bg-brand-950/40 rounded-lg border border-brand-200 dark:border-brand-800">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Star size={13} className="text-brand-600" />
                <p className="text-xs font-semibold text-brand-700 dark:text-brand-300">AI Resume Match</p>
              </div>
              <span className="text-sm font-bold text-brand-700 dark:text-brand-300">{job.resumeMatchScore}%</span>
            </div>
            <div className="w-full bg-brand-200 dark:bg-brand-900 rounded-full h-1.5">
              <div className="bg-brand-600 h-1.5 rounded-full transition-all" style={{ width: `${job.resumeMatchScore}%` }} />
            </div>
            <p className="text-xs text-brand-600 dark:text-brand-400 mt-1">
              {job.resumeMatchScore >= 80 ? 'Excellent match — apply now!' :
               job.resumeMatchScore >= 60 ? 'Good match — worth applying' :
               'Partial match — consider upskilling first'}
            </p>
          </div>
        )}

        {/* H1B sponsorship */}
        <div className={clsx('rounded-lg p-4 mb-4 border', job.sponsorsH1b
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
          : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700')}>
          <div className="flex items-center gap-2 mb-1">
            {job.sponsorsH1b
              ? <><CheckCircle2 size={15} className="text-green-600" /><span className="font-semibold text-green-800 dark:text-green-300 text-sm">Confirmed H1B Sponsor</span></>
              : <><Globe size={15} className="text-gray-400" /><span className="text-sm text-gray-500 dark:text-gray-400">H1B sponsorship not confirmed in USCIS data</span></>
            }
          </div>
          {job.sponsorsH1b && job.h1bApprovalRate && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="text-center">
                <p className="text-base font-bold text-green-700 dark:text-green-400">{job.h1bApprovalRate.toFixed(0)}%</p>
                <p className="text-xs text-gray-500">Approval rate</p>
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-green-700 dark:text-green-400">{((job.h1bPetitions ?? 0) / 1000).toFixed(1)}k</p>
                <p className="text-xs text-gray-500">H1B filings</p>
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-green-700 dark:text-green-400">${((job.h1bAvgSalary ?? 0) / 1000).toFixed(0)}k</p>
                <p className="text-xs text-gray-500">Avg H1B salary</p>
              </div>
            </div>
          )}
        </div>

        {/* Skills */}
        {job.tags.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {job.tags.map(t => (
                <span key={t} className="badge badge-gray text-xs">{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <BookOpen size={12} /> About the Role
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{job.description}</p>
        </div>

        {/* CTA buttons */}
        <div className="space-y-2">
          <a href={job.applyUrl} target="_blank" rel="noopener noreferrer"
            className="btn-primary w-full justify-center">
            <ExternalLink size={15} /> Apply Now
          </a>
          <button
            onClick={() => {
              navigate(`/jobs?prefill=${encodeURIComponent(JSON.stringify({ company: job.company, role: job.title, jdUrl: job.applyUrl }))}`);
            }}
            className="btn-secondary w-full justify-center text-sm">
            <Briefcase size={14} /> Save to Tracker
          </button>
        </div>

        {/* Source attribution */}
        <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-400 justify-center">
          <Users size={11} />
          Posted on {job.source}
        </div>
      </div>
    </div>
  );
}

// ─── Outreach Board Modal ────────────────────────────────────────────────────

const POSTED_WITHIN_LABELS: Record<string, string> = {
  '1h':    'past 1 hour',
  '5h':    'past 5 hours',
  today:   'past 24 hours',
  '3days': 'past 3 days',
  '5days': 'past 5 days',
  week:    'past week',
  month:   'past month',
};

function OutreachBoard({
  rows,
  loading,
  meta,
  query,
  postedWithin,
  onClose,
}: {
  rows: OutreachRow[];
  loading: boolean;
  meta: { total: number; university: string; source: string } | null;
  query: string;
  postedWithin: string;
  onClose: () => void;
}) {
  // Trap scroll on body while modal is open
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-5xl mx-4 mt-14 mb-8 flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[calc(100vh-7rem)] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-brand-500" />
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-50">Outreach Board</h2>
              {meta && (
                <span className="badge badge-blue text-xs ml-1">
                  {meta.total} role{meta.total !== 1 ? 's' : ''}
                </span>
              )}
              {meta?.source === 'linkedin' && (
                <span className="badge badge-blue text-xs flex items-center gap-0.5"><Zap size={9} /> Live from LinkedIn</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              "{query}" · {POSTED_WITHIN_LABELS[postedWithin] ?? postedWithin}
              {meta?.university ? ` · alumni from ${meta.university}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close outreach board"
          >
            <X size={18} />
          </button>
        </div>

        {/* Column headers */}
        {!loading && rows.length > 0 && (
          <div className="hidden md:grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-x-3 px-6 py-2 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-400 uppercase tracking-wide shrink-0">
            <span className="w-10" />
            <span>Role / Company</span>
            <span className="w-20 text-center">Posted</span>
            <span className="w-16 text-center">Match</span>
            <span className="w-14 text-center">Visa</span>
            <span className="w-28 text-center">Actions</span>
            <span className="w-28 text-center">Outreach</span>
          </div>
        )}

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <span className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Fetching the freshest roles…</p>
            </div>
          )}

          {!loading && rows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
              <Briefcase size={36} className="text-gray-200 dark:text-gray-700" />
              <p className="font-medium text-gray-500 dark:text-gray-400">No roles found for this search</p>
              <p className="text-xs text-gray-400">Try adjusting the freshness or filters and try again.</p>
            </div>
          )}

          {!loading && rows.map((row) => (
            <OutreachJobRow key={row.id} row={row} university={meta?.university ?? ''} />
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 shrink-0 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Tip: click <strong className="text-gray-600 dark:text-gray-300">Copy outreach</strong> to copy a personalized message · Edit before sending
          </p>
          <button onClick={onClose} className="btn-secondary text-xs h-8 px-4">Close</button>
        </div>
      </div>
    </div>
  );
}

function OutreachJobRow({ row, university }: { row: OutreachRow; university: string }) {
  const [copied, setCopied] = useState(false);

  const timeAgo = (() => {
    try { return formatDistanceToNow(new Date(row.postedAt), { addSuffix: true }); }
    catch { return 'Recently'; }
  })();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(row.outreachMessage);
      setCopied(true);
      toast.success(`Outreach message for ${row.company} copied!`, { duration: 2500 });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Could not copy — please copy manually.');
    }
  };

  return (
    <div className="group flex flex-col md:grid md:grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-x-3 gap-y-2 items-start md:items-center p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-brand-200 dark:hover:border-brand-700 hover:shadow-sm transition-all">

      {/* Logo */}
      <div className="shrink-0">
        <CompanyLogo company={row.company} logo={row.companyLogo} />
      </div>

      {/* Role + Company */}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-snug truncate">{row.title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{row.company} · {row.location}</p>
        <div className="flex flex-wrap gap-1 mt-1">
          {row.tags.slice(0, 3).map(t => (
            <span key={t} className="badge badge-gray text-xs">{t}</span>
          ))}
          {row.salary && (
            <span className="badge badge-green text-xs flex items-center gap-0.5"><DollarSign size={9} />{row.salary}</span>
          )}
        </div>
      </div>

      {/* Posted */}
      <div className="w-20 text-center text-xs text-gray-400 shrink-0">
        <Clock size={11} className="inline mr-0.5 -mt-0.5" />
        {timeAgo.replace(' ago', '')}
      </div>

      {/* Match % */}
      <div className="w-16 shrink-0 flex justify-center">
        {row.resumeMatchScore !== undefined ? (
          <div className={clsx(
            'text-xs font-bold px-2 py-0.5 rounded-full',
            row.resumeMatchScore >= 80 ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
            row.resumeMatchScore >= 60 ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' :
            'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
          )}>
            {row.resumeMatchScore}%
          </div>
        ) : <span className="text-xs text-gray-300">—</span>}
      </div>

      {/* Visa */}
      <div className="w-14 shrink-0 flex justify-center">
        {row.sponsorsH1b ? (
          <span className="badge badge-green text-xs flex items-center gap-0.5" title="Confirmed H1B sponsor">
            <CheckCircle2 size={9} /> H1B
          </span>
        ) : (
          <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
        )}
      </div>

      {/* Apply / Recruiter / Alumni */}
      <div className="w-28 shrink-0 flex flex-col gap-1">
        <a
          href={row.applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary h-7 text-xs px-2 justify-center w-full"
          title="Apply on LinkedIn"
        >
          <ExternalLink size={11} /> Apply
        </a>
        <a
          href={row.recruiterSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary h-7 text-xs px-2 justify-center w-full"
          title="Find recruiter on LinkedIn"
        >
          <Users size={11} /> Recruiter
        </a>
        <a
          href={row.alumniSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost h-7 text-xs px-2 justify-center w-full"
          title={`Find ${university || 'alumni'} at this company on LinkedIn`}
        >
          <GraduationCap size={11} /> Alumni
        </a>
      </div>

      {/* Copy outreach */}
      <div className="w-28 shrink-0">
        <button
          onClick={handleCopy}
          className={clsx(
            'w-full h-auto py-1.5 px-2 rounded-lg text-xs font-medium transition-all flex flex-col items-center gap-0.5 border',
            copied
              ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
              : 'bg-brand-50 dark:bg-brand-950/40 border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/40'
          )}
          title="Copy personalized outreach message to clipboard"
        >
          {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
          {copied ? 'Copied!' : 'Copy outreach'}
        </button>
      </div>
    </div>
  );
}

function JobCardSkeleton() {
  return (
    <div className="card p-4 animate-pulse">
      <div className="flex gap-3">
        <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          <div className="flex gap-2">
            <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
            <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
