import { Bell, ChevronRight, Download, History, Palette, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { DeviceIcon } from '../components/DeviceIcon';
import { Card, Disclosure, PageHeader, Segmented, Toggle } from '../components/ui';
import { BRAND } from '../core/brand';
import { APPLIANCE_LABEL, DEVICE_TYPE_LABEL, fromUnit, ROOM_KIND_LABEL } from '../core/format';
import type { ApplianceKind, Device, DeviceType, NewDevice, RoomKind, Settings } from '../core/types';
import { useStore } from '../state/store';

function SettingRow({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="setting-row">
      <div>
        <div className="setting-title">{title}</div>
        {hint && <div className="muted small">{hint}</div>}
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}

function ManualReading() {
  const { state, dispatch } = useStore();
  const sensors = state.devices.filter((d) => d.type === 'climate');
  const unit = state.settings.tempUnit;
  const [sensorId, setSensorId] = useState(sensors[0]?.id ?? '');
  const [value, setValue] = useState('');
  const [humidity, setHumidity] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const current = sensors.some((s) => s.id === sensorId) ? sensorId : sensors[0]?.id ?? '';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(value);
    const celsius = fromUnit(n, unit);
    const h = humidity.trim() === '' ? undefined : Number(humidity);
    setDone('');
    if (value.trim() === '' || !Number.isFinite(n) || celsius < -30 || celsius > 60) return setError(`Enter a temperature between ${unit === 'C' ? '-30 and 60' : '-22 and 140'} °${unit}.`);
    if (h !== undefined && (!Number.isFinite(h) || h < 0 || h > 100)) return setError('Humidity must be between 0 and 100%.');
    setError('');
    dispatch({ type: 'climate/reading', deviceId: current, value: celsius, humidity: h, manual: true });
    setDone(`Done — ${sensors.find((s) => s.id === current)?.name} now reads ${value}°${unit}.`);
    setValue('');
    setHumidity('');
  };

  if (!sensors.length) return <p className="muted small">Add a temperature sensor first.</p>;
  return (
    <form className="inline-form" onSubmit={submit} noValidate>
      <select value={current} onChange={(e) => setSensorId(e.target.value)} aria-label="Sensor">
        {sensors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <input type="number" step="0.1" value={value} onChange={(e) => setValue(e.target.value)} placeholder={`Temperature °${unit}`} aria-label="Temperature value" />
      <input type="number" step="1" value={humidity} onChange={(e) => setHumidity(e.target.value)} placeholder="Humidity % (optional)" aria-label="Humidity value" />
      <button className="btn" type="submit">Set</button>
      {error && <span className="field-error" role="alert">{error}</span>}
      {done && <span className="field-ok" role="status">{done}</span>}
    </form>
  );
}

function DeviceEditor({ device }: { device: Device }) {
  const { state, dispatch } = useStore();
  const [name, setName] = useState(device.name);
  const [roomId, setRoomId] = useState(device.roomId);
  const dirty = name.trim() !== device.name || roomId !== device.roomId;
  const uses = (id: string) => (x: object) => 'deviceId' in x && x.deviceId === id;
  const ruleCount = state.rules.filter((r) => uses(device.id)(r.trigger) || r.actions.some(uses(device.id)) || r.conditions.some(uses(device.id))).length;

  const remove = () => {
    const extra = ruleCount ? `\n\n${ruleCount} routine(s) use it and will be updated or removed.` : '';
    if (window.confirm(`Remove “${device.name}”?${extra}`)) dispatch({ type: 'device/delete', deviceId: device.id });
  };

  return (
    <form
      className="device-editor"
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty && name.trim()) dispatch({ type: 'device/update', deviceId: device.id, name, roomId });
      }}
    >
      <span className="row-icon"><DeviceIcon device={device} size={18} /></span>
      <input value={name} onChange={(e) => setName(e.target.value)} aria-label={`Name of ${device.name}`} maxLength={50} />
      <select value={roomId} onChange={(e) => setRoomId(e.target.value)} aria-label={`Room of ${device.name}`}>
        {state.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      <span className="muted small type-label">{device.type === 'appliance' ? APPLIANCE_LABEL[device.kind] : DEVICE_TYPE_LABEL[device.type]}</span>
      <button className="btn small" type="submit" disabled={!dirty || !name.trim()} aria-label={`Save ${device.name}`}><Save size={16} /> Save</button>
      <button className="btn small ghost danger" type="button" onClick={remove} aria-label={`Remove ${device.name}`}><Trash2 size={16} /> Remove</button>
    </form>
  );
}

function AddDevice() {
  const { state, dispatch } = useStore();
  const [name, setName] = useState('');
  const [type, setType] = useState<DeviceType>('light');
  const [contactKind, setContactKind] = useState<'door' | 'window'>('door');
  const [applianceKind, setApplianceKind] = useState<ApplianceKind>('tv');
  const [roomId, setRoomId] = useState(state.rooms[0]?.id ?? '');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const room = state.rooms.some((r) => r.id === roomId) ? roomId : state.rooms[0]?.id ?? '';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setDone('');
    if (!name.trim()) return setError('Type a name for the new device.');
    if (!room) return setError('Create a room first.');
    setError('');
    const device: NewDevice =
      type === 'contact' ? { type, kind: contactKind, name, roomId: room }
      : type === 'appliance' ? { type, kind: applianceKind, name, roomId: room }
      : { type, name, roomId: room };
    dispatch({ type: 'device/add', device });
    setDone(`Added “${name.trim()}”.`);
    setName('');
  };

  return (
    <form className="inline-form add-device" onSubmit={submit} noValidate>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Desk Lamp" aria-label="New device name" maxLength={50} />
      <select value={type} onChange={(e) => setType(e.target.value as DeviceType)} aria-label="Device type">
        {(Object.keys(DEVICE_TYPE_LABEL) as DeviceType[]).map((t) => <option key={t} value={t}>{DEVICE_TYPE_LABEL[t]}</option>)}
      </select>
      {type === 'contact' && (
        <select value={contactKind} onChange={(e) => setContactKind(e.target.value as 'door' | 'window')} aria-label="Sensor kind">
          <option value="door">Door</option>
          <option value="window">Window</option>
        </select>
      )}
      {type === 'appliance' && (
        <select value={applianceKind} onChange={(e) => setApplianceKind(e.target.value as ApplianceKind)} aria-label="Appliance kind">
          {(Object.keys(APPLIANCE_LABEL) as ApplianceKind[]).map((k) => <option key={k} value={k}>{APPLIANCE_LABEL[k]}</option>)}
        </select>
      )}
      <select value={room} onChange={(e) => setRoomId(e.target.value)} aria-label="Room for new device">
        {state.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      <button className="btn primary" type="submit"><Plus size={18} /> Add device</button>
      {error && <span className="field-error" role="alert">{error}</span>}
      {done && <span className="field-ok" role="status">{done}</span>}
    </form>
  );
}

function Rooms() {
  const { state, dispatch } = useStore();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<RoomKind>('other');
  const [error, setError] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError('Type a name for the new room.');
    if (state.rooms.some((r) => r.name.toLowerCase() === n.toLowerCase())) return setError('You already have a room with that name.');
    setError('');
    dispatch({ type: 'room/add', name: n, kind });
    setName('');
  };
  return (
    <>
      <ul className="room-list">
        {state.rooms.map((r) => {
          const count = state.devices.filter((d) => d.roomId === r.id).length;
          return (
            <li key={r.id}>
              <span>{r.name}</span>
              <span className="muted small">{count} device{count === 1 ? '' : 's'}</span>
              <button
                className="btn small ghost danger"
                disabled={count > 0}
                title={count > 0 ? 'Move or remove its devices first' : 'Remove room'}
                aria-label={`Remove room ${r.name}`}
                onClick={() => dispatch({ type: 'room/delete', roomId: r.id })}
              >
                <Trash2 size={16} /> Remove
              </button>
            </li>
          );
        })}
      </ul>
      <p className="muted small">A room can only be removed when it has no devices.</p>
      <form className="inline-form" onSubmit={submit} noValidate>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Room name, e.g. Study" aria-label="New room name" maxLength={40} />
        <select value={kind} onChange={(e) => setKind(e.target.value as RoomKind)} aria-label="Room photo">
          {(Object.keys(ROOM_KIND_LABEL) as RoomKind[]).map((k) => <option key={k} value={k}>Photo: {ROOM_KIND_LABEL[k]}</option>)}
        </select>
        <button className="btn" type="submit"><Plus size={18} /> Add room</button>
        {error && <span className="field-error" role="alert">{error}</span>}
      </form>
    </>
  );
}

const CREDITS = [
  ['Living room', 'photo-1618221195710-dd6b41faaea6'],
  ['Bedroom', 'photo-1616594039964-ae9021a400a0'],
  ['Kitchen', 'photo-1556911220-bff31c812dba'],
  ['Bathroom', 'photo-1620626011761-996317b8d101'],
  ['Entrance', 'photo-1600585154340-be6161a56a0c'],
  ['Study room', 'photo-1600494603989-9650cf6ddd3d'],
];

export function SettingsPage() {
  const { state, dispatch, simulateTick } = useStore();
  const s = state.settings;
  const update = (patch: Partial<Settings>) => dispatch({ type: 'settings/update', patch });
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }, [hash]);

  const exportBackup = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ ...state, toasts: [] }, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${BRAND.filePrefix}-backup-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    if (window.confirm('Start over with the demo home? Devices, rooms, routines, history and alerts go back to how they were at the start. Your look & feel settings are kept.')) dispatch({ type: 'state/reset' });
  };

  return (
    <>
      <PageHeader title="Settings" subtitle={`Make ${BRAND.name} look and behave the way you like.`} />

      <div className="grid-2">
        <Card title="Look & feel" icon={<Palette size={20} />}>
          <SettingRow title="Colour theme" hint="Light is easiest to read in the day">
            <Segmented<Settings['theme']>
              label="Theme"
              value={s.theme}
              onChange={(theme) => update({ theme })}
              options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Night' }, { value: 'system', label: 'Same as device' }]}
            />
          </SettingRow>
          <SettingRow title="Larger text" hint="Makes all the writing bigger">
            <Toggle checked={s.largeText} label="Larger text" onChange={(v) => update({ largeText: v })} />
          </SettingRow>
          <SettingRow title="Temperature in">
            <Segmented label="Temperature unit setting" value={s.tempUnit} onChange={(tempUnit) => update({ tempUnit })} options={[{ value: 'C', label: '°C Celsius' }, { value: 'F', label: '°F Fahrenheit' }]} />
          </SettingRow>
        </Card>

        <Card title="Sounds & alerts" icon={<Bell size={20} />}>
          <SettingRow title="Pop-up alerts" hint="Show a message at the bottom of the screen. Alerts are always saved either way.">
            <Toggle checked={s.notifications} label="Pop-up notifications" onChange={(v) => update({ notifications: v })} />
          </SettingRow>
          <SettingRow title="Doorbell sound" hint="Play a ding-dong when the doorbell rings">
            <Toggle checked={s.doorbellSound} label="Doorbell sound" onChange={(v) => update({ doorbellSound: v })} />
          </SettingRow>
          <SettingRow title="Away protection" hint="Alert me if a door opens or someone moves">
            <Toggle checked={s.securityArmed} label="Security armed" onChange={(v) => update({ securityArmed: v })} />
          </SettingRow>
          <Link to="/activity" className="row-link"><History size={18} /> See everything that happened (History) <ChevronRight size={18} /></Link>
        </Card>
      </div>

      <div id="rooms" className="stack">
        <h2 className="section-title">Devices & rooms</h2>
        <Disclosure label={`Your devices (${state.devices.length})`} hint="Add, rename, move or remove lights and other devices">
          <AddDevice />
          <div className="device-editors">
            {state.devices.map((d) => <DeviceEditor key={d.id + d.name + d.roomId} device={d} />)}
          </div>
        </Disclosure>
        <Disclosure label={`Your rooms (${state.rooms.length})`} hint="Add or remove rooms">
          <Rooms />
        </Disclosure>
      </div>

      <div className="stack">
        <h2 className="section-title">Advanced</h2>
        <p className="muted">You don't need these for everyday use.</p>

        <Disclosure advanced label="Demo simulation" hint="How the pretend devices behave">
          <SettingRow title="Run the demo" hint="Pretend sensors send new readings by themselves">
            <Toggle checked={s.simulationRunning} label="Run simulation" onChange={(v) => update({ simulationRunning: v })} />
          </SettingRow>
          <SettingRow title="New readings every">
            <select value={s.tickSeconds} onChange={(e) => update({ tickSeconds: Number(e.target.value) })} aria-label="Update interval">
              {[2, 5, 10, 30, 60].map((n) => <option key={n} value={n}>{n} seconds</option>)}
            </select>
          </SettingRow>
          <SettingRow title="Pretend movement" hint="Movement sensors sometimes notice someone">
            <Toggle checked={s.randomMotion} label="Random motion" onChange={(v) => update({ randomMotion: v })} />
          </SettingRow>
          <SettingRow title="Pretend doors & windows" hint="They sometimes open or close by themselves">
            <Toggle checked={s.randomContacts} label="Random doors and windows" onChange={(v) => update({ randomContacts: v })} />
          </SettingRow>
          <SettingRow title="Pretend visitors" hint="The doorbell sometimes rings">
            <Toggle checked={s.randomVisitors} label="Random visitors" onChange={(v) => update({ randomVisitors: v })} />
          </SettingRow>
          <SettingRow title="Movement clears after">
            <select value={s.motionResetSeconds} onChange={(e) => update({ motionResetSeconds: Number(e.target.value) })} aria-label="Motion reset time">
              {[5, 15, 30, 60].map((n) => <option key={n} value={n}>{n} seconds</option>)}
            </select>
          </SettingRow>
          <SettingRow title="New readings now" hint="Get one round of readings straight away">
            <button className="btn" onClick={simulateTick}>Get readings</button>
          </SettingRow>
        </Disclosure>

        <Disclosure advanced label="Set a test temperature" hint="Useful for trying out temperature routines">
          <ManualReading />
        </Disclosure>

        <Disclosure advanced label="Backup & start over" hint="Save a copy of your setup, or reset the demo home">
          <p className="muted small">Everything is saved automatically in this browser. Nothing is sent anywhere and no real devices are needed.</p>
          <div className="row">
            <button className="btn" onClick={exportBackup}><Download size={18} /> Download a backup</button>
            <button className="btn ghost danger" onClick={reset}><RotateCcw size={18} /> Reset demo data</button>
          </div>
        </Disclosure>

        <Disclosure advanced label="About & photo credits">
          <p><strong>{BRAND.dashboard}</strong> — {BRAND.tagline}</p>
          <p className="muted small">Room photos are from Unsplash (free to use under the Unsplash License) and are stored inside the app:</p>
          <ul className="credits">
            {CREDITS.map(([label, id]) => (
              <li key={id}><a href={`https://images.unsplash.com/${id}`} target="_blank" rel="noreferrer noopener">{label}</a></li>
            ))}
          </ul>
        </Disclosure>
      </div>
    </>
  );
}
