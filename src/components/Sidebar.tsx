import { LayoutDashboard, Users, Clock, FileText, ClipboardList, Pill, Settings } from 'lucide-react';
import Logo from './Logo';
import DoctorMenu from './DoctorMenu';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  onSignOut: () => void;
}

export default function Sidebar({ activeView, onNavigate, onSignOut }: SidebarProps) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'patients', label: 'Patients', icon: Users },
    { id: 'consultations', label: 'Sessions', icon: Clock },
    { id: 'transcripts', label: 'Transcripts', icon: FileText },
    { id: 'reports', label: 'AI Reports', icon: ClipboardList },
    { id: 'prescriptions', label: 'Prescriptions', icon: Pill },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="w-64 bg-brand-950 text-brand-200 flex flex-col hidden md:flex flex-shrink-0">
      <div className="px-5 py-6">
        <Logo light tagline />
      </div>

      <div className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        <div className="text-xs font-semibold text-brand-400/70 uppercase tracking-wider mb-4 px-2">Main Menu</div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${
                isActive
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-950/60'
                  : 'hover:bg-brand-900 hover:text-white'
              }`}
            >
              <Icon size={18} />
              {item.label}
            </button>
          );
        })}
      </div>

      <DoctorMenu
        onNavigateProfile={() => onNavigate('profile')}
        onNavigateSettings={() => onNavigate('settings')}
        onSignOut={onSignOut}
      />
    </div>
  );
}
