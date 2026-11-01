import { BellRing, Check, CircleAlert, Droplets, Minus, Plus, Star } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { isSwitchable, roomClimate, roomName, THERMOSTAT_MAX, THERMOSTAT_MIN } from '../core/engine';
import { APPLIANCE_LABEL, formatTemp, HEX_RE, LIGHT_COLORS, MODE_HELP, MODE_LABEL, relativeTime } from '../core/format';
import { hvacState, pickVisitor } from '../core/simulation';
import type { Device, DeviceOf, ThermostatMode } from '../core/types';
import { playDoorbell } from '../state/sound';
import { useFlash } from '../state/flash';
import { useNow, useStore } from '../state/store';
import { DeviceIcon } from './DeviceIcon';
import { DemoTag, Disclosure, PowerButton, Segmented, Status } from './ui';

/** "Add to Home" / "On Home" — pins a device to the Home screen favourites. */
export function FavoriteButton({ device }: { device: Device }) {
  const { state, dispatch } = useStore();
  const pinned = state.favorites.includes(device.id);
  const flash = useFlash();
  return (
    <button
      type="button"
      className={`fav-btn ${pinned ? 'pinned' : ''}`}
      aria-pressed={pinned}
      aria-label={pinned ? `Remove ${device.name} from Home` : `Add ${device.name} to Home`}
      onClick={() => {
        dispatch({ type: 'favorite/toggle', deviceId: device.id });
        flash(pinned ? `${device.name} removed from Home` : `${device.name} added to Home`);
      }}
    >
      <Star size={16} fill={pinned ? 'currentColor' : 'none'} />
      {pinned ? 'On Home' : 'Add to Home'}
    </button>
  );
}

function Head({ device, status, iconStyle }: { device: Device; status: ReactNode; iconStyle?: CSSProperties }) {
  const { state } = useStore();
  return (
    <div className="device-head">
      <span className="device-icon" style={iconStyle}>
        <DeviceIcon device={device} size={24} />
      </span>
      <div className="device-title">
        <div className="device-name">{device.name}</div>
        <div className="device-room">{roomName(state, device.roomId)} <DemoTag /></div>
      </div>
      {status}
    </div>
  );
}

const onOff = (on: boolean) => <Status tone={on ? 'on' : 'neutral'}>{on ? 'On' : 'Off'}</Status>;

export function LightCard({ light }: { light: DeviceOf<'light'> }) {
  const { dispatch } = useStore();
  const custom = !LIGHT_COLORS.some((c) => c.hex === light.color);
  return (
    <div className={`device-card light-card ${light.on ? 'is-on' : ''}`} style={{ '--light': light.color } as CSSProperties} data-testid={`light-${light.id}`}>
      <Head device={light} status={onOff(light.on)} />
      <p className="device-line">{light.on ? `Shining at ${light.brightness}% brightness` : 'The light is off'}</p>
      <PowerButton on={light.on} name={light.name} onToggle={() => dispatch({ type: 'device/toggle', deviceId: light.id })} />
      <Disclosure label="Brightness & colour" hint={`${light.brightness}% · ${LIGHT_COLORS.find((c) => c.hex === light.color)?.name ?? 'Custom colour'}`}>
        <label className="slider-field">
          <span>Brightness <strong>{light.brightness}%</strong></span>
          <input
            type="range"
            min={1}
            max={100}
            value={light.brightness}
            aria-label={`Brightness for ${light.name}`}
            onChange={(e) => dispatch({ type: 'light/brightness', deviceId: light.id, brightness: Number(e.target.value) })}
            style={{ '--pct': `${light.brightness}%` } as CSSProperties}
          />
        </label>
        <div className="swatch-label">Colour</div>
        <div className="swatches" role="group" aria-label={`Colour for ${light.name}`}>
          {LIGHT_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              className={`swatch ${light.color === c.hex ? 'selected' : ''}`}
              style={{ '--swatch': c.hex } as CSSProperties}
              aria-label={`${c.name} for ${light.name}`}
              aria-pressed={light.color === c.hex}
              onClick={() => dispatch({ type: 'light/color', deviceId: light.id, color: c.hex })}
            >
              <span className="swatch-dot" />
              <span className="swatch-name">{c.name}</span>
            </button>
          ))}
          <label className={`swatch custom ${custom ? 'selected' : ''}`}>
            <span className="swatch-dot" style={custom ? { background: light.color } : undefined} />
            <span className="swatch-name">Any colour</span>
            <input
              type="color"
              aria-label={`Custom colour for ${light.name}`}
              value={HEX_RE.test(light.color) ? light.color : '#ffffff'}
              onChange={(e) => dispatch({ type: 'light/color', deviceId: light.id, color: e.target.value })}
            />
          </label>
        </div>
      </Disclosure>
      <FavoriteButton device={light} />
    </div>
  );
}

export function ApplianceCard({ device }: { device: DeviceOf<'appliance'> }) {
  const { dispatch } = useStore();
  return (
    <div className={`device-card appliance-card ${device.on ? 'is-on' : ''}`} data-testid={`appliance-${device.id}`}>
      <Head device={device} status={onOff(device.on)} />
      <p className="device-line">{APPLIANCE_LABEL[device.kind]} · {device.on ? 'running' : 'switched off'}</p>
      <PowerButton on={device.on} name={device.name} onToggle={() => dispatch({ type: 'device/toggle', deviceId: device.id })} />
      <FavoriteButton device={device} />
    </div>
  );
}

const HVAC_TEXT = { off: 'Switched off', idle: 'Room is just right', heating: 'Warming the room', cooling: 'Cooling the room' };

export function ThermostatCard({ device }: { device: DeviceOf<'thermostat'> }) {
  const { state, dispatch } = useStore();
  const unit = state.settings.tempUnit;
  const current = roomClimate(state, device.roomId)?.value;
  const hvac = hvacState(device, current);
  const step = (delta: number) => dispatch({ type: 'thermostat/set', deviceId: device.id, target: device.target + delta });
  return (
    <div className={`device-card thermostat-card hvac-${hvac}`} data-testid={`thermostat-${device.id}`}>
      <Head device={device} status={<Status tone={hvac === 'off' ? 'neutral' : 'on'}>{HVAC_TEXT[hvac]}</Status>} />
      <p className="device-line">The room is {current === undefined ? 'unknown' : formatTemp(current, unit)} right now.</p>
      <div className="target-row">
        <button className="round-btn" aria-label={`Make ${device.name} cooler`} disabled={device.mode === 'off' || device.target <= THERMOSTAT_MIN} onClick={() => step(-0.5)}>
          <Minus size={22} />
        </button>
        <div className="target-value" aria-live="polite">
          <span>Keep the room at</span>
          <strong>{device.mode === 'off' ? 'Off' : formatTemp(device.target, unit)}</strong>
        </div>
        <button className="round-btn" aria-label={`Make ${device.name} warmer`} disabled={device.mode === 'off' || device.target >= THERMOSTAT_MAX} onClick={() => step(0.5)}>
          <Plus size={22} />
        </button>
      </div>
      <Segmented<ThermostatMode>
        label={`${device.name} mode`}
        value={device.mode}
        onChange={(mode) => dispatch({ type: 'thermostat/set', deviceId: device.id, mode })}
        options={(['off', 'heat', 'cool', 'auto'] as const).map((m) => ({ value: m, label: MODE_LABEL[m] }))}
      />
      <p className="help-text">{MODE_HELP[device.mode]}</p>
    </div>
  );
}

export function ClimateCard({ sensor }: { sensor: DeviceOf<'climate'> }) {
  const { state } = useStore();
  const unit = state.settings.tempUnit;
  const prev = sensor.readings.length > 1 ? sensor.readings[sensor.readings.length - 2].value : sensor.value;
  const trend = sensor.value > prev ? 'Getting warmer' : sensor.value < prev ? 'Getting cooler' : 'Steady';
  return (
    <div className="device-card climate-card" data-testid={`climate-${sensor.id}`}>
      <Head device={sensor} status={<Status tone="neutral">{trend}</Status>} />
      <div className="climate-values">
        <div>
          <span className="value-label">Temperature</span>
          <span className="temp-value">{formatTemp(sensor.value, unit)}</span>
        </div>
        <div>
          <span className="value-label">Humidity</span>
          <span className="humidity"><Droplets size={18} /> {sensor.humidity}%</span>
        </div>
      </div>
      <p className="help-text">Humidity means how damp the air is. Around 40–60% feels comfortable.</p>
    </div>
  );
}

export function ContactCard({ sensor }: { sensor: DeviceOf<'contact'> }) {
  const { dispatch } = useStore();
  const now = useNow();
  return (
    <div className={`device-card ${sensor.open ? 'is-alert' : 'is-ok'}`} data-testid={`contact-${sensor.id}`}>
      <Head
        device={sensor}
        status={sensor.open ? <Status tone="warning" icon={<CircleAlert size={16} />}>Open</Status> : <Status tone="success" icon={<Check size={16} />}>Closed</Status>}
      />
      <p className="device-line">
        The {sensor.kind} is {sensor.open ? 'open' : 'closed'} · changed {relativeTime(sensor.lastChangedAt, now)}
      </p>
      <button className="btn test-btn" onClick={() => dispatch({ type: 'contact/set', deviceId: sensor.id, open: !sensor.open })}>
        Test: {sensor.open ? 'close' : 'open'} the {sensor.kind}
      </button>
    </div>
  );
}

export function MotionCard({ sensor }: { sensor: DeviceOf<'motion'> }) {
  const { dispatch } = useStore();
  const now = useNow();
  return (
    <div className={`device-card ${sensor.detected ? 'is-motion' : ''}`} data-testid={`motion-${sensor.id}`}>
      <Head
        device={sensor}
        status={sensor.detected ? <Status tone="alert" icon={<CircleAlert size={16} />}>Movement now</Status> : <Status tone="neutral">No movement</Status>}
      />
      <p className="device-line">Notices when someone walks by · last time {relativeTime(sensor.lastDetectedAt, now)}</p>
      <button className="btn test-btn" onClick={() => dispatch({ type: 'motion/detect', deviceId: sensor.id })}>
        Test: someone walks by
      </button>
    </div>
  );
}

/** Ring a doorbell with a randomly chosen pretend visitor. */
export function useRing() {
  const { state, dispatch } = useStore();
  return (deviceId: string) => {
    dispatch({ type: 'doorbell/ring', deviceId, visitor: pickVisitor() });
    if (state.settings.doorbellSound) playDoorbell();
  };
}

export function DoorbellCard({ bell, large = false }: { bell: DeviceOf<'doorbell'>; large?: boolean }) {
  const { state } = useStore();
  const ring = useRing();
  const now = useNow(5000);
  const recent = bell.lastRingAt !== null && now - bell.lastRingAt < 10_000;
  return (
    <div className={`doorbell ${large ? 'large' : ''}`} data-testid={`doorbell-${bell.id}`}>
      <button className={`ring-btn ${recent ? 'ringing' : ''}`} onClick={() => ring(bell.id)} aria-label={`Ring ${bell.name}`}>
        <BellRing size={large ? 34 : 26} />
        <span>Ring</span>
      </button>
      <div>
        <div className="device-name">{bell.name}</div>
        <div className="device-room">{roomName(state, bell.roomId)} <DemoTag /></div>
        <div className="device-line">
          Last rang {relativeTime(bell.lastRingAt, now)} · {bell.ringCount} {bell.ringCount === 1 ? 'time' : 'times'} in total
        </div>
      </div>
    </div>
  );
}

/** The right control card for any device. */
export function DeviceCard({ device }: { device: Device }) {
  switch (device.type) {
    case 'light': return <LightCard light={device} />;
    case 'appliance': return <ApplianceCard device={device} />;
    case 'thermostat': return <ThermostatCard device={device} />;
    case 'climate': return <ClimateCard sensor={device} />;
    case 'contact': return <ContactCard sensor={device} />;
    case 'motion': return <MotionCard sensor={device} />;
    case 'doorbell':
      return (
        <div className="device-card">
          <DoorbellCard bell={device} />
        </div>
      );
  }
}

export { isSwitchable };
