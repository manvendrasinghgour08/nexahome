import { BellRing, Droplets, Lightbulb, LightbulbOff, ShieldCheck, Sparkles, Thermometer } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { DeviceCard } from '../components/DeviceControls';
import { RoomCard } from '../components/RoomCard';
import { RoomImage } from '../components/RoomImage';
import { EmptyState, LinkTile, PageHeader, Section } from '../components/ui';
import { roomClimate } from '../core/engine';
import { formatTemp } from '../core/format';
import type { Device, DeviceType } from '../core/types';
import { useStore } from '../state/store';

export function Rooms() {
  const { state } = useStore();
  return (
    <>
      <PageHeader title="Rooms" subtitle="Pick a room to see and control everything in it." />
      <div className="room-grid large">
        {state.rooms.map((r) => <RoomCard key={r.id} room={r} />)}
      </div>
      <Section title="Browse by type" hint="See the same kind of device from every room together.">
        <div className="link-grid">
          <LinkTile to="/lighting" icon={<Lightbulb size={22} />} title="Lights" text="Turn lights on or off, dim them, change colour" />
          <LinkTile to="/climate" icon={<Thermometer size={22} />} title="Temperature" text="How warm each room is, heating and cooling" />
          <LinkTile to="/security" icon={<ShieldCheck size={22} />} title="Doors & Safety" text="Doors, windows, movement and Away protection" />
          <LinkTile to="/doorbell" icon={<BellRing size={22} />} title="Doorbell" text="Ring the bell and see who visited" />
          <LinkTile to="/scenes" icon={<Sparkles size={22} />} title="Quick actions" text="Good Morning, Movie Night, Away, Sleep" />
        </div>
      </Section>
      <p className="muted small">Want to add or remove a room? Go to <Link to="/settings">Settings → Devices & rooms</Link>.</p>
    </>
  );
}

const GROUPS: { title: string; types: DeviceType[] }[] = [
  { title: 'Lights', types: ['light'] },
  { title: 'Devices', types: ['appliance'] },
  { title: 'Temperature', types: ['thermostat', 'climate'] },
  { title: 'Doors, windows & movement', types: ['contact', 'motion'] },
  { title: 'Doorbell', types: ['doorbell'] },
];

export function RoomDetail() {
  const { roomId } = useParams();
  const { state, dispatch } = useStore();
  const room = state.rooms.find((r) => r.id === roomId);
  if (!room) {
    return (
      <EmptyState icon={<Lightbulb size={28} />} title="Room not found">
        <Link to="/rooms">Back to rooms</Link>
      </EmptyState>
    );
  }
  const unit = state.settings.tempUnit;
  const devices = state.devices.filter((d) => d.roomId === room.id);
  const climate = roomClimate(state, room.id);
  const lights = devices.filter((d) => d.type === 'light');

  return (
    <>
      <PageHeader title={room.name} back={{ to: '/rooms', label: 'All rooms' }} />
      <section className="room-hero">
        <RoomImage kind={room.kind} alt={`${room.name} photo`} />
        <div className="room-hero-info">
          {climate && (
            <>
              <span className="info-pill"><Thermometer size={18} /> {formatTemp(climate.value, unit)}</span>
              <span className="info-pill"><Droplets size={18} /> {climate.humidity}% humidity</span>
            </>
          )}
          <span className="info-pill">{devices.length} devices</span>
        </div>
      </section>

      {lights.length > 0 && (
        <div className="row">
          <button className="btn" disabled={lights.every((l) => l.on)} onClick={() => dispatch({ type: 'light/setAll', on: true, roomId: room.id })}>
            <Lightbulb size={18} /> Turn on all lights
          </button>
          <button className="btn" disabled={lights.every((l) => !l.on)} onClick={() => dispatch({ type: 'light/setAll', on: false, roomId: room.id })}>
            <LightbulbOff size={18} /> Turn off all lights
          </button>
        </div>
      )}

      {devices.length === 0 && <EmptyState icon={<Lightbulb size={28} />} title="No devices in this room">Add some in Settings → Devices & rooms.</EmptyState>}

      {GROUPS.map((g) => {
        const list = devices.filter((d: Device) => g.types.includes(d.type));
        return list.length ? (
          <Section key={g.title} title={g.title}>
            <div className="device-grid">{list.map((d) => <DeviceCard key={d.id} device={d} />)}</div>
          </Section>
        ) : null;
      })}
    </>
  );
}
