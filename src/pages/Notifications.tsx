import { BellOff, CheckCheck, Trash2 } from 'lucide-react';
import { NotificationList } from '../components/NotificationList';
import { Card, EmptyState, PageHeader, Segmented } from '../components/ui';
import { usePersistentState, useStore } from '../state/store';

type Filter = 'all' | 'unread' | 'alerts';

export function Notifications() {
  const { state, dispatch } = useStore();
  const [filter, setFilter] = usePersistentState<Filter>('notif-filter', 'all', ['all', 'unread', 'alerts']);
  const unread = state.notifications.filter((n) => !n.read).length;
  const items = state.notifications.filter((n) =>
    filter === 'unread' ? !n.read : filter === 'alerts' ? n.severity === 'alert' || n.severity === 'warning' : true,
  );

  const clear = () => {
    if (window.confirm(`Delete all ${state.notifications.length} alerts?`)) dispatch({ type: 'notification/clear' });
  };

  return (
    <>
      <PageHeader
        title="Alerts"
        back={{ to: '/', label: 'Home' }}
        subtitle={unread ? `${unread} new. Tap an alert to mark it as read.` : 'You have read everything.'}
        actions={
          <>
            <button className="btn" disabled={unread === 0} onClick={() => dispatch({ type: 'notification/readAll' })}><CheckCheck size={18} /> Mark all as read</button>
            <button className="btn ghost danger" disabled={state.notifications.length === 0} onClick={clear}><Trash2 size={18} /> Delete all</button>
          </>
        }
      />
      <Card>
        <div className="filters">
          <Segmented<Filter>
            label="Show"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: `All (${state.notifications.length})` },
              { value: 'unread', label: `New (${unread})` },
              { value: 'alerts', label: 'Important' },
            ]}
          />
        </div>
        {items.length ? (
          <NotificationList items={items} />
        ) : (
          <EmptyState icon={<BellOff size={24} />} title={filter === 'all' ? 'No alerts' : 'Nothing here'}>
            Doorbell rings, safety alerts and routine messages show up here.
          </EmptyState>
        )}
      </Card>
    </>
  );
}
