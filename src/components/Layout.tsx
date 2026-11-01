import { DoorOpen, Home, Settings, Workflow, X } from 'lucide-react';
import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { BRAND } from '../core/brand';
import { useNow, useStore } from '../state/store';
import { Logo } from './Logo';
import { NotificationBell } from './NotificationBell';
import { Toasts } from './Toasts';

/** The four main sections. Other pages belong to one of them so the right tab stays highlighted. */
export const NAV = [
  { to: '/', label: 'Home', text: 'Your home at a glance', icon: Home, also: ['/notifications', '/doorbell', '/security', '/scenes'] },
  { to: '/rooms', label: 'Rooms', text: 'Every room and device', icon: DoorOpen, also: ['/lighting', '/climate'] },
  { to: '/automations', label: 'Automations', text: 'Routines that run by themselves', icon: Workflow, also: [] },
  { to: '/settings', label: 'Settings', text: 'Preferences and devices', icon: Settings, also: ['/activity'] },
];

export function sectionFor(path: string) {
  return (
    NAV.find((n) => n.to !== '/' && (path === n.to || path.startsWith(n.to + '/'))) ??
    NAV.find((n) => n.also.some((p) => path === p || path.startsWith(p + '/'))) ??
    NAV[0]
  );
}

function Clock() {
  const now = useNow(1000);
  const d = new Date(now);
  return (
    <div className="clock" aria-label="Current date and time">
      <strong>{d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</strong>
      <span>{d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</span>
    </div>
  );
}

export function Layout() {
  const { storageWarning, dismissStorageWarning } = useStore();
  const location = useLocation();
  const current = sectionFor(location.pathname);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const links = (variant: 'side' | 'tab') =>
    NAV.map(({ to, label, text, icon: Icon }) => {
      const active = current.to === to;
      return (
        <Link key={to} to={to} className={`nav-link ${variant} ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
          <Icon size={variant === 'side' ? 22 : 24} strokeWidth={active ? 2.2 : 1.8} />
          <span className="nav-label">{label}</span>
          {variant === 'side' && <span className="nav-text">{text}</span>}
        </Link>
      );
    });

  return (
    <div className="app">
      <a href="#main" className="skip-link">Skip to main content</a>
      <aside className="sidebar" aria-label="Main navigation">
        <Link to="/" className="brand" aria-label={`${BRAND.name} home`}>
          <Logo tagline />
        </Link>
        <nav className="side-nav">{links('side')}</nav>
        <footer className="brand-foot">
          <strong>{BRAND.dashboard}</strong>
          <span>{BRAND.tagline}</span>
          <span className="demo-note">Demo home: every device is pretend, so you can practise safely.</span>
        </footer>
      </aside>

      <div className="main">
        <div className="topbar">
          <Link to="/" className="brand-small" aria-label={`${BRAND.name} home`}><Logo size={30} /></Link>
          <Clock />
          <div className="topbar-actions">
            <span className="demo-chip" title="Every device in this app is simulated, so nothing in your real home changes.">Demo home</span>
            <NotificationBell />
          </div>
        </div>
        {storageWarning && (
          <div className="banner" role="alert">
            <span>{storageWarning}</span>
            <button className="icon-btn" aria-label="Dismiss warning" onClick={dismissStorageWarning}><X size={18} /></button>
          </div>
        )}
        <main className="content" id="main" tabIndex={-1} key={location.pathname}>
          <Outlet />
        </main>
      </div>

      <nav className="tab-bar" aria-label="Main navigation">{links('tab')}</nav>
      <Toasts />
    </div>
  );
}
