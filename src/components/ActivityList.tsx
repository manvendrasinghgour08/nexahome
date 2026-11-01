import { AlertTriangle, BellRing, Cpu, Info, ShieldAlert, Sparkles, Thermometer, Workflow } from 'lucide-react';
import { formatDateTime, relativeTime } from '../core/format';
import type { ActivityEvent, EventCategory } from '../core/types';
import { useNow } from '../state/store';
import { EmptyState } from './ui';

export const CATEGORY_ICON: Record<EventCategory, typeof Info> = {
  device: Cpu,
  doorbell: BellRing,
  security: ShieldAlert,
  climate: Thermometer,
  automation: Workflow,
  scene: Sparkles,
  system: Info,
};

export function ActivityList({ events, compact = false, emptyText = 'Device actions and automation events will appear here.' }: { events: ActivityEvent[]; compact?: boolean; emptyText?: string }) {
  const now = useNow();
  if (events.length === 0) {
    return <EmptyState icon={<AlertTriangle size={24} />} title="No activity yet">{emptyText}</EmptyState>;
  }
  return (
    <ul className={`activity ${compact ? 'compact' : ''}`}>
      {events.map((e) => {
        const Icon = CATEGORY_ICON[e.category] ?? Info;
        return (
          <li key={e.id} className={`sev-${e.severity} cat-${e.category}`}>
            <span className="activity-icon"><Icon size={16} /></span>
            <span className="activity-msg">{e.message}</span>
            <time dateTime={new Date(e.ts).toISOString()} title={formatDateTime(e.ts)}>
              {compact ? relativeTime(e.ts, now) : formatDateTime(e.ts)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
