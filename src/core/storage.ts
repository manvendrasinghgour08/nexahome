import { BRAND } from './brand';
import { createSampleState, DEFAULT_SETTINGS, SAMPLE_FAVORITES } from './sampleData';
import type { ActivityEvent, AppNotification, AppState, Scene, Settings } from './types';

// Storage keys keep the original 'smartnest' prefix on purpose: renaming them would lose saved homes.
export const STORAGE_KEY = 'smartnest:v2';
export const LEGACY_KEY = 'smartnest:v1';

export type LoadResult = { state: AppState; warning?: string };

const isArray = (v: unknown): v is unknown[] => Array.isArray(v);

/** The app was renamed from SmartNest; update the old name inside saved message text only. */
const rebrand = (text: unknown) => (typeof text === 'string' ? text.replace(/SmartNest/g, BRAND.name) : text) as string;

/** Keep only known settings keys with the right primitive type. */
function cleanSettings(raw: unknown): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS };
  if (raw && typeof raw === 'object') {
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
      const v = (raw as Record<string, unknown>)[key];
      if (typeof v === typeof DEFAULT_SETTINGS[key]) (out as unknown as Record<string, unknown>)[key] = v;
    }
  }
  // Saves from before the light redesign (no uiVersion) move to the new light theme once.
  if (!raw || typeof raw !== 'object' || typeof (raw as Record<string, unknown>).uiVersion !== 'number') out.theme = 'light';
  out.uiVersion = DEFAULT_SETTINGS.uiVersion;
  return out;
}

/** Parse saved v2 JSON defensively; anything unexpected falls back to the sample home. */
export function parseSaved(raw: string | null, now = Date.now()): LoadResult {
  if (raw === null) return { state: createSampleState(now) };
  try {
    const data = JSON.parse(raw) as Partial<AppState>;
    if (
      !data || data.version !== 2 ||
      !isArray(data.rooms) || !isArray(data.devices) || !isArray(data.rules) || !isArray(data.scenes) ||
      !isArray(data.activity) || !isArray(data.notifications) || !isArray(data.visitors)
    ) {
      throw new Error('unexpected shape');
    }
    return {
      state: {
        version: 2,
        rooms: data.rooms,
        devices: data.devices,
        rules: data.rules,
        // The preset "Sleep Mode" is now called "Good Night" (only if the name was never changed).
        scenes: (data.scenes as Scene[]).map((s) => (s.id === 'scene-sleep' && s.name === 'Sleep Mode' ? { ...s, name: 'Good Night' } : s)),
        activeSceneId: typeof data.activeSceneId === 'string' ? data.activeSceneId : null,
        activity: (data.activity as ActivityEvent[]).map((e) => ({ ...e, message: rebrand(e.message) })),
        notifications: (data.notifications as AppNotification[]).map((n) => ({ ...n, title: rebrand(n.title), message: rebrand(n.message) })),
        toasts: [],
        visitors: data.visitors,
        favorites: (isArray(data.favorites) ? data.favorites : SAMPLE_FAVORITES).filter(
          (id): id is string => typeof id === 'string' && (data.devices as { id: string }[]).some((d) => d.id === id),
        ),
        settings: cleanSettings(data.settings),
      },
    };
  } catch {
    return { state: createSampleState(now), warning: `Saved data was unreadable, so ${BRAND.name} started fresh with the sample home.` };
  }
}

/**
 * Version 1 of the app stored a smaller model. Its devices don't map cleanly onto the new rooms,
 * so we start from the new sample home but keep the user's display preferences.
 */
export function migrateLegacy(raw: string, now = Date.now()): LoadResult {
  const state = createSampleState(now);
  try {
    const old = JSON.parse(raw) as { settings?: Partial<Settings> };
    const s = old.settings ?? {};
    if (s.tempUnit === 'C' || s.tempUnit === 'F') state.settings.tempUnit = s.tempUnit;
  } catch {
    /* unreadable legacy data — the fresh sample home is fine */
  }
  state.activity.unshift({ id: 'evt-upgrade', ts: now, category: 'system', severity: 'info', message: `Upgraded to ${BRAND.name} 2 — demo home refreshed with the new rooms and devices` });
  return { state };
}

export function loadState(): LoadResult {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy !== null) {
        localStorage.removeItem(LEGACY_KEY);
        return migrateLegacy(legacy);
      }
    }
    return parseSaved(raw);
  } catch {
    return { state: createSampleState(), warning: 'Browser storage is unavailable — changes will not be saved.' };
  }
}

/** Returns an error message if saving failed. Toasts are transient and not saved. */
export function saveState(state: AppState): string | null {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, toasts: [] }));
    return null;
  } catch (e) {
    return e instanceof Error && e.name === 'QuotaExceededError'
      ? 'Browser storage is full — try clearing the activity history.'
      : 'Could not save your changes to browser storage.';
  }
}
