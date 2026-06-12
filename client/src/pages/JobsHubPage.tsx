import { useState } from 'react';
import { Briefcase, BarChart3 } from 'lucide-react';
import { clsx } from 'clsx';
import JobsPage from './JobsPage';
import AnalyticsPage from './AnalyticsPage';

// Application Tracker and Analytics merged into one tabbed view — same data,
// two lenses: manage the pipeline, then see how it's converting.
export default function JobsHubPage({ initialTab = 'tracker' }: { initialTab?: 'tracker' | 'analytics' }) {
  const [tab, setTab] = useState<'tracker' | 'analytics'>(initialTab);

  const TABS = [
    { id: 'tracker' as const, label: 'Application Tracker', icon: Briefcase },
    { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
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
      {tab === 'tracker' ? <JobsPage /> : <AnalyticsPage />}
    </div>
  );
}
