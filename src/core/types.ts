export type ID = string;

export type RoomKind = 'living' | 'bedroom' | 'kitchen' | 'bathroom' | 'entrance' | 'study' | 'other';

export interface Room {
  id: ID;
  name: string;
  kind: RoomKind; // picks the room photo and fallback gradient
}

interface BaseDevice {
  id: ID;
  name: string;
  roomId: ID;
}

export interface LightDevice extends BaseDevice {
  type: 'light';
  on: boolean;
  brightness: number; // 1-100, remembered while the light is off
  color: string; // #rrggbb, remembered while the light is off
}

export type ApplianceKind = 'tv' | 'fan' | 'speaker' | 'plug';

export interface ApplianceDevice extends BaseDevice {
  type: 'appliance';
  kind: ApplianceKind;
  on: boolean;
}

export type ThermostatMode = 'off' | 'heat' | 'cool' | 'auto';

export interface ThermostatDevice extends BaseDevice {
  type: 'thermostat';
  mode: ThermostatMode;
  target: number; // °C
}

export interface DoorbellDevice extends BaseDevice {
  type: 'doorbell';
  lastRingAt: number | null;
  ringCount: number;
}

export interface Reading {
  ts: number;
  value: number; // °C
  humidity: number; // %
}

export interface ClimateSensor extends BaseDevice {
  type: 'climate';
  value: number; // °C
  humidity: number; // %
  baseline: number; // °C the simulation drifts around
  baselineHumidity: number;
  readings: Reading[];
}

export interface ContactSensor extends BaseDevice {
  type: 'contact';
  kind: 'door' | 'window';
  open: boolean;
  lastChangedAt: number | null;
}

export interface MotionSensor extends BaseDevice {
  type: 'motion';
  detected: boolean;
  lastDetectedAt: number | null;
}

export type Device =
  | LightDevice
  | ApplianceDevice
  | ThermostatDevice
  | DoorbellDevice
  | ClimateSensor
  | ContactSensor
  | MotionSensor;
export type DeviceType = Device['type'];
export type DeviceOf<T extends DeviceType> = Extract<Device, { type: T }>;

// ---------- automation ----------

export type Trigger =
  | { kind: 'motion_detected'; deviceId: ID }
  | { kind: 'contact_opened'; deviceId: ID }
  | { kind: 'contact_closed'; deviceId: ID }
  | { kind: 'doorbell_pressed'; deviceId: ID }
  | { kind: 'temp_above'; deviceId: ID; threshold: number }
  | { kind: 'temp_below'; deviceId: ID; threshold: number }
  | { kind: 'humidity_above'; deviceId: ID; threshold: number }
  | { kind: 'time'; at: string } // "HH:MM" local time
  | { kind: 'scene_started'; sceneId: ID }; // e.g. "when I start Away Mode" = when I leave home

export type Condition =
  | { kind: 'time_between'; from: string; to: string } // may wrap past midnight
  | { kind: 'security_is'; armed: boolean }
  | { kind: 'device_is'; deviceId: ID; on: boolean } // light or appliance
  | { kind: 'temp_is'; deviceId: ID; op: 'above' | 'below'; value: number };

export type RuleAction =
  | { kind: 'turn_on'; deviceId: ID } // light or appliance
  | { kind: 'turn_off'; deviceId: ID }
  | { kind: 'toggle'; deviceId: ID }
  | { kind: 'light_set'; deviceId: ID; brightness: number; color: string }
  | { kind: 'set_thermostat'; deviceId: ID; mode: ThermostatMode; target: number }
  | { kind: 'all_off'; target: 'lights' | 'appliances' }
  | { kind: 'arm_security'; armed: boolean }
  | { kind: 'activate_scene'; sceneId: ID }
  | { kind: 'notify'; message: string };

export interface Rule {
  id: ID;
  name: string;
  enabled: boolean;
  trigger: Trigger;
  conditions: Condition[];
  actions: RuleAction[];
  createdAt: number;
  lastRunAt: number | null;
  runCount: number;
}

export type SceneIcon = 'sunrise' | 'film' | 'plane' | 'moon' | 'sparkles';

export interface Scene {
  id: ID;
  name: string;
  description: string;
  icon: SceneIcon;
  actions: RuleAction[]; // scenes never contain activate_scene
}

// ---------- events, notifications, visitors ----------

export type Severity = 'info' | 'success' | 'warning' | 'alert';
export type EventCategory = 'device' | 'doorbell' | 'security' | 'climate' | 'automation' | 'scene' | 'system';

export interface ActivityEvent {
  id: ID;
  ts: number;
  category: EventCategory;
  severity: Severity;
  message: string;
}

export interface AppNotification {
  id: ID;
  ts: number;
  severity: Severity;
  category: EventCategory;
  title: string;
  message: string;
  read: boolean;
}

export interface Visitor {
  id: ID;
  ts: number;
  deviceId: ID;
  label: string; // simulated, e.g. "Courier with a parcel"
  status: 'waiting' | 'answered' | 'missed';
}

export interface Settings {
  simulationRunning: boolean;
  tickSeconds: number;
  randomMotion: boolean;
  randomContacts: boolean;
  randomVisitors: boolean;
  motionResetSeconds: number;
  tempUnit: 'C' | 'F';
  theme: 'system' | 'light' | 'dark';
  notifications: boolean; // pop-up toasts (the notification centre always records)
  doorbellSound: boolean;
  securityArmed: boolean;
  largeText: boolean; // bigger text for easier reading
  /** Design generation the settings were saved with; older saves switch to the light theme once. */
  uiVersion: number;
}

export interface AppState {
  version: 2;
  rooms: Room[];
  devices: Device[];
  rules: Rule[];
  scenes: Scene[];
  activeSceneId: ID | null;
  activity: ActivityEvent[];
  notifications: AppNotification[];
  toasts: AppNotification[]; // transient, never saved
  visitors: Visitor[];
  favorites: ID[]; // devices pinned to the Home screen
  settings: Settings;
}

/** Things that happen in the house which automation rules can react to. */
export type DomainEvent =
  | { kind: 'motion_detected'; deviceId: ID }
  | { kind: 'contact_opened'; deviceId: ID }
  | { kind: 'contact_closed'; deviceId: ID }
  | { kind: 'doorbell_pressed'; deviceId: ID }
  | { kind: 'climate_changed'; deviceId: ID; prev: number; value: number; prevHumidity: number; humidity: number }
  | { kind: 'scene_started'; sceneId: ID };

export type NewDevice =
  | { type: 'light'; name: string; roomId: ID }
  | { type: 'appliance'; name: string; roomId: ID; kind: ApplianceKind }
  | { type: 'thermostat'; name: string; roomId: ID }
  | { type: 'doorbell'; name: string; roomId: ID }
  | { type: 'climate'; name: string; roomId: ID }
  | { type: 'contact'; name: string; roomId: ID; kind: 'door' | 'window' }
  | { type: 'motion'; name: string; roomId: ID };
