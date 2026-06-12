import { useState } from 'react';
import { TrendingUp, Building2 } from 'lucide-react';
import { clsx } from 'clsx';
import SalaryPage from './SalaryPage';
import CompaniesPage from './CompaniesPage';

// Salary Insights and H1B Companies merged into one tabbed view — both answer
// the same question: which companies sponsor, and what do they pay?
export default function SalaryHubPage({ initialTab = 'salary' }: { initialTab?: 'salary' | 'companies' }) {
  const [tab, setTab] = useState<'salary' | 'companies'>(initialTab);

  const TABS = [
    { id: 'salary' as const, label: 'Salary Insights', icon: TrendingUp },
    { id: 'companies' as const, label: 'H1B Companies', icon: Building2 },
  ];

  return (
    <div>
      <div className="max-w-6xl mx-auto mb-5">
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800/60 rounded-xl w-fit">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                tab === id
                  ? 'bg-white dark:bg-gray-900 text-brand-700 dark:text-brand-300 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              )}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'salary' ? <SalaryPage /> : <CompaniesPage />}
    </div>
  );
}
