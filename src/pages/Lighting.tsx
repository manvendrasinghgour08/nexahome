import { BookOpen, Lightbulb, LightbulbOff, Moon, PartyPopper, Sofa, Sun } from 'lucide-react';
import type { CSSProperties } from 'react';
import { LightCard } from '../components/DeviceControls';
import { EmptyState, PageHeader, Section } from '../components/ui';
import { roomName } from '../core/engine';
import { usePersistentState, useStore } from '../state/store';

/** Light moods: one brightness + colour applied to every light in the chosen room. */
const MOODS = [
  { name: 'Bright', brightness: 100, color: '#e6f0ff', icon: Sun, text: 'Full, clear light' },
  { name: 'Relax', brightness: 45, color: '#ffd29a', icon: Sofa, text: 'Soft and warm' },
  { name: 'Reading', brightness: 85, color: '#fff1d6', icon: BookOpen, text: 'Easy on the eyes' },
  { name: 'Night light', brightness: 8, color: '#ffab4a', icon: Moon, text: 'Just a gentle glow' },
  { name: 'Party', brightness: 70, color: '#ff6b9a', icon: PartyPopper, text: 'Colourful and fun' },
];

export function Lighting() {
  const { state, dispatch } = useStore();
  const lights = state.devices.filter((d) => d.type === 'light');
  const roomsWithLights = state.rooms.filter((r) => lights.some((l) => l.roomId === r.id));
  const [saved, setRoom] = usePersistentState<string>('lighting-room', 'all');
  const roomId = saved === 'all' || roomsWithLights.some((r) => r.id === saved) ? saved : 'all';
  const visible = lights.filter((l) => roomId === 'all' || l.roomId === roomId);
  const onCount = visible.filter((l) => l.on).length;
  const scope = roomId === 'all' ? undefined : roomId;
  const where = scope ? `the ${roomName(state, scope)}` : 'every room';

  return (
    <>
      <PageHeader
        title="Lights"
        back={{ to: '/rooms', label: 'Rooms' }}
        subtitle={`${onCount} of ${visible.length} lights are on in ${where}. Lights remember their brightness and colour.`}
        actions={
          <>
            <button className="btn" disabled={onCount === visible.length} onClick={() => dispatch({ type: 'light/setAll', on: true, roomId: scope })}>
              <Lightbulb size={18} /> Turn all on
            </button>
            <button className="btn" disabled={onCount === 0} onClick={() => dispatch({ type: 'light/setAll', on: false, roomId: scope })}>
              <LightbulbOff size={18} /> Turn all off
            </button>
          </>
        }
      />
      <div className="tabs" role="tablist" aria-label="Choose a room">
        {[{ id: 'all', name: 'All rooms' }, ...roomsWithLights].map((r) => (
          <button key={r.id} role="tab" aria-selected={roomId === r.id} className={`tab ${roomId === r.id ? 'active' : ''}`} onClick={() => setRoom(r.id)}>
            {r.name}
          </button>
        ))}
      </div>

      <Section title="Light moods" hint={`Sets every light in ${where} at once.`}>
        <div className="mood-grid">
          {MOODS.map((m) => (
            <button
              key={m.name}
              className="mood"
              style={{ '--light': m.color } as CSSProperties}
              disabled={visible.length === 0}
              onClick={() => dispatch({ type: 'light/preset', name: m.name, brightness: m.brightness, color: m.color, roomId: scope })}
            >
              <span className="mood-icon"><m.icon size={20} /></span>
              <strong>{m.name}</strong>
              <span>{m.text}</span>
            </button>
          ))}
        </div>
      </Section>

      {visible.length ? (
        <div className="device-grid">{visible.map((l) => <LightCard key={l.id} light={l} />)}</div>
      ) : (
        <EmptyState icon={<Lightbulb size={28} />} title="No lights here">Add lights in Settings → Devices & rooms.</EmptyState>
      )}
    </>
  );
}
