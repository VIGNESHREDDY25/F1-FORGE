import { Bell, LogOut, Moon, Sun } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import api from '../../api/client';
import type { Notification } from '../../types';
import { formatDistanceToNow } from 'date-fns';

export default function TopBar() {
  const { user, logout } = useAuthStore();
  const { dark, toggle } = useThemeStore();
  const [showNotifs, setShowNotifs] = useState(false);

  const { data: notifs = [] } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/dashboard/notifications').then(r => r.data),
    staleTime: 30_000,
  });

  const unread = notifs.filter(n => !n.read).length;

  return (
    <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 shrink-0 relative z-40">
      <div />
      <div className="flex items-center gap-1">
        {/* Dark mode toggle */}
        <button onClick={toggle}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          title={dark ? 'Light mode' : 'Dark mode'}>
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button onClick={() => setShowNotifs(s => !s)}
            className="relative p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <Bell size={17} />
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-11 w-80 card shadow-xl border animate-slide-up overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">Notifications</span>
                {unread > 0 && (
                  <button onClick={() => { api.patch('/dashboard/notifications/read-all'); setShowNotifs(false); }}
                    className="text-xs text-brand-600 hover:underline">Mark all read</button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                {notifs.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-400">No notifications</div>
                ) : notifs.slice(0, 10).map(n => (
                  <div key={n.id} className={`px-4 py-3 ${!n.read ? 'bg-brand-50 dark:bg-brand-950/30' : ''}`}>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{n.title}</p>
                    {n.message && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      {(() => { try { return formatDistanceToNow(new Date(n.createdAt || (n as any).created_at), { addSuffix: true }); } catch { return ''; } })()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User */}
        <div className="flex items-center gap-2 ml-1 pl-3 border-l border-gray-200 dark:border-gray-700">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-brand-100" />
          ) : (
            <div className="w-8 h-8 bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 rounded-full flex items-center justify-center text-sm font-bold">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
          )}
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-none">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-gray-400 mt-0.5">{user?.visaType || 'F1 Student'}</p>
          </div>
        </div>

        <button onClick={logout} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors ml-1" title="Logout">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
