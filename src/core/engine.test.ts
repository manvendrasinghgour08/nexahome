import { describe, expect, it } from 'vitest';
import { createSampleState, inTimeWindow, reducer, ruleProblems, type Action, type RuleDraft } from './engine';
import { hvacState, nextHumidity, nextTemperature } from './simulation';
import { migrateLegacy, parseSaved } from './storage';
import type { AppState, Device, DeviceOf } from './types';

const at = (h: number, m = 0) => new Date(2026, 10, 1, h, m, 0).getTime();
const T = at(14, 30);
const run = (state: AppState, ...actions: Action[]) => actions.reduce(reducer, state);
const dev = <K extends Device['type']>(s: AppState, id: string) => s.devices.find((d) => d.id === id) as DeviceOf<K>;
const rule = (s: AppState, id: string) => s.rules.find((r) => r.id === id)!;
const fresh = () => createSampleState(T);
const ring = (ts = T): Action => ({ type: 'doorbell/ring', deviceId: 'doorbell-front', visitor: 'Courier with a parcel', ts });

describe('sample home', () => {
  it('has the six rooms, each with a temperature sensor', () => {
    const s = fresh();
    expect(s.rooms.map((r) => r.name)).toEqual(['Living Room', 'Bedroom', 'Kitchen', 'Bathroom', 'Entrance', 'Study Room']);
    for (const room of s.rooms) expect(s.devices.some((d) => d.type === 'climate' && d.roomId === room.id)).toBe(true);
  });
});

describe('lighting', () => {
  it('toggles a light and logs it', () => {
    const s = run(fresh(), { type: 'device/toggle', deviceId: 'light-kitchen', ts: T });
    expect(dev<'light'>(s, 'light-kitchen').on).toBe(true);
    expect(s.activity[0].message).toMatch(/Kitchen Light .* ON/);
  });

  it('switches every light in one room only', () => {
    const s = run(fresh(), { type: 'light/setAll', on: true, roomId: 'room-living', ts: T });
    expect(dev<'light'>(s, 'light-living-lamp').on).toBe(true);
    expect(dev<'light'>(s, 'light-kitchen').on).toBe(false);
  });

  it('clamps brightness and validates colours', () => {
    let s = run(fresh(), { type: 'light/brightness', deviceId: 'light-kitchen', brightness: 400, ts: T });
    expect(dev<'light'>(s, 'light-kitchen').brightness).toBe(100);
    s = run(s, { type: 'light/color', deviceId: 'light-kitchen', color: '#FF0000', ts: T });
    expect(dev<'light'>(s, 'light-kitchen').color).toBe('#ff0000');
    const before = s;
    expect(run(s, { type: 'light/color', deviceId: 'light-kitchen', color: 'red', ts: T })).toBe(before);
  });

  it('remembers brightness and colour while switched off', () => {
    let s = run(fresh(), { type: 'light/color', deviceId: 'light-living-main', color: '#4aa8ff', ts: T }, { type: 'light/brightness', deviceId: 'light-living-main', brightness: 33, ts: T });
    s = run(s, { type: 'device/toggle', deviceId: 'light-living-main', ts: T }, { type: 'device/toggle', deviceId: 'light-living-main', ts: T });
    expect(dev<'light'>(s, 'light-living-main')).toMatchObject({ on: true, brightness: 33, color: '#4aa8ff' });
  });

  it('applies a lighting preset to a room', () => {
    const s = run(fresh(), { type: 'light/preset', name: 'Relax', brightness: 40, color: '#ffab4a', roomId: 'room-bedroom', ts: T });
    expect(dev<'light'>(s, 'light-bedside')).toMatchObject({ on: true, brightness: 40, color: '#ffab4a' });
    expect(dev<'light'>(s, 'light-kitchen').on).toBe(false);
  });
});

describe('appliances & thermostat', () => {
  it('toggles an appliance', () => {
    const s = run(fresh(), { type: 'device/toggle', deviceId: 'tv-living', ts: T });
    expect(dev<'appliance'>(s, 'tv-living').on).toBe(true);
  });

  it('clamps thermostat target and changes mode', () => {
    const s = run(fresh(), { type: 'thermostat/set', deviceId: 'thermo-bedroom', mode: 'heat', target: 99, ts: T });
    expect(dev<'thermostat'>(s, 'thermo-bedroom')).toMatchObject({ mode: 'heat', target: 32 });
  });

  it('hvac state follows the dead-band', () => {
    expect(hvacState({ mode: 'auto', target: 22 }, 20)).toBe('heating');
    expect(hvacState({ mode: 'auto', target: 22 }, 24)).toBe('cooling');
    expect(hvacState({ mode: 'heat', target: 22 }, 24)).toBe('idle');
    expect(hvacState({ mode: 'off', target: 22 }, 10)).toBe('off');
  });

  it('a heating thermostat pulls the simulated temperature toward its target', () => {
    let v = 16;
    for (let i = 0; i < 40; i++) v = nextTemperature(v, 16, T, Math.random, 23);
    expect(v).toBeGreaterThan(21.5);
  });
});

describe('doorbell & visitors', () => {
  it('records the ring, a simulated visitor, a notification, and runs the porch-light rule', () => {
    const s = run(fresh(), ring());
    expect(dev<'doorbell'>(s, 'doorbell-front').ringCount).toBe(1);
    expect(s.visitors[0]).toMatchObject({ label: 'Courier with a parcel', status: 'waiting' });
    expect(s.notifications[0]).toMatchObject({ title: 'Doorbell', read: false, category: 'doorbell' });
    expect(s.toasts[0].title).toBe('Doorbell');
    expect(s.activity.some((e) => e.category === 'doorbell')).toBe(true);
    expect(dev<'light'>(s, 'light-porch').on).toBe(true);
  });

  it('updates and clears visitor status', () => {
    let s = run(fresh(), ring());
    s = run(s, { type: 'visitor/status', visitorId: s.visitors[0].id, status: 'answered', ts: T });
    expect(s.visitors[0].status).toBe('answered');
    expect(run(s, { type: 'visitor/clear', ts: T }).visitors).toHaveLength(0);
  });
});

describe('security', () => {
  it('alerts when a sensor opens, with higher severity when armed', () => {
    let s = run(fresh(), { type: 'contact/set', deviceId: 'contact-back', open: true, ts: T });
    expect(dev<'contact'>(s, 'contact-back').open).toBe(true);
    expect(s.activity[0].severity).toBe('warning');
    s = run(s, { type: 'settings/update', patch: { securityArmed: true }, ts: T }, { type: 'contact/set', deviceId: 'contact-living-window', open: true, ts: T });
    expect(s.activity[0].severity).toBe('alert');
    expect(s.notifications[0].title).toBe('Security alert');
  });

  it('ignores a no-op state change', () => {
    const s0 = fresh();
    expect(run(s0, { type: 'contact/set', deviceId: 'contact-front', open: false, ts: T })).toBe(s0);
  });
});

describe('automation engine', () => {
  it('motion turns on the hall light only while the rule is enabled', () => {
    let s = run(fresh(), { type: 'motion/detect', deviceId: 'motion-entrance', ts: T });
    expect(dev<'light'>(s, 'light-hall').on).toBe(true);
    expect(rule(s, 'rule-entrance-motion').runCount).toBe(1);
    s = run(s, { type: 'device/toggle', deviceId: 'light-hall', ts: T }, { type: 'rule/toggle', ruleId: 'rule-entrance-motion', ts: T });
    s = run(s, { type: 'motion/clear', deviceId: 'motion-entrance', ts: T }, { type: 'motion/detect', deviceId: 'motion-entrance', ts: T });
    expect(dev<'light'>(s, 'light-hall').on).toBe(false);
  });

  it('front door opening generates a notification via the sample rule', () => {
    const s = run(fresh(), { type: 'contact/set', deviceId: 'contact-front', open: true, ts: T });
    expect(s.notifications.some((n) => n.message === 'The front door was opened.')).toBe(true);
  });

  it('conditions block a rule when not met', () => {
    let s = run(fresh(), { type: 'device/toggle', deviceId: 'light-living-main', ts: T }); // turn it off
    s = run(s, { type: 'settings/update', patch: { securityArmed: true }, ts: T }, { type: 'motion/detect', deviceId: 'motion-living', ts: T });
    expect(dev<'light'>(s, 'light-living-main').on).toBe(false);
    expect(s.activity.some((e) => e.message.includes('conditions were not met'))).toBe(true);
    s = run(s, { type: 'settings/update', patch: { securityArmed: false }, ts: T }, { type: 'motion/clear', deviceId: 'motion-living', ts: T }, { type: 'motion/detect', deviceId: 'motion-living', ts: T });
    expect(dev<'light'>(s, 'light-living-main').on).toBe(true);
  });

  it('threshold triggers fire once on crossing, and run multiple actions', () => {
    let s = run(fresh(), { type: 'climate/reading', deviceId: 'climate-living', value: 25, ts: T });
    s = run(s, { type: 'climate/reading', deviceId: 'climate-living', value: 27, ts: T + 1 });
    s = run(s, { type: 'climate/reading', deviceId: 'climate-living', value: 28, ts: T + 2 });
    expect(rule(s, 'rule-living-hot').runCount).toBe(1);
    expect(dev<'thermostat'>(s, 'thermo-living')).toMatchObject({ mode: 'cool', target: 23 });
    expect(dev<'appliance'>(s, 'fan-living').on).toBe(true);
  });

  it('humidity trigger switches on the exhaust fan', () => {
    let s = run(fresh(), { type: 'climate/reading', deviceId: 'climate-bathroom', value: 25, humidity: 60, ts: T });
    s = run(s, { type: 'climate/reading', deviceId: 'climate-bathroom', value: 25, humidity: 78, ts: T + 1 });
    expect(dev<'appliance'>(s, 'fan-bathroom').on).toBe(true);
  });

  it('scheduled rule fires once at 7 PM', () => {
    let s = run(fresh(), { type: 'clock/tick', ts: at(18, 59) });
    expect(dev<'light'>(s, 'light-bedroom-main').on).toBe(false);
    s = run(s, { type: 'clock/tick', ts: at(19, 0) }, { type: 'device/toggle', deviceId: 'light-bedroom-main', ts: at(19, 0) + 5000 });
    s = run(s, { type: 'clock/tick', ts: at(19, 0) + 30_000 });
    expect(dev<'light'>(s, 'light-bedroom-main').on).toBe(false); // not re-fired within the same minute
    expect(rule(s, 'rule-7pm-bedroom').runCount).toBe(1);
  });

  it('a clock tick with nothing due returns the same state object', () => {
    const s0 = fresh();
    expect(run(s0, { type: 'clock/tick', ts: at(9, 13) })).toBe(s0);
  });

  it('time windows wrap past midnight', () => {
    expect(inTimeWindow(at(23, 30), '22:00', '06:00')).toBe(true);
    expect(inTimeWindow(at(5, 59), '22:00', '06:00')).toBe(true);
    expect(inTimeWindow(at(12, 0), '22:00', '06:00')).toBe(false);
  });

  it('creates a user rule with a condition and several actions, and it executes', () => {
    const draft: RuleDraft = {
      name: 'Back door opens kitchen',
      trigger: { kind: 'contact_opened', deviceId: 'contact-back' },
      conditions: [{ kind: 'device_is', deviceId: 'light-kitchen', on: false }],
      actions: [{ kind: 'turn_on', deviceId: 'light-kitchen' }, { kind: 'notify', message: 'Back door opened' }],
    };
    let s = run(fresh(), { type: 'rule/add', rule: draft, ts: T });
    expect(s.rules).toHaveLength(8);
    s = run(s, { type: 'contact/set', deviceId: 'contact-back', open: true, ts: T });
    expect(dev<'light'>(s, 'light-kitchen').on).toBe(true);
    expect(s.notifications.some((n) => n.message === 'Back door opened')).toBe(true);
  });

  it('rejects invalid rules with helpful messages', () => {
    const s0 = fresh();
    const bad: RuleDraft = { name: '', trigger: { kind: 'motion_detected', deviceId: 'light-kitchen' }, conditions: [{ kind: 'time_between', from: '10:00', to: '10:00' }], actions: [] };
    expect(ruleProblems(s0, bad)).toEqual(['Give the rule a name.', 'Choose a sensor for the trigger.', 'Condition: the start and end times must differ.', 'Add at least one action.']);
    expect(run(s0, { type: 'rule/add', rule: bad, ts: T })).toBe(s0);
  });

  it('deleting a device removes rules that depend on it', () => {
    const s = run(fresh(), { type: 'device/delete', deviceId: 'light-hall', ts: T });
    expect(s.rules.some((r) => r.id === 'rule-entrance-motion')).toBe(false);
    expect(s.rules.some((r) => r.id === 'rule-living-hot')).toBe(true);
  });
});

describe('scenes', () => {
  it('Movie Night changes several devices at once', () => {
    const s = run(fresh(), { type: 'scene/activate', sceneId: 'scene-movie', ts: T });
    expect(dev<'light'>(s, 'light-living-main').on).toBe(false);
    expect(dev<'light'>(s, 'light-living-lamp')).toMatchObject({ on: true, brightness: 20 });
    expect(dev<'appliance'>(s, 'tv-living').on).toBe(true);
    expect(s.activeSceneId).toBe('scene-movie');
    expect(s.activity[0].category).toBe('scene');
  });

  it('Away Mode turns everything off and arms security', () => {
    let s = run(fresh(), { type: 'device/toggle', deviceId: 'tv-living', ts: T });
    s = run(s, { type: 'scene/activate', sceneId: 'scene-away', ts: T });
    expect(s.devices.filter((d) => d.type === 'light' && d.on).map((d) => d.id)).toEqual(['light-porch']);
    expect(s.devices.some((d) => d.type === 'appliance' && d.on)).toBe(false);
    expect(s.settings.securityArmed).toBe(true);
  });

  it('Good Morning and Sleep Mode', () => {
    let s = run(fresh(), { type: 'scene/activate', sceneId: 'scene-sleep', ts: T });
    expect(dev<'light'>(s, 'light-bedside')).toMatchObject({ on: true, brightness: 8 });
    expect(dev<'thermostat'>(s, 'thermo-bedroom').mode).toBe('cool');
    s = run(s, { type: 'scene/activate', sceneId: 'scene-morning', ts: T });
    expect(s.settings.securityArmed).toBe(false);
    expect(dev<'appliance'>(s, 'plug-coffee').on).toBe(true);
  });

  it('a manual change clears the active scene', () => {
    const s = run(fresh(), { type: 'scene/activate', sceneId: 'scene-movie', ts: T }, { type: 'device/toggle', deviceId: 'tv-living', ts: T });
    expect(s.activeSceneId).toBeNull();
  });

  it('a rule can activate a scene', () => {
    const draft: RuleDraft = { name: 'Bedtime', trigger: { kind: 'time', at: '23:00' }, conditions: [], actions: [{ kind: 'activate_scene', sceneId: 'scene-sleep' }] };
    const s = run(fresh(), { type: 'rule/add', rule: draft, ts: T }, { type: 'clock/tick', ts: at(23, 0) });
    expect(s.activeSceneId).toBe('scene-sleep');
  });
});

describe('favourites', () => {
  it('pins and unpins devices, and forgets deleted ones', () => {
    let s = run(fresh(), { type: 'favorite/toggle', deviceId: 'fan-bathroom', ts: T });
    expect(s.favorites).toContain('fan-bathroom');
    s = run(s, { type: 'favorite/toggle', deviceId: 'tv-living', ts: T });
    expect(s.favorites).not.toContain('tv-living');
    s = run(s, { type: 'device/delete', deviceId: 'fan-bathroom', ts: T });
    expect(s.favorites).not.toContain('fan-bathroom');
  });
});

describe('"when I start a quick action" routines', () => {
  const leaveHome: RuleDraft = {
    name: 'When I leave home',
    trigger: { kind: 'scene_started', sceneId: 'scene-away' },
    conditions: [],
    actions: [{ kind: 'notify', message: 'Have a good trip!' }],
  };

  it('runs when the person starts the quick action', () => {
    const s = run(fresh(), { type: 'rule/add', rule: leaveHome, ts: T }, { type: 'scene/activate', sceneId: 'scene-away', ts: T });
    expect(s.notifications.some((n) => n.message === 'Have a good trip!')).toBe(true);
  });

  it('does not run when a routine starts the quick action (no loops)', () => {
    const viaRoutine: RuleDraft = { name: 'Bedtime', trigger: { kind: 'time', at: '23:00' }, conditions: [], actions: [{ kind: 'activate_scene', sceneId: 'scene-away' }] };
    const s = run(fresh(), { type: 'rule/add', rule: leaveHome, ts: T }, { type: 'rule/add', rule: viaRoutine, ts: T }, { type: 'clock/tick', ts: at(23, 0) });
    expect(s.activeSceneId).toBe('scene-away');
    expect(s.notifications.some((n) => n.message === 'Have a good trip!')).toBe(false);
  });

  it('rejects a missing quick action', () => {
    expect(ruleProblems(fresh(), { ...leaveHome, trigger: { kind: 'scene_started', sceneId: 'nope' } })).toContain('Choose a quick action for the trigger.');
  });
});

describe('notification centre', () => {
  it('marks read, deletes and clears', () => {
    let s = run(fresh(), ring());
    const id = s.notifications[0].id;
    s = run(s, { type: 'notification/read', id, ts: T });
    expect(s.notifications.find((n) => n.id === id)!.read).toBe(true);
    s = run(s, { type: 'notification/readAll', ts: T });
    expect(s.notifications.every((n) => n.read)).toBe(true);
    s = run(s, { type: 'notification/delete', id, ts: T });
    expect(s.notifications.some((n) => n.id === id)).toBe(false);
    expect(run(s, { type: 'notification/clear', ts: T }).notifications).toHaveLength(0);
  });

  it('pop-ups can be turned off while the centre still records', () => {
    const s = run(fresh(), { type: 'settings/update', patch: { notifications: false }, ts: T }, ring());
    expect(s.toasts).toHaveLength(0);
    expect(s.notifications[0].title).toBe('Doorbell');
  });
});

describe('activity, rooms and settings', () => {
  it('clears history', () => {
    const s = run(fresh(), { type: 'device/toggle', deviceId: 'light-kitchen', ts: T }, { type: 'activity/clear', ts: T });
    expect(s.activity).toHaveLength(0);
  });

  it('will not delete a room that still has devices', () => {
    const s0 = fresh();
    expect(run(s0, { type: 'room/delete', roomId: 'room-kitchen', ts: T })).toBe(s0);
    const s = run(s0, { type: 'room/add', name: 'Garage', kind: 'other', ts: T });
    const garage = s.rooms.find((r) => r.name === 'Garage')!;
    expect(run(s, { type: 'room/delete', roomId: garage.id, ts: T }).rooms.some((r) => r.id === garage.id)).toBe(false);
  });

  it('reset keeps theme and unit but restores demo data', () => {
    let s = run(fresh(), { type: 'settings/update', patch: { theme: 'light', tempUnit: 'F', securityArmed: true }, ts: T }, { type: 'device/delete', deviceId: 'tv-living', ts: T });
    s = run(s, { type: 'state/reset', ts: T });
    expect(s.settings).toMatchObject({ theme: 'light', tempUnit: 'F', securityArmed: false });
    expect(s.devices.some((d) => d.id === 'tv-living')).toBe(true);
  });
});

describe('persistence and simulation', () => {
  it('falls back to sample data on corrupt JSON', () => {
    const r = parseSaved('{not json', T);
    expect(r.warning).toBeTruthy();
    expect(r.state.devices.length).toBeGreaterThan(0);
  });

  it('round-trips saved state, drops toasts and repairs bad settings', () => {
    const saved = { ...run(fresh(), ring(), { type: 'scene/activate', sceneId: 'scene-movie', ts: T }), settings: { tempUnit: 'F', tickSeconds: 'oops' } };
    const r = parseSaved(JSON.stringify(saved), T);
    expect(r.warning).toBeUndefined();
    expect(r.state.toasts).toHaveLength(0);
    expect(r.state.activeSceneId).toBe('scene-movie');
    expect(r.state.visitors).toHaveLength(1);
    expect(r.state.settings).toMatchObject({ tempUnit: 'F', tickSeconds: 5 });
  });

  it('renames the old brand inside saved messages but keeps the data', () => {
    const saved = fresh();
    saved.activity[0].message = 'SmartNest started with the sample home';
    saved.notifications[0].title = 'Welcome to SmartNest';
    const r = parseSaved(JSON.stringify(saved), T);
    expect(r.state.activity[0].message).toBe('NexaHome started with the sample home');
    expect(r.state.notifications[0]).toMatchObject({ title: 'Welcome to NexaHome', id: saved.notifications[0].id, read: false });
    expect(r.state.devices).toEqual(saved.devices);
    expect(r.state.rules).toEqual(saved.rules);
  });

  it('migrates version 1 data, keeping display preferences', () => {
    const r = migrateLegacy(JSON.stringify({ version: 1, settings: { theme: 'light', tempUnit: 'F' } }), T);
    expect(r.state.version).toBe(2);
    expect(r.state.settings).toMatchObject({ theme: 'light', tempUnit: 'F' });
    expect(r.state.activity[0].message).toMatch(/Upgraded/);
  });

  it('moves older saves to the new light theme once, then respects the choice', () => {
    const old = { ...fresh(), favorites: undefined, settings: { ...fresh().settings, theme: 'dark', uiVersion: undefined } };
    const r = parseSaved(JSON.stringify(old), T);
    expect(r.state.settings).toMatchObject({ theme: 'light', uiVersion: 3 });
    expect(r.state.favorites.length).toBeGreaterThan(0);
    const chosen = parseSaved(JSON.stringify({ ...r.state, settings: { ...r.state.settings, theme: 'dark' } }), T);
    expect(chosen.state.settings.theme).toBe('dark');
  });

  it('renames the old "Sleep Mode" preset to "Good Night" but keeps a custom name', () => {
    const saved = fresh();
    saved.scenes = saved.scenes.map((s) => (s.id === 'scene-sleep' ? { ...s, name: 'Sleep Mode' } : s));
    expect(parseSaved(JSON.stringify(saved), T).state.scenes.find((s) => s.id === 'scene-sleep')!.name).toBe('Good Night');
    saved.scenes = saved.scenes.map((s) => (s.id === 'scene-sleep' ? { ...s, name: 'Bedtime' } : s));
    expect(parseSaved(JSON.stringify(saved), T).state.scenes.find((s) => s.id === 'scene-sleep')!.name).toBe('Bedtime');
  });

  it('produces plausible indoor temperature and humidity', () => {
    let v = 23;
    let h = 50;
    for (let i = 0; i < 500; i++) {
      v = nextTemperature(v, 23, T + i * 60_000);
      h = nextHumidity(h, 50);
      expect(v).toBeGreaterThan(18);
      expect(v).toBeLessThan(28);
      expect(h).toBeGreaterThanOrEqual(15);
      expect(h).toBeLessThanOrEqual(95);
    }
  });
});
