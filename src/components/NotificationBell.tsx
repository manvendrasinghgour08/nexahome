import { Bell, CheckCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useStore } from '../state/store';
import { NotificationList } from './NotificationList';

export function NotificationBell() {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const unread = state.notifications.filter((n) => !n.read).length;

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="bell-wrap" ref={ref}>
      <button className="alerts-btn" aria-label={`Alerts${unread ? ` (${unread} new)` : ''}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Bell size={20} />
        <span className="alerts-text">Alerts</span>
        {unread > 0 && <span className="bell-count">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="Recent alerts">
          <div className="popover-head">
            <strong>Alerts</strong>
            <button className="btn small ghost" disabled={unread === 0} onClick={() => dispatch({ type: 'notification/readAll' })}>
              <CheckCheck size={16} /> Mark all as read
            </button>
          </div>
          {state.notifications.length ? (
            <NotificationList items={state.notifications.slice(0, 6)} compact />
          ) : (
            <p className="muted popover-empty">No alerts. All quiet at home.</p>
          )}
          <Link to="/notifications" className="popover-foot">See all alerts</Link>
        </div>
      )}
    </div>
  );
}
