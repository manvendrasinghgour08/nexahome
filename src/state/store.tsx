import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { reducer, roomClimate, type Action } from '../core/engine';
import { hvacState, nextHumidity, nextTemperature, pickVisitor } from '../core/simulation';
import { loadState, saveState } from '../core/storage';
import type { AppState, DeviceOf } from '../core/types';

/** Actions without a timestamp — the store stamps them with the current time. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type Command = DistributiveOmit<Action, 'ts'>;

interface StoreValue {
  state: AppState;
  dispatch: (cmd: Command) => void;
  /** Runs one simulation step immediately (also used by the interval). */
  simulateTick: () => void;
  storageWarning: string | null;
  dismissStorageWarning: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

const MOTION_CHANCE = 0.12;
const CONTACT_CHANCE = 0.04;
const VISITOR_CHANCE = 0.03;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(loadState);
  const [state, rawDispatch] = useReducer(reducer, initial.state);
  const [storageWarning, setStorageWarning] = useState<string | null>(initial.warning ?? null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const dispatch = useCallback((cmd: Command) => rawDispatch({ ...cmd, ts: Date.now() } as Action), []);

  // Persist (debounced) whenever state changes.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const error = saveState(state);
      if (error) setStorageWarning(error);
    }, 250);
    return () => window.clearTimeout(id);
  }, [state]);

  // Save straight away when the page is closed, reloaded or hidden, so the last change is never lost.
  useEffect(() => {
    const flush = () => saveState(stateRef.current);
    const onHide = () => document.visibilityState === 'hidden' && flush();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);

  const simulateTick = useCallback(() => {
    const s = stateRef.current;
    const now = Date.now();
    for (const d of s.devices) {
      if (d.type === 'climate') {
        // An active thermostat in the same room pulls the temperature toward its target.
        const thermostat = s.devices.find((t): t is DeviceOf<'thermostat'> => t.type === 'thermostat' && t.roomId === d.roomId);
        const hvac = thermostat ? hvacState(thermostat, roomClimate(s, d.roomId)?.value) : 'off';
        const pull = hvac === 'heating' || hvac === 'cooling' ? thermostat!.target : undefined;
        dispatch({
          type: 'climate/reading',
          deviceId: d.id,
          value: nextTemperature(d.value, d.baseline, now, Math.random, pull),
          humidity: nextHumidity(d.humidity, d.baselineHumidity),
        });
      } else if (d.type === 'motion' && s.settings.randomMotion && Math.random() < MOTION_CHANCE) {
        dispatch({ type: 'motion/detect', deviceId: d.id });
      } else if (d.type === 'contact' && s.settings.randomContacts && Math.random() < CONTACT_CHANCE) {
        dispatch({ type: 'contact/set', deviceId: d.id, open: !d.open });
      } else if (d.type === 'doorbell' && s.settings.randomVisitors && Math.random() < VISITOR_CHANCE) {
        dispatch({ type: 'doorbell/ring', deviceId: d.id, visitor: pickVisitor() });
      }
    }
  }, [dispatch]);

  const { simulationRunning, tickSeconds, motionResetSeconds, theme, largeText } = state.settings;

  useEffect(() => {
    document.documentElement.dataset.text = largeText ? 'large' : 'normal';
  }, [largeText]);

  // Simulation loop.
  useEffect(() => {
    if (!simulationRunning) return;
    const id = window.setInterval(simulateTick, Math.max(1, tickSeconds) * 1000);
    return () => window.clearInterval(id);
  }, [simulationRunning, tickSeconds, simulateTick]);

  // Every second: run scheduled (time-of-day) rules and reset motion sensors after the configured time.
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      dispatch({ type: 'clock/tick' });
      for (const d of stateRef.current.devices) {
        if (d.type === 'motion' && d.detected && d.lastDetectedAt !== null && now - d.lastDetectedAt >= motionResetSeconds * 1000) {
          dispatch({ type: 'motion/clear', deviceId: d.id });
        }
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [motionResetSeconds, dispatch]);

  // Theme.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  const value = useMemo(
    () => ({ state, dispatch, simulateTick, storageWarning, dismissStorageWarning: () => setStorageWarning(null) }),
    [state, dispatch, simulateTick, storageWarning],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}

/** Re-render every `ms` so clocks and relative times ("2 min ago") stay fresh. */
export function useNow(ms = 10_000): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

/** UI preference (selected tab, filter…) remembered in localStorage; survives storage being unavailable. */
export function usePersistentState<T extends string>(key: string, fallback: T, allowed?: readonly T[]): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const v = localStorage.getItem(`smartnest:ui:${key}`) as T | null;
      return v !== null && (!allowed || allowed.includes(v)) ? v : fallback;
    } catch {
      return fallback;
    }
  });
  const set = useCallback(
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(`smartnest:ui:${key}`, v);
      } catch {
        /* preference just won't be remembered */
      }
    },
    [key],
  );
  return [value, set];
}
