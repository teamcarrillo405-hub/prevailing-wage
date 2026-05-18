// Phase 97 — Mobile bottom tab bar (MOB-21)
// Fixed mobile bar, md:hidden, 4 tabs for field worker navigation.
import { MapPin, ClipboardList, LayoutDashboard, MoreHorizontal } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const TABS = [
  { label: 'Field',    to: '/field',     Icon: MapPin },
  { label: 'Dashboard', to: '/dashboard', Icon: LayoutDashboard },
  { label: 'Reports',  to: '/reports',   Icon: ClipboardList },
  { label: 'More',     to: '/team',      Icon: MoreHorizontal },
] as const;

export function BottomTabBar() {
  const { pathname } = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex min-h-16 items-center justify-around border-t border-border-default bg-surface-card pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Mobile navigation"
    >
      {TABS.map(({ label, to, Icon }) => {
        const active = pathname === to;
        return (
          <Link
            key={to}
            to={to}
            className={`flex min-h-14 min-w-16 flex-col items-center justify-center gap-0.5 px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? 'text-brand-gold'
                : 'text-text-secondary hover:text-brand-gold'
            }`}
            aria-label={label === 'More' ? 'Open more navigation' : `Open ${label}`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
