import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Building2, TrendingUp, Download, Star, ArrowUpDown } from 'lucide-react';
import api from '../api/client';
import type { H1BCompany } from '../types';

const TOP_EMPLOYERS = [
  { name: 'Google', approvalRate: 97.2, avgSalary: 185000, industry: 'Technology' },
  { name: 'Meta', approvalRate: 97.8, avgSalary: 192000, industry: 'Technology' },
  { name: 'Microsoft', approvalRate: 96.8, avgSalary: 178000, industry: 'Technology' },
  { name: 'Amazon', approvalRate: 95.4, avgSalary: 168000, industry: 'Technology' },
  { name: 'Apple', approvalRate: 96.5, avgSalary: 182000, industry: 'Technology' },
  { name: 'NVIDIA', approvalRate: 97.1, avgSalary: 195000, industry: 'Semiconductors' },
];

type SortKey = 'approvalRate' | 'totalPetitions' | 'avgSalary' | 'name';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'approvalRate', label: 'Approval Rate' },
  { value: 'totalPetitions', label: 'Total Petitions' },
  { value: 'avgSalary', label: 'Avg Salary' },
  { value: 'name', label: 'Name (A-Z)' },
];

function exportCSV(companies: H1BCompany[], filename = 'h1b-companies.csv') {
  const headers = ['Name', 'Industry', 'Location', 'H1B Petitions', 'Approval Rate (%)', 'Avg Salary ($)', 'Top Roles'];
  const rows = companies.map(c => [
    `"${c.name}"`,
    `"${c.industry || ''}"`,
    `"${c.headquarters || ''}"`,
    c.totalPetitions ?? 0,
    c.approvalRate?.toFixed(1) ?? '',
    c.avgSalary ?? '',
    `"${c.commonRoles?.slice(0, 3).join('; ') || ''}"`,
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CompaniesPage() {
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('approvalRate');

  const { data, isLoading } = useQuery({
    queryKey: ['companies', search, industry, page],
    queryFn: () => api.get('/companies', { params: { search, industry, page, limit: 20 } }).then(r => r.data),
    placeholderData: (prev) => prev,
  });

  const rawCompanies: H1BCompany[] = data?.companies ?? [];
  const industries: string[] = data?.industries ?? [];

  const companies = [...rawCompanies].sort((a, b) => {
    if (sortKey === 'name') return a.name.localeCompare(b.name);
    if (sortKey === 'approvalRate') return (b.approvalRate ?? 0) - (a.approvalRate ?? 0);
    if (sortKey === 'totalPetitions') return (b.totalPetitions ?? 0) - (a.totalPetitions ?? 0);
    if (sortKey === 'avgSalary') return (b.avgSalary ?? 0) - (a.avgSalary ?? 0);
    return 0;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">H1B Sponsorship Companies</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Browse {data?.total?.toLocaleString() ?? '50,000+'} companies that have historically sponsored H1B visas.</p>
      </div>

      {/* Top H1B Employers */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Star size={16} className="text-yellow-500 fill-yellow-400" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Top H1B Employers</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {TOP_EMPLOYERS.map(co => (
            <div key={co.name} className="card p-4 hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-800">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center shrink-0">
                    <Building2 size={14} className="text-brand-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{co.name}</span>
                </div>
                <span className="badge badge-green shrink-0">{co.approvalRate}%</span>
              </div>
              <div className="mb-2">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                  <span>Approval Rate</span>
                  <span>{co.approvalRate}%</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                  <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${co.approvalRate}%` }} />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Avg Salary: <span className="font-medium text-gray-700 dark:text-gray-300">${(co.avgSalary / 1000).toFixed(0)}k</span></p>
              <p className="text-xs text-gray-400 mt-0.5">{co.industry}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filters + Sort + Export */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search companies..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className="input w-44" value={industry} onChange={e => { setIndustry(e.target.value); setPage(1); }}>
          <option value="">All Industries</option>
          {industries.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <ArrowUpDown size={14} className="text-gray-400 shrink-0" />
          <select className="input w-44" value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <button
          onClick={() => exportCSV(companies)}
          disabled={companies.length === 0}
          className="btn-secondary flex items-center gap-1.5 text-sm shrink-0"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-800">
            <tr>
              {['Company', 'Industry', 'Location', 'H1B Petitions', 'Approval Rate', 'Avg Salary', 'Top Roles'].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading
              ? [...Array(5)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-3/4" /></td>)}
                </tr>
              ))
              : companies.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-brand-50 rounded-md flex items-center justify-center">
                        <Building2 size={13} className="text-brand-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{c.industry || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{c.headquarters || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-sm">
                      <TrendingUp size={13} className="text-brand-500" />
                      {(c.totalPetitions ?? 0).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const r = c.approvalRate;
                      return (
                        <div className="space-y-1">
                          <span className={`badge ${r >= 90 ? 'badge-green' : r >= 75 ? 'badge-yellow' : 'badge-red'}`}>
                            {r?.toFixed(1)}%
                          </span>
                          <div className="w-20 bg-gray-100 dark:bg-gray-800 rounded-full h-1">
                            <div
                              className={`h-1 rounded-full ${r >= 90 ? 'bg-green-500' : r >= 75 ? 'bg-yellow-400' : 'bg-red-400'}`}
                              style={{ width: `${Math.min(r, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {c.avgSalary ? `$${(c.avgSalary / 1000).toFixed(0)}k` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.commonRoles?.slice(0, 2).map((r: string) => (
                        <span key={r} className="badge badge-gray text-xs">{r.split(' ').slice(0, 2).join(' ')}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
        {companies.length === 0 && !isLoading && (
          <div className="py-12 text-center text-gray-400">
            <Building2 size={36} className="mx-auto mb-2 text-gray-200" />
            <p className="text-sm">No companies found. Try a different search.</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary py-1.5 px-3 text-sm">Previous</button>
          <span className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {data.totalPages}</span>
          <button onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages} className="btn-secondary py-1.5 px-3 text-sm">Next</button>
        </div>
      )}
    </div>
  );
}
