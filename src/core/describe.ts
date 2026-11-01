/** Human-readable descriptions of automation pieces, shared by the UI. */
import { findDevice } from './engine';
import { APPLIANCE_LABEL, formatTemp, MODE_LABEL, timeLabel } from './format';
import type { AppState, Condition, Device, RuleAction, Settings, Trigger } from './types';

const name = (state: AppState, id: string) => findDevice(state, id)?.name ?? 'a removed device';

export function describeTrigger(state: AppState, t: Trigger, unit: Settings['tempUnit']): string {
  switch (t.kind) {
    case 'motion_detected': return `${name(state, t.deviceId)} notices movement`;
    case 'contact_opened': return `${name(state, t.deviceId)} opens`;
    case 'contact_closed': return `${name(state, t.deviceId)} closes`;
    case 'doorbell_pressed': return `${name(state, t.deviceId)} is pressed`;
    case 'temp_above': return `${name(state, t.deviceId)} rises above ${formatTemp(t.threshold, unit)}`;
    case 'temp_below': return `${name(state, t.deviceId)} drops below ${formatTemp(t.threshold, unit)}`;
    case 'humidity_above': return `${name(state, t.deviceId)} humidity above ${t.threshold}%`;
    case 'time': return `it is ${timeLabel(t.at)}`;
    case 'scene_started': return `I start “${state.scenes.find((s) => s.id === t.sceneId)?.name ?? 'a removed quick action'}”`;
  }
}

export function describeCondition(state: AppState, c: Condition, unit: Settings['tempUnit']): string {
  switch (c.kind) {
    case 'time_between': return `time is ${timeLabel(c.from)}–${timeLabel(c.to)}`;
    case 'security_is': return `Away protection is ${c.armed ? 'on' : 'off'}`;
    case 'device_is': return `${name(state, c.deviceId)} is ${c.on ? 'on' : 'off'}`;
    case 'temp_is': return `${name(state, c.deviceId)} is ${c.op} ${formatTemp(c.value, unit)}`;
  }
}

export function describeAction(state: AppState, a: RuleAction, unit: Settings['tempUnit']): string {
  switch (a.kind) {
    case 'turn_on': return `Turn on ${name(state, a.deviceId)}`;
    case 'turn_off': return `Turn off ${name(state, a.deviceId)}`;
    case 'toggle': return `Toggle ${name(state, a.deviceId)}`;
    case 'light_set': return `Turn on ${name(state, a.deviceId)} at ${a.brightness}%`;
    case 'set_thermostat': return a.mode === 'off' ? `Turn off ${name(state, a.deviceId)}` : `${name(state, a.deviceId)}: ${MODE_LABEL[a.mode]} to ${formatTemp(a.target, unit)}`;
    case 'all_off': return `Turn off all ${a.target}`;
    case 'arm_security': return a.armed ? 'Turn on Away protection' : 'Turn off Away protection';
    case 'activate_scene': return `Start “${state.scenes.find((s) => s.id === a.sceneId)?.name ?? 'removed action'}”`;
    case 'notify': return `Send alert “${a.message}”`;
  }
}

/** Short status text for any device. */
export function deviceStatus(d: Device, unit: Settings['tempUnit']): string {
  switch (d.type) {
    case 'light': return d.on ? `On · ${d.brightness}%` : 'Off';
    case 'appliance': return `${APPLIANCE_LABEL[d.kind]} · ${d.on ? 'On' : 'Off'}`;
    case 'thermostat': return d.mode === 'off' ? 'Off' : `${MODE_LABEL[d.mode]} · ${formatTemp(d.target, unit)}`;
    case 'doorbell': return `${d.ringCount} rings`;
    case 'climate': return `${formatTemp(d.value, unit)} · ${d.humidity}% humidity`;
    case 'contact': return d.open ? 'Open' : 'Closed';
    case 'motion': return d.detected ? 'Movement now' : 'No movement';
  }
}

/** Is the device doing something right now (on / open / detecting)? */
export function isActive(d: Device): boolean {
  switch (d.type) {
    case 'light':
    case 'appliance': return d.on;
    case 'thermostat': return d.mode !== 'off';
    case 'contact': return d.open;
    case 'motion': return d.detected;
    default: return false;
  }
}
