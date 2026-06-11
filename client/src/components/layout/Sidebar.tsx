import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, FileText, Shield, Building2,
  Bot, Users, Code2, MessageSquare, User, ChevronRight, Search,
  TrendingUp
} from 'lucide-react';
import { clsx } from 'clsx';

const navGroups = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/job-discovery', icon: Search, label: 'Job Discovery', badge: 'LIVE' },
    ],
  },
  {
    label: 'Career Tools',
    items: [
      { to: '/jobs', icon: Briefcase, label: 'Application Tracker' },
      { to: '/resume', icon: FileText, label: 'Resume Optimizer' },
      { to: '/salary', icon: TrendingUp, label: 'Salary Insights' },
    ],
  },
  {
    label: 'Visa & Compliance',
    items: [
      { to: '/compliance', icon: Shield, label: 'OPT/CPT Tracker' },
      { to: '/companies', icon: Building2, label: 'H1B Companies' },
    ],
  },
  {
    label: 'AI & Networking',
    items: [
      { to: '/assistant', icon: Bot, label: 'AI Assistant' },
      { to: '/practice', icon: Code2, label: 'Practice', badge: 'IDE' },
      { to: '/referrals', icon: Users, label: 'Referral Finder' },
      { to: '/networking', icon: MessageSquare, label: 'Networking' },
    ],
  },
];

export default function Sidebar() {
  return (
    <aside className="w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0">
      {/* Logo */}
      <div className="p-5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-sm">F1</span>
          </div>
          <div>
            <span className="font-bold text-gray-900 dark:text-gray-50 text-lg tracking-tight">F1Forge</span>
            <p className="text-[10px] text-gray-400 leading-none">Career OS</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
        {navGroups.map(group => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-widest px-2 mb-1">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ to, icon: Icon, label, badge }: any) => (
                <NavLink key={to} to={to}
                  className={({ isActive }) => clsx(
                    'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all group',
                    isActive
                      ? 'bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                  )}>
                  {({ isActive }) => (
                    <>
                      <Icon size={15} className={isActive ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'} />
                      <span className="flex-1 truncate text-[13px]">{label}</span>
                      {badge && <span className="text-[9px] font-bold text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded-full">{badge}</span>}
                      {isActive && <ChevronRight size={12} className="text-brand-400 shrink-0" />}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Profile */}
      <div className="p-3 border-t border-gray-100 dark:border-gray-800">
        <NavLink to="/profile"
          className={({ isActive }) => clsx(
            'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors',
            isActive ? 'bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
          )}>
          <User size={15} className="text-gray-400" />
          <span className="text-[13px]">Profile & Settings</span>
        </NavLink>
      </div>
    </aside>
  );
}
