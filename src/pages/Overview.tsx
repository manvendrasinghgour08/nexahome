import { BellRing, Check, CircleAlert, DoorOpen, LightbulbOff, ShieldCheck, ShieldOff, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FavoriteTile } from '../components/FavoriteTile';
import { RoomCard } from '../components/RoomCard';
import { SceneTile } from '../components/SceneTile';
import { HomeIllustration } from '../components/HomeIllustration';
import { DemoTag, EmptyState, Section } from '../components/ui';
import { BRAND } from '../core/brand';
import { isSwitchable } from '../core/engine';
import { formatTemp } from '../core/format';
import { useFlash } from '../state/flash';
import { useNow, useStore } from '../state/store';

function greeting(now: number) {
  const h = new Date(now).getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** "Is my home okay?" — a plain-language status with one-tap fixes. */
function HomeStatus() {
  const { state, dispatch } = useStore();
  const flash = useFlash();
  const { devices, settings, visitors, notifications } = state;
  const open = devices.filter((d) => d.type === 'contact' && d.open);
  const waiting = visitors.filter((v) => v.status === 'waiting');
  const unread = notifications.filter((n) => !n.read).length;
  const climates = devices.filter((d) => d.type === 'climate');
  const avg = climates.length ? climates.reduce((s, d) => s + d.value, 0) / climates.length : null;
  const lightsOn = devices.filter((d) => d.type === 'light' && d.on).length;
  const okay = open.length === 0 && waiting.length === 0;

  return (
    <section className={`status-panel ${okay ? 'ok' : 'attention'}`} aria-labelledby="status-title">
      <div className="status-main">
        <span className="status-icon">{okay ? <Check size={30} /> : <CircleAlert size={30} />}</span>
        <div>
          <h2 id="status-title">{okay ? 'Everything looks good' : 'A few things need a look'}</h2>
          <p>
            {open.length === 0 ? 'All doors and windows are closed.' : `${open.length} ${open.length === 1 ? 'door or window is' : 'doors or windows are'} open.`}{' '}
            {avg !== null && `Average temperature ${formatTemp(avg, settings.tempUnit)}.`} {lightsOn} {lightsOn === 1 ? 'light is' : 'lights are'} on.
          </p>
        </div>
      </div>

      <ul className="status-list">
        {open.map((c) => (
          <li key={c.id}>
            <span><DoorOpen size={18} /> <strong>{c.name}</strong> is open</span>
            <button className="btn small" onClick={() => { dispatch({ type: 'contact/set', deviceId: c.id, open: false }); flash(`${c.name} marked as closed`); }}>
              Mark as closed
            </button>
          </li>
        ))}
        {waiting.length > 0 && (
          <li>
            <span><BellRing size={18} /> <strong>{waiting[0].label}</strong> rang the doorbell <DemoTag /></span>
            <Link className="btn small" to="/doorbell">See visitor</Link>
          </li>
        )}
        <li>
          <span>
            {settings.securityArmed ? <ShieldCheck size={18} /> : <ShieldOff size={18} />} Away protection is <strong>{settings.securityArmed ? 'On' : 'Off'}</strong>
            <span className="muted"> — {settings.securityArmed ? 'you get an alert if a door opens or someone moves.' : 'turn it on when you leave home.'}</span>
          </span>
          <button className="btn small" onClick={() => { dispatch({ type: 'settings/update', patch: { securityArmed: !settings.securityArmed } }); flash(`Away protection turned ${settings.securityArmed ? 'off' : 'on'}`); }}>
            {settings.securityArmed ? 'Turn Off' : 'Turn On'}
          </button>
        </li>
        {unread > 0 && (
          <li>
            <span><BellRing size={18} /> You have <strong>{unread} new {unread === 1 ? 'alert' : 'alerts'}</strong></span>
            <Link className="btn small" to="/notifications">Read alerts</Link>
          </li>
        )}
      </ul>
    </section>
  );
}

/** The four everyday quick actions shown on Home (the rest live on the Quick actions page). */
const HOME_SCENES = ['scene-morning', 'scene-sleep', 'scene-away'];

export function Overview() {
  const { state, dispatch } = useStore();
  const flash = useFlash();
  const now = useNow(30_000);
  const favorites = state.favorites.map((id) => state.devices.find((d) => d.id === id)).filter(isSwitchable);
  const anyLightOn = state.devices.some((d) => d.type === 'light' && d.on);
  const lightsOn = state.devices.filter((d) => d.type === 'light' && d.on).length;
  const homeScenes = HOME_SCENES.map((id) => state.scenes.find((s) => s.id === id)).filter((s) => s !== undefined);
  const d = new Date(now);

  return (
    <>
      <header className="welcome">
        <div className="welcome-text">
          <h1>{greeting(now)}</h1>
          <p>
            {d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })} · Welcome to {BRAND.name}
          </p>
          <p className="welcome-line">
            This is a demo home — every device is pretend, so you can try anything safely. Tap a tile below to turn things on or off.
            {lightsOn ? ` ${lightsOn} ${lightsOn === 1 ? 'light is' : 'lights are'} on right now.` : ' All the lights are off.'}
          </p>
        </div>
        <HomeIllustration lightsOn={lightsOn > 0} />
      </header>

      <HomeStatus />

      <Section title="Your favourites" hint="Tap a tile to turn it on or off.">
        {favorites.length ? (
          <div className="fav-grid">{favorites.map((f) => <FavoriteTile key={f.id} device={f} />)}</div>
        ) : (
          <EmptyState icon={<Star size={26} />} title="No favourites yet">
            Open a room and tap <strong>Add to Home</strong> on any light or device.
          </EmptyState>
        )}
      </Section>

      <Section title="Quick actions" hint="One tap changes several things at once." actions={<Link to="/scenes" className="link">See all quick actions</Link>}>
        <div className="scene-grid compact">
          {homeScenes.map((s) => <SceneTile key={s.id} scene={s} />)}
          <button
            type="button"
            className="scene-tile plain"
            disabled={!anyLightOn}
            onClick={() => {
              dispatch({ type: 'light/setAll', on: false });
              flash('All lights are off');
            }}
          >
            <span className="scene-icon"><LightbulbOff size={22} /></span>
            <span className="scene-text">
              <strong>All lights off</strong>
              <span>{anyLightOn ? 'Switch off every light' : 'All lights are already off'}</span>
            </span>
            <span className="scene-state">{anyLightOn ? 'Start' : 'Done'}</span>
          </button>
        </div>
      </Section>

      <Section title="Rooms" actions={<Link to="/rooms" className="link">See all rooms</Link>}>
        <div className="room-grid">{state.rooms.map((r) => <RoomCard key={r.id} room={r} />)}</div>
      </Section>
    </>
  );
}
