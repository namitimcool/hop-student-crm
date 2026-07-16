import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, Share2, IndianRupee, CalendarDays,
  Settings, LogOut, ScanLine,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/candidates', label: 'Candidates', icon: Users },
  { to: '/companies', label: 'Companies', icon: Building2 },
  { to: '/sharing', label: 'Candidate Sharing', icon: Share2 },
  { to: '/payments', label: 'Payments', icon: IndianRupee },
  { to: '/resumes', label: 'Resume Import', icon: ScanLine },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 bg-navy-900 text-white flex flex-col">
      <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
        <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center font-bold text-navy-900">
          <Building2 size={20} />
        </div>
        <div>
          <div className="font-bold leading-tight text-white">HOP CRM</div>
          <div className="text-[11px] text-white/50 leading-tight">House of Projects — Recruitment</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-5 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold">
            {(user?.email || 'A').slice(0, 1).toUpperCase()}
          </div>
          <div className="text-sm text-white/80 truncate">{user?.email}</div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
        >
          <LogOut size={16} /> Log out
        </button>
      </div>
    </aside>
  );
}
