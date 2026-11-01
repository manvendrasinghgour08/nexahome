import { AlertTriangle, BellRing, CheckCircle2, Info, Trash2 } from 'lucide-react';
import { formatDateTime, relativeTime } from '../core/format';
import type { AppNotification } from '../core/types';
import { useNow, useStore } from '../state/store';
import { DemoTag } from './ui';

const ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, alert: AlertTriangle };

/** Notification rows; clicking an unread one marks it as read. */
export function NotificationList({ items, compact = false }: { items: AppNotification[]; compact?: boolean }) {
  const { dispatch } = useStore();
  const now = useNow();
  return (
    <ul className={`notif-list ${compact ? 'compact' : ''}`}>
      {items.map((n) => {
        const Icon = n.category === 'doorbell' ? BellRing : ICONS[n.severity];
        return (
          <li key={n.id} className={`notif sev-${n.severity} ${n.read ? 'read' : 'unread'}`} data-testid="notification">
            <span className="notif-icon"><Icon size={16} /></span>
            <button
              type="button"
              className="notif-body"
              onClick={() => !n.read && dispatch({ type: 'notification/read', id: n.id })}
              aria-label={`${n.title}: ${n.message}${n.read ? '' : ' (new — tap to mark as read)'}`}
            >
              <span className="notif-title">
                {!n.read && <span className="new-tag">New</span>}
                {n.title}
                {(n.category === 'doorbell' || n.category === 'security') && <DemoTag />}
              </span>
              <span className="notif-msg">{n.message}</span>
              <time dateTime={new Date(n.ts).toISOString()} title={formatDateTime(n.ts)}>
                {compact ? relativeTime(n.ts, now) : `${formatDateTime(n.ts)} · ${relativeTime(n.ts, now)}`}
              </time>
            </button>
            {!compact && (
              <button className="btn small ghost danger" aria-label={`Delete alert ${n.title}`} onClick={() => dispatch({ type: 'notification/delete', id: n.id })}>
                <Trash2 size={16} /> Delete
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
