import { useState } from 'react';
import { MessageSquare, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import NetworkingPage from './NetworkingPage';
import ReferralsPage from './ReferralsPage';

// Networking and Referral Finder merged — one place for the whole outreach
// loop: craft the message, find the people, track every contact.
export default function NetworkingHubPage({ initialTab = 'networking' }: { initialTab?: 'networking' | 'referrals' }) {
  const [tab, setTab] = useState<'networking' | 'referrals'>(initialTab);

  const TABS = [
    { id: 'networking' as const, label: 'Networking & Outreach', icon: MessageSquare },
    { id: 'referrals' as const, label: 'Referral Finder', icon: Zap },
  ];

  return (
    <div>
      <div className="max-w-4xl mx-auto mb-5">
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
      {tab === 'networking' ? <NetworkingPage /> : <ReferralsPage />}
    </div>
  );
}
