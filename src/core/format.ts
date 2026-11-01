import type { ApplianceKind, DeviceType, RoomKind, Settings, ThermostatMode } from './types';

export const toUnit = (celsius: number, unit: Settings['tempUnit']) =>
  unit === 'F' ? celsius * 1.8 + 32 : celsius;

export const fromUnit = (value: number, unit: Settings['tempUnit']) =>
  unit === 'F' ? (value - 32) / 1.8 : value;

export const formatTemp = (celsius: number, unit: Settings['tempUnit']) =>
  `${toUnit(celsius, unit).toFixed(1)}°${unit}`;

export const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const formatDateTime = (ts: number) =>
  new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function relativeTime(ts: number | null, now = Date.now()): string {
  if (ts === null) return 'never';
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return formatDateTime(ts);
}

// ---------- clock helpers (local time, "HH:MM") ----------

export const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const isValidTime = (s: string) => TIME_RE.test(s);
export const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
export const minutesOfDay = (ts: number) => {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
};
export const hhmm = (ts: number) => {
  const m = minutesOfDay(ts);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
/** 12-hour label for an "HH:MM" string, e.g. "19:00" → "7:00 PM". */
export function timeLabel(s: string): string {
  if (!isValidTime(s)) return s;
  const h = Number(s.slice(0, 2));
  return `${h % 12 || 12}:${s.slice(3)} ${h < 12 ? 'AM' : 'PM'}`;
}

// ---------- labels ----------

export const DEVICE_TYPE_LABEL: Record<DeviceType, string> = {
  light: 'Light',
  appliance: 'Appliance',
  thermostat: 'Heating & cooling',
  doorbell: 'Doorbell',
  climate: 'Temperature sensor',
  contact: 'Door/window sensor',
  motion: 'Movement sensor',
};

export const APPLIANCE_LABEL: Record<ApplianceKind, string> = {
  tv: 'TV',
  fan: 'Fan',
  speaker: 'Speaker',
  plug: 'Plug socket',
};

export const MODE_LABEL: Record<ThermostatMode, string> = { off: 'Off', heat: 'Warm up', cool: 'Cool down', auto: 'Automatic' };

/** One-line explanation of each heating/cooling mode for first-time users. */
export const MODE_HELP: Record<ThermostatMode, string> = {
  off: 'Heating and cooling are switched off.',
  heat: 'Warms the room up to the temperature you choose.',
  cool: 'Cools the room down to the temperature you choose.',
  auto: 'Warms or cools by itself to keep the temperature you choose.',
};

export const LIGHT_COLORS: { name: string; hex: string }[] = [
  { name: 'Warm white', hex: '#ffd29a' },
  { name: 'Soft white', hex: '#fff1d6' },
  { name: 'Cool white', hex: '#e6f0ff' },
  { name: 'Amber', hex: '#ffab4a' },
  { name: 'Rose', hex: '#ff6b9a' },
  { name: 'Violet', hex: '#9b7bff' },
  { name: 'Ocean', hex: '#4aa8ff' },
  { name: 'Mint', hex: '#4ee0a8' },
];

export const HEX_RE = /^#[0-9a-f]{6}$/i;

export const ROOM_KIND_LABEL: Record<RoomKind, string> = {
  living: 'Living room',
  bedroom: 'Bedroom',
  kitchen: 'Kitchen',
  bathroom: 'Bathroom',
  entrance: 'Entrance',
  study: 'Study room',
  other: 'Other (drawing)',
};

/** Local, royalty-free photos (Unsplash License) in /public/rooms. */
export const ROOM_IMAGE: Partial<Record<RoomKind, string>> = {
  living: '/rooms/living.jpg',
  bedroom: '/rooms/bedroom.jpg',
  kitchen: '/rooms/kitchen.jpg',
  bathroom: '/rooms/bathroom.jpg',
  entrance: '/rooms/entrance.jpg',
  study: '/rooms/study.jpg',
};
