import { formatTemp, hhmm, HEX_RE, isValidTime, minutesOfDay, toMinutes } from './format';
import { createSampleState } from './sampleData';
import type {
  ActivityEvent,
  AppNotification,
  AppState,
  Condition,
  Device,
  DeviceOf,
  DeviceType,
  DomainEvent,
  EventCategory,
  ID,
  NewDevice,
  Room,
  Rule,
  RuleAction,
  Settings,
  Severity,
  ThermostatMode,
  Trigger,
  Visitor,
} from './types';

export const MAX_ACTIVITY = 500;
export const MAX_READINGS = 180;
export const MAX_NOTIFICATIONS = 100;
export const MAX_TOASTS = 4;
export const MAX_VISITORS = 50;
export const MAX_ACTIONS = 8;
export const THERMOSTAT_MIN = 10;
export const THERMOSTAT_MAX = 32;

export type RuleDraft = Pick<Rule, 'name' | 'trigger' | 'conditions' | 'actions'>;

export type Action =
  | { type: 'device/toggle'; deviceId: ID; ts: number }
  | { type: 'light/setAll'; on: boolean; roomId?: ID; ts: number }
  | { type: 'light/brightness'; deviceId: ID; brightness: number; ts: number }
  | { type: 'light/color'; deviceId: ID; color: string; ts: number }
  | { type: 'light/preset'; name: string; brightness: number; color: string; roomId?: ID; ts: number }
  | { type: 'thermostat/set'; deviceId: ID; mode?: ThermostatMode; target?: number; ts: number }
  | { type: 'doorbell/ring'; deviceId: ID; visitor: string; ts: number }
  | { type: 'visitor/status'; visitorId: ID; status: Visitor['status']; ts: number }
  | { type: 'visitor/clear'; ts: number }
  | { type: 'contact/set'; deviceId: ID; open: boolean; ts: number }
  | { type: 'motion/detect'; deviceId: ID; ts: number }
  | { type: 'motion/clear'; deviceId: ID; ts: number }
  | { type: 'climate/reading'; deviceId: ID; value: number; humidity?: number; manual?: boolean; ts: number }
  | { type: 'clock/tick'; ts: number }
  | { type: 'scene/activate'; sceneId: ID; ts: number }
  | { type: 'rule/add'; rule: RuleDraft; ts: number }
  | { type: 'rule/update'; ruleId: ID; rule: RuleDraft; ts: number }
  | { type: 'rule/toggle'; ruleId: ID; ts: number }
  | { type: 'rule/delete'; ruleId: ID; ts: number }
  | { type: 'rule/test'; ruleId: ID; ts: number }
  | { type: 'activity/clear'; ts: number }
  | { type: 'notification/read'; id: ID; ts: number }
  | { type: 'notification/readAll'; ts: number }
  | { type: 'notification/delete'; id: ID; ts: number }
  | { type: 'notification/clear'; ts: number }
  | { type: 'toast/dismiss'; id: ID; ts: number }
  | { type: 'device/add'; device: NewDevice; ts: number }
  | { type: 'device/update'; deviceId: ID; name: string; roomId: ID; ts: number }
  | { type: 'device/delete'; deviceId: ID; ts: number }
  | { type: 'room/add'; name: string; kind: Room['kind']; ts: number }
  | { type: 'room/delete'; roomId: ID; ts: number }
  | { type: 'settings/update'; patch: Partial<Settings>; ts: number }
  | { type: 'favorite/toggle'; deviceId: ID; ts: number }
  | { type: 'state/reset'; ts: number };

let idCounter = 0;
export const makeId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

// ---------- small immutable helpers ----------

function log(state: AppState, ts: number, category: EventCategory, severity: Severity, message: string): AppState {
  const event: ActivityEvent = { id: makeId('evt'), ts, category, severity, message };
  return { ...state, activity: [event, ...state.activity].slice(0, MAX_ACTIVITY) };
}

/** Record in the notification centre, and pop up a toast if pop-ups are enabled. */
function notify(
  state: AppState,
  ts: number,
  n: { severity: Severity; category: EventCategory; title: string; message: string },
): AppState {
  const item: AppNotification = { id: makeId('ntf'), ts, read: false, ...n };
  return {
    ...state,
    notifications: [item, ...state.notifications].slice(0, MAX_NOTIFICATIONS),
    toasts: state.settings.notifications ? [item, ...state.toasts].slice(0, MAX_TOASTS) : state.toasts,
  };
}

export const findDevice = (state: AppState, id: ID) => state.devices.find((d) => d.id === id);

export function getDevice<T extends DeviceType>(state: AppState, id: ID, type: T): DeviceOf<T> | undefined {
  const d = findDevice(state, id);
  return d && d.type === type ? (d as DeviceOf<T>) : undefined;
}

export function roomName(state: AppState, roomId: ID) {
  return state.rooms.find((r) => r.id === roomId)?.name ?? 'Unassigned';
}

function patchDevice<T extends DeviceType>(state: AppState, id: ID, type: T, patch: (d: DeviceOf<T>) => Partial<DeviceOf<T>>): AppState {
  return {
    ...state,
    devices: state.devices.map((d) => (d.id === id && d.type === type ? ({ ...d, ...patch(d as DeviceOf<T>) } as Device) : d)),
  };
}

/** Lights and appliances are the devices that can be switched. */
export const isSwitchable = (d: Device | undefined): d is DeviceOf<'light'> | DeviceOf<'appliance'> =>
  !!d && (d.type === 'light' || d.type === 'appliance');

function setSwitch(state: AppState, id: ID, on: boolean): AppState {
  return { ...state, devices: state.devices.map((d) => (d.id === id && isSwitchable(d) ? { ...d, on } : d)) };
}

/** Room temperature as reported by the first climate sensor in that room. */
export function roomClimate(state: AppState, roomId: ID) {
  return state.devices.find((d): d is DeviceOf<'climate'> => d.type === 'climate' && d.roomId === roomId);
}

// ---------- automation: triggers & conditions ----------

export function triggerMatches(trigger: Trigger, event: DomainEvent): boolean {
  if (trigger.kind === 'scene_started') return event.kind === 'scene_started' && event.sceneId === trigger.sceneId;
  if (trigger.kind === 'time' || event.kind === 'scene_started' || trigger.deviceId !== event.deviceId) return false;
  switch (trigger.kind) {
    // Threshold triggers fire only when a reading crosses the threshold, not on every reading beyond it.
    case 'temp_above':
      return event.kind === 'climate_changed' && event.prev <= trigger.threshold && event.value > trigger.threshold;
    case 'temp_below':
      return event.kind === 'climate_changed' && event.prev >= trigger.threshold && event.value < trigger.threshold;
    case 'humidity_above':
      return event.kind === 'climate_changed' && event.prevHumidity <= trigger.threshold && event.humidity > trigger.threshold;
    default:
      return trigger.kind === event.kind;
  }
}

/** Is `ts` inside [from, to)? Windows like 22:00–06:00 wrap past midnight. */
export function inTimeWindow(ts: number, from: string, to: string): boolean {
  const m = minutesOfDay(ts);
  const a = toMinutes(from);
  const b = toMinutes(to);
  return a <= b ? m >= a && m < b : m >= a || m < b;
}

export function conditionHolds(state: AppState, c: Condition, ts: number): boolean {
  switch (c.kind) {
    case 'time_between':
      return inTimeWindow(ts, c.from, c.to);
    case 'security_is':
      return state.settings.securityArmed === c.armed;
    case 'device_is': {
      const d = findDevice(state, c.deviceId);
      return isSwitchable(d) && d.on === c.on;
    }
    case 'temp_is': {
      const d = getDevice(state, c.deviceId, 'climate');
      return !!d && (c.op === 'above' ? d.value > c.value : d.value < c.value);
    }
  }
}

// ---------- automation: actions ----------

type Applied = { state: AppState; outcome: string };

function applyAction(state: AppState, a: RuleAction, ts: number, depth: number): Applied {
  switch (a.kind) {
    case 'turn_on':
    case 'turn_off':
    case 'toggle': {
      const d = findDevice(state, a.deviceId);
      if (!isSwitchable(d)) return { state, outcome: 'skipped (device missing)' };
      const on = a.kind === 'turn_on' ? true : a.kind === 'turn_off' ? false : !d.on;
      return { state: setSwitch(state, d.id, on), outcome: `${d.name} ${on ? 'ON' : 'OFF'}` };
    }
    case 'light_set': {
      const d = getDevice(state, a.deviceId, 'light');
      if (!d) return { state, outcome: 'skipped (light missing)' };
      const brightness = clamp(Math.round(a.brightness), 1, 100);
      const color = HEX_RE.test(a.color) ? a.color.toLowerCase() : d.color;
      return { state: patchDevice(state, d.id, 'light', () => ({ on: true, brightness, color })), outcome: `${d.name} ON at ${brightness}%` };
    }
    case 'set_thermostat': {
      const d = getDevice(state, a.deviceId, 'thermostat');
      if (!d) return { state, outcome: 'skipped (thermostat missing)' };
      const target = round1(clamp(a.target, THERMOSTAT_MIN, THERMOSTAT_MAX));
      return {
        state: patchDevice(state, d.id, 'thermostat', () => ({ mode: a.mode, target })),
        outcome: `${d.name} ${a.mode === 'off' ? 'off' : `${a.mode} → ${formatTemp(target, state.settings.tempUnit)}`}`,
      };
    }
    case 'all_off': {
      const type = a.target === 'lights' ? 'light' : 'appliance';
      const ids = new Set(state.devices.filter((d) => d.type === type && d.on).map((d) => d.id));
      const next = { ...state, devices: state.devices.map((d) => (ids.has(d.id) && isSwitchable(d) ? { ...d, on: false } : d)) };
      return { state: next, outcome: `${ids.size} ${a.target} off` };
    }
    case 'arm_security': {
      if (state.settings.securityArmed === a.armed) return { state, outcome: `security already ${a.armed ? 'armed' : 'disarmed'}` };
      return { state: setArmed(state, a.armed, ts), outcome: `security ${a.armed ? 'ARMED' : 'disarmed'}` };
    }
    case 'activate_scene': {
      const scene = state.scenes.find((s) => s.id === a.sceneId);
      if (!scene || depth > 0) return { state, outcome: 'skipped (scene missing)' };
      return { state: activateScene(state, scene.id, ts, depth + 1), outcome: `scene “${scene.name}”` };
    }
    case 'notify':
      return {
        state: notify(state, ts, { severity: 'info', category: 'automation', title: 'Automation', message: a.message }),
        outcome: `notification “${a.message}”`,
      };
  }
}

function runActions(state: AppState, actions: RuleAction[], ts: number, depth: number) {
  let next = state;
  const outcomes: string[] = [];
  for (const a of actions) {
    const r = applyAction(next, a, ts, depth);
    next = r.state;
    outcomes.push(r.outcome);
  }
  return { state: next, outcomes };
}

function setArmed(state: AppState, armed: boolean, ts: number): AppState {
  let next: AppState = { ...state, settings: { ...state.settings, securityArmed: armed } };
  next = log(next, ts, 'security', armed ? 'success' : 'info', `Security system ${armed ? 'ARMED' : 'disarmed'}`);
  const open = state.devices.filter((d) => d.type === 'contact' && d.open);
  if (armed && open.length) {
    next = notify(next, ts, {
      severity: 'warning',
      category: 'security',
      title: 'Armed with open sensors',
      message: `${open.map((d) => d.name).join(', ')} ${open.length > 1 ? 'are' : 'is'} open.`,
    });
  }
  return next;
}

export function activateScene(state: AppState, sceneId: ID, ts: number, depth = 0): AppState {
  const scene = state.scenes.find((s) => s.id === sceneId);
  if (!scene) return state;
  const { state: next, outcomes } = runActions(state, scene.actions, ts, depth);
  const skipped = outcomes.filter((o) => o.startsWith('skipped')).length;
  return log(
    { ...next, activeSceneId: scene.id },
    ts,
    'scene',
    'success',
    `Scene “${scene.name}” activated — ${scene.actions.length - skipped} change(s)${skipped ? `, ${skipped} skipped (missing devices)` : ''}`,
  );
}

/** Execute a rule's actions. Only sensors raise domain events, so actions can never re-trigger rules. */
export function executeRule(state: AppState, rule: Rule, ts: number, reason: string): AppState {
  const { state: ran, outcomes } = runActions(state, rule.actions, ts, 0);
  const next = {
    ...ran,
    rules: ran.rules.map((r) => (r.id === rule.id ? { ...r, lastRunAt: ts, runCount: r.runCount + 1 } : r)),
  };
  return log(next, ts, 'automation', 'success', `Rule “${rule.name}” ${reason} → ${outcomes.join(', ')}`);
}

function runIfConditionsPass(state: AppState, rule: Rule, ts: number): AppState {
  const failed = rule.conditions.filter((c) => !conditionHolds(state, c, ts));
  if (failed.length) {
    return log(state, ts, 'automation', 'info', `Rule “${rule.name}” triggered but its conditions were not met — nothing changed`);
  }
  return executeRule(state, rule, ts, 'triggered');
}

/** Run every enabled rule whose trigger matches the event (and whose conditions hold). */
export function emit(state: AppState, event: DomainEvent, ts: number): AppState {
  let next = state;
  for (const rule of state.rules) {
    if (rule.enabled && triggerMatches(rule.trigger, event)) next = runIfConditionsPass(next, rule, ts);
  }
  return next;
}

/** Fire scheduled rules whose time is now — at most once per minute. */
export function runScheduledRules(state: AppState, ts: number): AppState {
  const now = hhmm(ts);
  const minute = Math.floor(ts / 60_000);
  let next = state;
  for (const rule of state.rules) {
    if (!rule.enabled || rule.trigger.kind !== 'time' || rule.trigger.at !== now) continue;
    const current = next.rules.find((r) => r.id === rule.id)!;
    if (current.lastRunAt !== null && Math.floor(current.lastRunAt / 60_000) === minute) continue;
    // Mark the minute as handled even if conditions fail, so it is evaluated once.
    next = { ...next, rules: next.rules.map((r) => (r.id === rule.id ? { ...r, lastRunAt: ts } : r)) };
    next = runIfConditionsPass(next, current, ts);
  }
  return next;
}

// ---------- validation ----------

const TRIGGER_DEVICE: Record<Exclude<Trigger['kind'], 'time' | 'scene_started'>, DeviceType> = {
  motion_detected: 'motion',
  contact_opened: 'contact',
  contact_closed: 'contact',
  doorbell_pressed: 'doorbell',
  temp_above: 'climate',
  temp_below: 'climate',
  humidity_above: 'climate',
};
export const triggerDeviceType = (kind: Trigger['kind']) => (kind === 'time' || kind === 'scene_started' ? null : TRIGGER_DEVICE[kind]);

export function triggerProblem(state: AppState, t: Trigger): string | null {
  if (t.kind === 'time') return isValidTime(t.at) ? null : 'Pick a valid time for the schedule.';
  if (t.kind === 'scene_started') return state.scenes.some((s) => s.id === t.sceneId) ? null : 'Choose a quick action for the trigger.';
  if (findDevice(state, t.deviceId)?.type !== TRIGGER_DEVICE[t.kind]) return 'Choose a sensor for the trigger.';
  if ('threshold' in t) {
    if (!Number.isFinite(t.threshold)) return 'Enter a threshold value.';
    if (t.kind === 'humidity_above' && (t.threshold < 0 || t.threshold > 100)) return 'Humidity threshold must be 0–100%.';
  }
  return null;
}

export function conditionProblem(state: AppState, c: Condition): string | null {
  switch (c.kind) {
    case 'time_between':
      if (!isValidTime(c.from) || !isValidTime(c.to)) return 'Condition: enter both times.';
      return c.from === c.to ? 'Condition: the start and end times must differ.' : null;
    case 'security_is':
      return null;
    case 'device_is':
      return isSwitchable(findDevice(state, c.deviceId)) ? null : 'Condition: choose a light or appliance.';
    case 'temp_is':
      if (!getDevice(state, c.deviceId, 'climate')) return 'Condition: choose a climate sensor.';
      return Number.isFinite(c.value) ? null : 'Condition: enter a temperature.';
  }
}

export function actionProblem(state: AppState, a: RuleAction, allowScenes = true): string | null {
  switch (a.kind) {
    case 'turn_on':
    case 'turn_off':
    case 'toggle':
      return isSwitchable(findDevice(state, a.deviceId)) ? null : 'Action: choose a light or appliance.';
    case 'light_set':
      if (!getDevice(state, a.deviceId, 'light')) return 'Action: choose a light.';
      if (!Number.isFinite(a.brightness) || a.brightness < 1 || a.brightness > 100) return 'Action: brightness must be 1–100%.';
      return HEX_RE.test(a.color) ? null : 'Action: pick a colour.';
    case 'set_thermostat':
      if (!getDevice(state, a.deviceId, 'thermostat')) return 'Action: choose a thermostat.';
      return Number.isFinite(a.target) && a.target >= THERMOSTAT_MIN && a.target <= THERMOSTAT_MAX
        ? null
        : `Action: thermostat target must be ${THERMOSTAT_MIN}–${THERMOSTAT_MAX}°C.`;
    case 'all_off':
    case 'arm_security':
      return null;
    case 'activate_scene':
      if (!allowScenes) return 'Scenes cannot start other scenes.';
      return state.scenes.some((s) => s.id === a.sceneId) ? null : 'Action: choose a scene.';
    case 'notify':
      return a.message.trim() ? null : 'Action: write the notification message.';
  }
}

/** All problems with a rule draft; empty when it is valid. */
export function ruleProblems(state: AppState, rule: RuleDraft): string[] {
  const problems: string[] = [];
  if (!rule.name.trim()) problems.push('Give the rule a name.');
  const t = triggerProblem(state, rule.trigger);
  if (t) problems.push(t);
  rule.conditions.forEach((c) => {
    const p = conditionProblem(state, c);
    if (p) problems.push(p);
  });
  if (rule.actions.length === 0) problems.push('Add at least one action.');
  if (rule.actions.length > MAX_ACTIONS) problems.push(`Use at most ${MAX_ACTIONS} actions.`);
  rule.actions.forEach((a) => {
    const p = actionProblem(state, a);
    if (p) problems.push(p);
  });
  return [...new Set(problems)];
}

// ---------- device creation & removal ----------

export function buildDevice(input: NewDevice, ts: number): Device {
  const base = { id: makeId(input.type), name: input.name.trim(), roomId: input.roomId };
  switch (input.type) {
    case 'light':
      return { ...base, type: 'light', on: false, brightness: 80, color: '#ffd29a' };
    case 'appliance':
      return { ...base, type: 'appliance', kind: input.kind, on: false };
    case 'thermostat':
      return { ...base, type: 'thermostat', mode: 'off', target: 22 };
    case 'doorbell':
      return { ...base, type: 'doorbell', lastRingAt: null, ringCount: 0 };
    case 'climate':
      return { ...base, type: 'climate', value: 22, humidity: 50, baseline: 22, baselineHumidity: 50, readings: [{ ts, value: 22, humidity: 50 }] };
    case 'contact':
      return { ...base, type: 'contact', kind: input.kind, open: false, lastChangedAt: null };
    case 'motion':
      return { ...base, type: 'motion', detected: false, lastDetectedAt: null };
  }
}

const actionUses = (a: RuleAction, id: ID) => 'deviceId' in a && a.deviceId === id;
const conditionUses = (c: Condition, id: ID) => 'deviceId' in c && c.deviceId === id;

/** Remove a device and every rule step / scene step that referenced it. */
function removeDevice(state: AppState, device: Device, ts: number): AppState {
  let removedRules = 0;
  const rules: Rule[] = [];
  for (const r of state.rules) {
    const actions = r.actions.filter((a) => !actionUses(a, device.id));
    if (('deviceId' in r.trigger && r.trigger.deviceId === device.id) || actions.length === 0) {
      removedRules++;
      continue;
    }
    rules.push({ ...r, actions, conditions: r.conditions.filter((c) => !conditionUses(c, device.id)) });
  }
  const scenes = state.scenes.map((s) => ({ ...s, actions: s.actions.filter((a) => !actionUses(a, device.id)) }));
  const next: AppState = {
    ...state,
    devices: state.devices.filter((d) => d.id !== device.id),
    rules,
    scenes,
    visitors: state.visitors.filter((v) => v.deviceId !== device.id),
    favorites: state.favorites.filter((id) => id !== device.id),
  };
  return log(next, ts, 'system', 'warning', `Removed ${device.name}${removedRules ? ` and ${removedRules} rule(s) that depended on it` : ''}`);
}

// ---------- reducer ----------

export function reducer(state: AppState, action: Action): AppState {
  const ts = action.ts;
  switch (action.type) {
    case 'device/toggle': {
      const d = findDevice(state, action.deviceId);
      if (!isSwitchable(d)) return state;
      const next = { ...setSwitch(state, d.id, !d.on), activeSceneId: null };
      return log(next, ts, 'device', 'info', `${d.name} (${roomName(state, d.roomId)}) turned ${d.on ? 'OFF' : 'ON'}`);
    }

    case 'light/setAll': {
      const targets = state.devices.filter((d) => d.type === 'light' && (!action.roomId || d.roomId === action.roomId) && d.on !== action.on);
      if (targets.length === 0) return state;
      let next = state;
      for (const t of targets) next = setSwitch(next, t.id, action.on);
      const where = action.roomId ? roomName(state, action.roomId) : 'all rooms';
      return log({ ...next, activeSceneId: null }, ts, 'device', 'info', `${targets.length} light(s) in ${where} turned ${action.on ? 'ON' : 'OFF'}`);
    }

    case 'light/brightness': {
      if (!getDevice(state, action.deviceId, 'light') || !Number.isFinite(action.brightness)) return state;
      const brightness = clamp(Math.round(action.brightness), 1, 100);
      return { ...patchDevice(state, action.deviceId, 'light', () => ({ brightness })), activeSceneId: null };
    }

    case 'light/color': {
      const d = getDevice(state, action.deviceId, 'light');
      if (!d || !HEX_RE.test(action.color) || d.color === action.color.toLowerCase()) return state;
      const next = patchDevice(state, d.id, 'light', () => ({ color: action.color.toLowerCase() }));
      return log({ ...next, activeSceneId: null }, ts, 'device', 'info', `${d.name} colour changed to ${action.color.toLowerCase()}`);
    }

    case 'light/preset': {
      if (!HEX_RE.test(action.color)) return state;
      const brightness = clamp(Math.round(action.brightness), 1, 100);
      const targets = state.devices.filter((d) => d.type === 'light' && (!action.roomId || d.roomId === action.roomId));
      if (!targets.length) return state;
      const ids = new Set(targets.map((t) => t.id));
      const next = {
        ...state,
        activeSceneId: null,
        devices: state.devices.map((d) => (ids.has(d.id) && d.type === 'light' ? { ...d, on: true, brightness, color: action.color.toLowerCase() } : d)),
      };
      const where = action.roomId ? roomName(state, action.roomId) : 'all rooms';
      return log(next, ts, 'device', 'info', `Lighting preset “${action.name}” applied to ${targets.length} light(s) in ${where}`);
    }

    case 'thermostat/set': {
      const d = getDevice(state, action.deviceId, 'thermostat');
      if (!d) return state;
      const mode = action.mode ?? d.mode;
      const target = action.target === undefined || !Number.isFinite(action.target) ? d.target : round1(clamp(action.target, THERMOSTAT_MIN, THERMOSTAT_MAX));
      if (mode === d.mode && target === d.target) return state;
      const next = { ...patchDevice(state, d.id, 'thermostat', () => ({ mode, target })), activeSceneId: null };
      return log(next, ts, 'climate', 'info', `${d.name} set to ${mode === 'off' ? 'off' : `${mode} ${formatTemp(target, state.settings.tempUnit)}`}`);
    }

    case 'doorbell/ring': {
      const bell = getDevice(state, action.deviceId, 'doorbell');
      if (!bell) return state;
      const visitor: Visitor = { id: makeId('vis'), ts, deviceId: bell.id, label: action.visitor, status: 'waiting' };
      let next = patchDevice(state, bell.id, 'doorbell', (d) => ({ lastRingAt: ts, ringCount: d.ringCount + 1 }));
      next = { ...next, visitors: [visitor, ...next.visitors].slice(0, MAX_VISITORS) };
      next = log(next, ts, 'doorbell', 'info', `${bell.name} pressed — simulated visitor: ${action.visitor}`);
      next = notify(next, ts, { severity: 'info', category: 'doorbell', title: 'Doorbell', message: `${action.visitor} is at the door (${bell.name}).` });
      return emit(next, { kind: 'doorbell_pressed', deviceId: bell.id }, ts);
    }

    case 'visitor/status': {
      const v = state.visitors.find((x) => x.id === action.visitorId);
      if (!v || v.status === action.status) return state;
      const next = { ...state, visitors: state.visitors.map((x) => (x.id === v.id ? { ...x, status: action.status } : x)) };
      return log(next, ts, 'doorbell', 'info', `Visitor “${v.label}” marked as ${action.status}`);
    }

    case 'visitor/clear':
      return state.visitors.length ? { ...state, visitors: [] } : state;

    case 'contact/set': {
      const sensor = getDevice(state, action.deviceId, 'contact');
      if (!sensor || sensor.open === action.open) return state;
      const armed = state.settings.securityArmed;
      const severity: Severity = action.open ? (armed ? 'alert' : 'warning') : 'info';
      const what = `${sensor.name} ${action.open ? 'OPENED' : 'closed'}`;
      let next = patchDevice(state, sensor.id, 'contact', () => ({ open: action.open, lastChangedAt: ts }));
      next = log(next, ts, 'security', severity, armed && action.open ? `${what} while security is ARMED` : what);
      next = notify(next, ts, {
        severity,
        category: 'security',
        title: armed && action.open ? 'Security alert' : 'Sensor changed',
        message: `${what} (${roomName(state, sensor.roomId)})`,
      });
      return emit(next, { kind: action.open ? 'contact_opened' : 'contact_closed', deviceId: sensor.id }, ts);
    }

    case 'motion/detect': {
      const sensor = getDevice(state, action.deviceId, 'motion');
      if (!sensor) return state;
      let next = patchDevice(state, sensor.id, 'motion', () => ({ detected: true, lastDetectedAt: ts }));
      // Keep history readable: only log the start of a motion episode.
      if (!sensor.detected) {
        const armed = state.settings.securityArmed;
        next = log(next, ts, 'security', armed ? 'alert' : 'info', `Motion detected by ${sensor.name}${armed ? ' while ARMED' : ''}`);
        if (armed) next = notify(next, ts, { severity: 'alert', category: 'security', title: 'Security alert', message: `Motion detected by ${sensor.name} while armed` });
      }
      return emit(next, { kind: 'motion_detected', deviceId: sensor.id }, ts);
    }

    case 'motion/clear': {
      const sensor = getDevice(state, action.deviceId, 'motion');
      if (!sensor || !sensor.detected) return state;
      return patchDevice(state, sensor.id, 'motion', () => ({ detected: false }));
    }

    case 'climate/reading': {
      const sensor = getDevice(state, action.deviceId, 'climate');
      if (!sensor || !Number.isFinite(action.value)) return state;
      const value = round1(action.value);
      const humidity = action.humidity === undefined || !Number.isFinite(action.humidity) ? sensor.humidity : Math.round(clamp(action.humidity, 0, 100));
      let next = patchDevice(state, sensor.id, 'climate', (d) => ({
        value,
        humidity,
        readings: [...d.readings, { ts, value, humidity }].slice(-MAX_READINGS),
      }));
      if (action.manual) {
        next = log(next, ts, 'climate', 'info', `${sensor.name} manually set to ${formatTemp(value, state.settings.tempUnit)}, ${humidity}% humidity`);
      }
      return emit(next, { kind: 'climate_changed', deviceId: sensor.id, prev: sensor.value, value, prevHumidity: sensor.humidity, humidity }, ts);
    }

    case 'clock/tick':
      return runScheduledRules(state, ts);

    case 'scene/activate': {
      // Only a scene started by the person raises the event, so routines can never start each other in a loop.
      if (!state.scenes.some((s) => s.id === action.sceneId)) return state;
      return emit(activateScene(state, action.sceneId, ts), { kind: 'scene_started', sceneId: action.sceneId }, ts);
    }

    case 'rule/add': {
      if (ruleProblems(state, action.rule).length) return state;
      const rule: Rule = { ...action.rule, name: action.rule.name.trim(), id: makeId('rule'), enabled: true, createdAt: ts, lastRunAt: null, runCount: 0 };
      return log({ ...state, rules: [...state.rules, rule] }, ts, 'automation', 'info', `Rule “${rule.name}” created`);
    }

    case 'rule/update': {
      if (ruleProblems(state, action.rule).length || !state.rules.some((r) => r.id === action.ruleId)) return state;
      const name = action.rule.name.trim();
      const rules = state.rules.map((r) => (r.id === action.ruleId ? { ...r, ...action.rule, name } : r));
      return log({ ...state, rules }, ts, 'automation', 'info', `Rule “${name}” updated`);
    }

    case 'rule/toggle': {
      const rule = state.rules.find((r) => r.id === action.ruleId);
      if (!rule) return state;
      const rules = state.rules.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
      return log({ ...state, rules }, ts, 'automation', 'info', `Rule “${rule.name}” ${rule.enabled ? 'disabled' : 'enabled'}`);
    }

    case 'rule/delete': {
      const rule = state.rules.find((r) => r.id === action.ruleId);
      if (!rule) return state;
      return log({ ...state, rules: state.rules.filter((r) => r.id !== rule.id) }, ts, 'automation', 'info', `Rule “${rule.name}” deleted`);
    }

    case 'rule/test': {
      const rule = state.rules.find((r) => r.id === action.ruleId);
      return rule ? executeRule(state, rule, ts, 'tested manually') : state;
    }

    case 'activity/clear':
      return { ...state, activity: [] };

    case 'notification/read':
      return { ...state, notifications: state.notifications.map((n) => (n.id === action.id ? { ...n, read: true } : n)) };

    case 'notification/readAll':
      return { ...state, notifications: state.notifications.map((n) => (n.read ? n : { ...n, read: true })) };

    case 'notification/delete':
      return { ...state, notifications: state.notifications.filter((n) => n.id !== action.id), toasts: state.toasts.filter((n) => n.id !== action.id) };

    case 'notification/clear':
      return { ...state, notifications: [], toasts: [] };

    case 'toast/dismiss':
      return { ...state, toasts: state.toasts.filter((n) => n.id !== action.id) };

    case 'device/add': {
      if (!action.device.name.trim() || !state.rooms.some((r) => r.id === action.device.roomId)) return state;
      const device = buildDevice(action.device, ts);
      return log({ ...state, devices: [...state.devices, device] }, ts, 'system', 'success', `Added ${device.name} to ${roomName(state, device.roomId)}`);
    }

    case 'device/update': {
      const device = findDevice(state, action.deviceId);
      const name = action.name.trim();
      if (!device || !name || !state.rooms.some((r) => r.id === action.roomId)) return state;
      const devices = state.devices.map((d) => (d.id === device.id ? { ...d, name, roomId: action.roomId } : d));
      return log({ ...state, devices }, ts, 'system', 'info', `Updated ${name} (${roomName(state, action.roomId)})`);
    }

    case 'device/delete': {
      const device = findDevice(state, action.deviceId);
      return device ? removeDevice(state, device, ts) : state;
    }

    case 'room/add': {
      const name = action.name.trim();
      if (!name || state.rooms.some((r) => r.name.toLowerCase() === name.toLowerCase())) return state;
      return log({ ...state, rooms: [...state.rooms, { id: makeId('room'), name, kind: action.kind }] }, ts, 'system', 'success', `Room “${name}” added`);
    }

    case 'room/delete': {
      const room = state.rooms.find((r) => r.id === action.roomId);
      if (!room || state.devices.some((d) => d.roomId === room.id)) return state;
      return log({ ...state, rooms: state.rooms.filter((r) => r.id !== room.id) }, ts, 'system', 'info', `Room “${room.name}” removed`);
    }

    case 'settings/update': {
      const { securityArmed, ...rest } = action.patch;
      const prev = state.settings;
      let next: AppState = { ...state, settings: { ...prev, ...rest } };
      if (securityArmed !== undefined && securityArmed !== prev.securityArmed) next = setArmed(next, securityArmed, ts);
      if (rest.simulationRunning !== undefined && rest.simulationRunning !== prev.simulationRunning) {
        next = log(next, ts, 'system', 'info', `Simulation ${rest.simulationRunning ? 'resumed' : 'paused'}`);
      }
      return next;
    }

    case 'favorite/toggle': {
      const d = findDevice(state, action.deviceId);
      if (!d) return state;
      const pinned = state.favorites.includes(d.id);
      const favorites = pinned ? state.favorites.filter((id) => id !== d.id) : [...state.favorites, d.id];
      return log({ ...state, favorites }, ts, 'system', 'info', `${d.name} ${pinned ? 'removed from' : 'added to'} Home favourites`);
    }

    case 'state/reset': {
      const fresh = createSampleState(ts);
      // Keep display preferences; everything else returns to the demo home.
      const settings = { ...fresh.settings, theme: state.settings.theme, tempUnit: state.settings.tempUnit, largeText: state.settings.largeText };
      return log({ ...fresh, settings }, ts, 'system', 'warning', 'Demo data reset to the sample home');
    }
  }
}

export { createSampleState };
