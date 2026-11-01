import { BRAND } from './brand';
import { nextHumidity, nextTemperature } from './simulation';
import type { AppState, ApplianceKind, Device, Reading, Rule, Scene, Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  simulationRunning: true,
  tickSeconds: 5,
  randomMotion: true,
  randomContacts: false,
  randomVisitors: false,
  motionResetSeconds: 15,
  tempUnit: 'C',
  theme: 'light',
  notifications: true,
  doorbellSound: true,
  securityArmed: false,
  largeText: false,
  uiVersion: 3,
};

export const SAMPLE_FAVORITES = ['light-living-main', 'light-living-lamp', 'tv-living', 'light-kitchen', 'light-bedroom-main', 'light-porch'];

/** Backfill a sensor with the last ~30 minutes of readings so charts are not empty on first launch. */
function backfill(baseline: number, baseHum: number, now: number, count = 36, stepMs = 50_000): Reading[] {
  const readings: Reading[] = [];
  let value = baseline;
  let humidity = baseHum;
  for (let i = count; i > 0; i--) {
    const ts = now - i * stepMs;
    value = nextTemperature(value, baseline, ts);
    humidity = nextHumidity(humidity, baseHum);
    readings.push({ ts, value, humidity });
  }
  return readings;
}

const light = (id: string, name: string, roomId: string, on: boolean, brightness: number, color: string): Device => ({
  id, type: 'light', name, roomId, on, brightness, color,
});
const appliance = (id: string, name: string, roomId: string, kind: ApplianceKind, on = false): Device => ({
  id, type: 'appliance', name, roomId, kind, on,
});
const contact = (id: string, name: string, roomId: string, kind: 'door' | 'window', open = false): Device => ({
  id, type: 'contact', name, roomId, kind, open, lastChangedAt: null,
});
const motion = (id: string, name: string, roomId: string): Device => ({
  id, type: 'motion', name, roomId, detected: false, lastDetectedAt: null,
});

const rule = (now: number, r: Omit<Rule, 'createdAt' | 'lastRunAt' | 'runCount' | 'enabled' | 'conditions'> & Partial<Pick<Rule, 'enabled' | 'conditions'>>): Rule => ({
  enabled: true, conditions: [], createdAt: now, lastRunAt: null, runCount: 0, ...r,
});

export const SAMPLE_SCENES: Scene[] = [
  {
    id: 'scene-morning',
    name: 'Good Morning',
    description: 'Soft bedroom light, bright kitchen, coffee on, comfy 22° and security off.',
    icon: 'sunrise',
    actions: [
      { kind: 'arm_security', armed: false },
      { kind: 'light_set', deviceId: 'light-bedroom-main', brightness: 70, color: '#fff1d6' },
      { kind: 'light_set', deviceId: 'light-kitchen', brightness: 100, color: '#e6f0ff' },
      { kind: 'turn_on', deviceId: 'plug-coffee' },
      { kind: 'turn_on', deviceId: 'speaker-kitchen' },
      { kind: 'turn_off', deviceId: 'light-porch' },
      { kind: 'set_thermostat', deviceId: 'thermo-living', mode: 'auto', target: 22 },
    ],
  },
  {
    id: 'scene-movie',
    name: 'Movie Night',
    description: 'TV on, ceiling light off, dim warm lamp and violet LED strip.',
    icon: 'film',
    actions: [
      { kind: 'turn_off', deviceId: 'light-living-main' },
      { kind: 'light_set', deviceId: 'light-living-lamp', brightness: 20, color: '#ffab4a' },
      { kind: 'light_set', deviceId: 'light-living-strip', brightness: 35, color: '#9b7bff' },
      { kind: 'turn_on', deviceId: 'tv-living' },
      { kind: 'turn_off', deviceId: 'light-kitchen' },
      { kind: 'set_thermostat', deviceId: 'thermo-living', mode: 'auto', target: 21.5 },
    ],
  },
  {
    id: 'scene-away',
    name: 'Away Mode',
    description: 'Everything off, porch light on, thermostats on eco 18° and security armed.',
    icon: 'plane',
    actions: [
      { kind: 'all_off', target: 'lights' },
      { kind: 'all_off', target: 'appliances' },
      { kind: 'light_set', deviceId: 'light-porch', brightness: 60, color: '#ffd29a' },
      { kind: 'set_thermostat', deviceId: 'thermo-living', mode: 'auto', target: 18 },
      { kind: 'set_thermostat', deviceId: 'thermo-bedroom', mode: 'auto', target: 18 },
      { kind: 'arm_security', armed: true },
    ],
  },
  {
    id: 'scene-sleep',
    name: 'Good Night',
    description: 'Lights and TV off, a faint bedside glow, the bedroom cooled to 21° and Away protection on.',
    icon: 'moon',
    actions: [
      { kind: 'all_off', target: 'lights' },
      { kind: 'turn_off', deviceId: 'tv-living' },
      { kind: 'turn_off', deviceId: 'speaker-kitchen' },
      { kind: 'light_set', deviceId: 'light-bedside', brightness: 8, color: '#ffab4a' },
      { kind: 'set_thermostat', deviceId: 'thermo-bedroom', mode: 'cool', target: 21 },
      { kind: 'arm_security', armed: true },
    ],
  },
];

export function createSampleState(now = Date.now()): AppState {
  const climate = (id: string, name: string, roomId: string, baseline: number, baselineHumidity: number): Device => {
    const readings = backfill(baseline, baselineHumidity, now);
    const last = readings[readings.length - 1];
    return { id, type: 'climate', name, roomId, baseline, baselineHumidity, value: last.value, humidity: last.humidity, readings };
  };

  const rules: Rule[] = [
    rule(now, {
      id: 'rule-entrance-motion',
      name: 'Entrance motion turns on hall light',
      trigger: { kind: 'motion_detected', deviceId: 'motion-entrance' },
      actions: [{ kind: 'turn_on', deviceId: 'light-hall' }],
    }),
    rule(now, {
      id: 'rule-living-motion',
      name: 'Living room motion switches on the ceiling light',
      trigger: { kind: 'motion_detected', deviceId: 'motion-living' },
      conditions: [{ kind: 'security_is', armed: false }],
      actions: [{ kind: 'turn_on', deviceId: 'light-living-main' }],
    }),
    rule(now, {
      id: 'rule-doorbell-porch',
      name: 'Doorbell turns on porch light',
      trigger: { kind: 'doorbell_pressed', deviceId: 'doorbell-front' },
      actions: [{ kind: 'light_set', deviceId: 'light-porch', brightness: 100, color: '#ffd29a' }],
    }),
    rule(now, {
      id: 'rule-front-door-notify',
      name: 'Front door opened alert',
      trigger: { kind: 'contact_opened', deviceId: 'contact-front' },
      actions: [{ kind: 'notify', message: 'The front door was opened.' }],
    }),
    rule(now, {
      id: 'rule-7pm-bedroom',
      name: 'Bedroom light at 7 PM',
      trigger: { kind: 'time', at: '19:00' },
      actions: [{ kind: 'light_set', deviceId: 'light-bedroom-main', brightness: 60, color: '#ffd29a' }],
    }),
    rule(now, {
      id: 'rule-bathroom-humidity',
      name: 'Steamy bathroom runs the exhaust fan',
      trigger: { kind: 'humidity_above', deviceId: 'climate-bathroom', threshold: 70 },
      actions: [
        { kind: 'turn_on', deviceId: 'fan-bathroom' },
        { kind: 'notify', message: 'Bathroom humidity is high — exhaust fan switched on.' },
      ],
    }),
    rule(now, {
      id: 'rule-living-hot',
      name: 'Cool the living room when it gets hot',
      trigger: { kind: 'temp_above', deviceId: 'climate-living', threshold: 26 },
      conditions: [{ kind: 'time_between', from: '08:00', to: '23:00' }],
      actions: [
        { kind: 'set_thermostat', deviceId: 'thermo-living', mode: 'cool', target: 23 },
        { kind: 'turn_on', deviceId: 'fan-living' },
      ],
    }),
  ];

  return {
    version: 2,
    rooms: [
      { id: 'room-living', name: 'Living Room', kind: 'living' },
      { id: 'room-bedroom', name: 'Bedroom', kind: 'bedroom' },
      { id: 'room-kitchen', name: 'Kitchen', kind: 'kitchen' },
      { id: 'room-bathroom', name: 'Bathroom', kind: 'bathroom' },
      { id: 'room-entrance', name: 'Entrance', kind: 'entrance' },
      { id: 'room-study', name: 'Study Room', kind: 'study' },
    ],
    devices: [
      light('light-living-main', 'Ceiling Light', 'room-living', true, 80, '#fff1d6'),
      light('light-living-lamp', 'Floor Lamp', 'room-living', false, 45, '#ffd29a'),
      light('light-living-strip', 'LED Strip', 'room-living', false, 60, '#9b7bff'),
      appliance('tv-living', 'Smart TV', 'room-living', 'tv'),
      appliance('fan-living', 'Ceiling Fan', 'room-living', 'fan'),
      { id: 'thermo-living', type: 'thermostat', name: 'Living Thermostat', roomId: 'room-living', mode: 'auto', target: 22.5 },
      climate('climate-living', 'Living Room Sensor', 'room-living', 23, 46),
      contact('contact-living-window', 'Living Room Window', 'room-living', 'window'),
      motion('motion-living', 'Living Room Motion', 'room-living'),

      light('light-bedroom-main', 'Bedroom Light', 'room-bedroom', false, 70, '#fff1d6'),
      light('light-bedside', 'Bedside Lamp', 'room-bedroom', false, 30, '#ffab4a'),
      { id: 'thermo-bedroom', type: 'thermostat', name: 'Bedroom Thermostat', roomId: 'room-bedroom', mode: 'off', target: 21 },
      climate('climate-bedroom', 'Bedroom Sensor', 'room-bedroom', 24.5, 50),
      contact('contact-bedroom-window', 'Bedroom Window', 'room-bedroom', 'window', true),

      light('light-kitchen', 'Kitchen Light', 'room-kitchen', false, 100, '#e6f0ff'),
      light('light-cabinet', 'Under-cabinet Lights', 'room-kitchen', false, 50, '#ffd29a'),
      appliance('plug-coffee', 'Coffee Maker', 'room-kitchen', 'plug'),
      appliance('speaker-kitchen', 'Kitchen Speaker', 'room-kitchen', 'speaker'),
      climate('climate-kitchen', 'Kitchen Sensor', 'room-kitchen', 24, 44),
      contact('contact-back', 'Back Door', 'room-kitchen', 'door'),
      motion('motion-kitchen', 'Kitchen Motion', 'room-kitchen'),

      light('light-bathroom', 'Bathroom Light', 'room-bathroom', false, 90, '#e6f0ff'),
      light('light-mirror', 'Mirror Light', 'room-bathroom', false, 70, '#fff1d6'),
      appliance('fan-bathroom', 'Exhaust Fan', 'room-bathroom', 'fan'),
      climate('climate-bathroom', 'Bathroom Sensor', 'room-bathroom', 24.5, 62),
      contact('contact-bathroom-window', 'Bathroom Window', 'room-bathroom', 'window'),

      light('light-porch', 'Porch Light', 'room-entrance', false, 100, '#ffd29a'),
      light('light-hall', 'Hall Light', 'room-entrance', false, 70, '#fff1d6'),
      { id: 'doorbell-front', type: 'doorbell', name: 'Front Doorbell', roomId: 'room-entrance', lastRingAt: null, ringCount: 0 },
      climate('climate-entrance', 'Entrance Sensor', 'room-entrance', 21.5, 55),
      contact('contact-front', 'Front Door', 'room-entrance', 'door'),
      motion('motion-entrance', 'Entrance Motion', 'room-entrance'),

      light('light-study-desk', 'Desk Lamp', 'room-study', false, 85, '#fff1d6'),
      light('light-study', 'Study Light', 'room-study', false, 75, '#e6f0ff'),
      appliance('plug-laptop', 'Laptop Charger', 'room-study', 'plug'),
      climate('climate-study', 'Study Room Sensor', 'room-study', 23.5, 45),
      contact('contact-study-window', 'Study Window', 'room-study', 'window'),
    ],
    rules,
    scenes: SAMPLE_SCENES.map((s) => ({ ...s, actions: [...s.actions] })),
    activeSceneId: null,
    activity: [{ id: 'evt-welcome', ts: now, category: 'system', severity: 'info', message: `${BRAND.name} started with the sample home (all devices are simulated)` }],
    notifications: [
      {
        id: 'ntf-welcome',
        ts: now,
        severity: 'info',
        category: 'system',
        title: `Welcome to ${BRAND.name}`,
        message: 'Every device here is virtual. Try a scene, ring the doorbell or open a door on the Security page.',
        read: false,
      },
    ],
    toasts: [],
    visitors: [],
    favorites: [...SAMPLE_FAVORITES],
    settings: { ...DEFAULT_SETTINGS },
  };
}
