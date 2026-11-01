import { Check, CircleAlert, DoorClosed, PersonStanding, ShieldCheck, ShieldOff } from 'lucide-react';
import { ActivityList } from '../components/ActivityList';
import { ContactCard, MotionCard } from '../components/DeviceControls';
import { Disclosure, EmptyState, PageHeader, Section } from '../components/ui';
import { Info } from 'lucide-react';
import { useStore } from '../state/store';

export function Security() {
  const { state, dispatch } = useStore();
  const { devices, settings, activity } = state;
  const contacts = devices.filter((d) => d.type === 'contact');
  const doors = contacts.filter((c) => c.kind === 'door');
  const windows = contacts.filter((c) => c.kind === 'window');
  const motions = devices.filter((d) => d.type === 'motion');
  const open = contacts.filter((c) => c.open);
  const armed = settings.securityArmed;

  return (
    <>
      <PageHeader title="Doors & Safety" back={{ to: '/', label: 'Home' }} subtitle="Check doors and windows, and protect your home while you're away. Use the “Test” buttons to practise." />

      <div className="note">
        <Info size={20} />
        <span><strong>Demo mode:</strong> these doors, windows and movement sensors are pretend. Nothing here is a real event at your home — use the “Test” buttons to see how alerts work.</span>
      </div>

      <section className={`protect-panel ${armed ? 'on' : ''}`}>
        <span className="protect-icon">{armed ? <ShieldCheck size={32} /> : <ShieldOff size={32} />}</span>
        <div className="protect-text">
          <h2>Away protection is {armed ? 'On' : 'Off'}</h2>
          <p>When it's on, you get an alert straight away if a door or window opens or someone moves inside.</p>
          <p className="protect-state">
            {open.length ? (
              <><CircleAlert size={16} /> {open.map((c) => c.name).join(', ')} {open.length === 1 ? 'is' : 'are'} open.</>
            ) : (
              <><Check size={16} /> All doors and windows are closed.</>
            )}
          </p>
        </div>
        <div className="protect-actions">
          <button className={`btn big ${armed ? '' : 'primary'}`} onClick={() => dispatch({ type: 'settings/update', patch: { securityArmed: !armed } })}>
            {armed ? 'Turn Off protection' : 'Turn On protection'}
          </button>
          {open.length > 0 && (
            <button className="btn" onClick={() => open.forEach((c) => dispatch({ type: 'contact/set', deviceId: c.id, open: false }))}>
              <DoorClosed size={18} /> Mark all as closed
            </button>
          )}
        </div>
      </section>

      <Section title="Doors">
        {doors.length ? <div className="device-grid">{doors.map((c) => <ContactCard key={c.id} sensor={c} />)}</div> : <EmptyState icon={<DoorClosed size={28} />} title="No door sensors" />}
      </Section>
      <Section title="Windows">
        {windows.length ? <div className="device-grid">{windows.map((c) => <ContactCard key={c.id} sensor={c} />)}</div> : <EmptyState icon={<DoorClosed size={28} />} title="No window sensors" />}
      </Section>
      <Section title="Movement sensors" hint="These notice when someone walks past.">
        {motions.length ? (
          <div className="device-grid">{motions.map((m) => <MotionCard key={m.id} sensor={m} />)}</div>
        ) : (
          <EmptyState icon={<PersonStanding size={28} />} title="No movement sensors" />
        )}
      </Section>

      <Disclosure label="Safety history" hint="Doors, windows and movement (demo events)">
        <ActivityList events={activity.filter((e) => e.category === 'security').slice(0, 20)} compact emptyText="Door, window and movement events appear here." />
      </Disclosure>
    </>
  );
}
