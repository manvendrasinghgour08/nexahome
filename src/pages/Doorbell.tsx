import { BellRing, Check, ChevronRight, Info, ShieldCheck, Trash2, UserRound, X } from 'lucide-react';
import { ActivityList } from '../components/ActivityList';
import { DoorbellCard } from '../components/DeviceControls';
import { Link } from 'react-router-dom';
import { Card, DemoTag, Disclosure, EmptyState, PageHeader, Status, Toggle } from '../components/ui';
import { BRAND } from '../core/brand';
import { roomName } from '../core/engine';
import { formatDateTime, relativeTime } from '../core/format';
import { useNow, useStore } from '../state/store';

export function Doorbell() {
  const { state, dispatch } = useStore();
  const now = useNow();
  const bells = state.devices.filter((d) => d.type === 'doorbell');
  const waiting = state.visitors.filter((v) => v.status === 'waiting').length;

  const clear = () => {
    if (window.confirm('Clear the visitor list?')) dispatch({ type: 'visitor/clear' });
  };

  return (
    <>
      <PageHeader title="Doorbell" back={{ to: '/', label: 'Home' }} subtitle={waiting ? `${waiting} ${waiting === 1 ? 'visitor is' : 'visitors are'} waiting.` : 'Nobody is waiting at the door.'} />

      <div className="note">
        <Info size={20} />
        <span>{BRAND.name} has no camera or video. Pressing <strong>Ring</strong> creates a pretend visitor so you can see how alerts work.</span>
      </div>

      <div className="grid-2">
        <Card title="Front door">
          <ul className="simple-status">
            <li>
              <BellRing size={18} />
              <span>Doorbell: <strong>{waiting ? 'Someone is waiting' : 'Ready'}</strong></span>
            </li>
            <li>
              <ShieldCheck size={18} />
              <span>
                Away protection: <strong>{state.settings.securityArmed ? 'On' : 'Off'}</strong> ·{' '}
                {state.devices.some((d) => d.type === 'contact' && d.open) ? 'a door or window is open' : 'all doors and windows closed'}
              </span>
              <Link to="/security" className="link">Doors & Safety <ChevronRight size={14} /></Link>
            </li>
          </ul>
          {bells.length ? (
            <div className="stack">{bells.map((b) => <DoorbellCard key={b.id} bell={b} large />)}</div>
          ) : (
            <EmptyState icon={<BellRing size={24} />} title="No doorbell">Add one in Settings → Devices & rooms.</EmptyState>
          )}
          <div className="setting-row">
            <div>
              <div className="setting-title">Pretend visitors</div>
              <div className="muted small">Let the demo ring the bell by itself now and then</div>
            </div>
            <Toggle checked={state.settings.randomVisitors} label="Pretend visitors" onChange={(v) => dispatch({ type: 'settings/update', patch: { randomVisitors: v } })} />
          </div>
        </Card>

        <Card
          title="Visitors"
          actions={<button className="btn small ghost danger" disabled={!state.visitors.length} onClick={clear}><Trash2 size={16} /> Clear list</button>}
        >
          {state.visitors.length ? (
            <ul className="visitors">
              {state.visitors.map((v) => (
                <li key={v.id} className={`visitor ${v.status}`} data-testid="visitor">
                  <span className="visitor-avatar"><UserRound size={20} /></span>
                  <div className="visitor-body">
                    <strong>{v.label} <DemoTag /></strong>
                    <span className="muted small" title={formatDateTime(v.ts)}>
                      {relativeTime(v.ts, now)} · {roomName(state, state.devices.find((d) => d.id === v.deviceId)?.roomId ?? '')}
                    </span>
                  </div>
                  {v.status === 'waiting' ? (
                    <div className="row">
                      <button className="btn small" aria-label={`Mark ${v.label} as answered`} onClick={() => dispatch({ type: 'visitor/status', visitorId: v.id, status: 'answered' })}><Check size={16} /> Answered</button>
                      <button className="btn small ghost" aria-label={`Mark ${v.label} as missed`} onClick={() => dispatch({ type: 'visitor/status', visitorId: v.id, status: 'missed' })}><X size={16} /> Missed</button>
                    </div>
                  ) : (
                    <Status tone={v.status === 'answered' ? 'success' : 'neutral'}>{v.status === 'answered' ? 'Answered' : 'Missed'}</Status>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<UserRound size={24} />} title="No visitors yet">Press Ring to try it out.</EmptyState>
          )}
        </Card>
      </div>

      <Disclosure label="Doorbell history" hint="Every ring and what happened (demo)">
        <ActivityList events={state.activity.filter((e) => e.category === 'doorbell').slice(0, 20)} compact emptyText="Rings appear here." />
      </Disclosure>
    </>
  );
}
