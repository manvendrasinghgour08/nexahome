import type { CSSProperties } from 'react';
import { roomName } from '../core/engine';
import type { DeviceOf } from '../core/types';
import { useStore } from '../state/store';
import { DeviceIcon } from './DeviceIcon';

/** Big one-tap tile for a favourite light or appliance. Shows On/Off in words. */
export function FavoriteTile({ device }: { device: DeviceOf<'light'> | DeviceOf<'appliance'> }) {
  const { state, dispatch } = useStore();
  const style = device.type === 'light' ? ({ '--light': device.color } as CSSProperties) : undefined;
  return (
    <button
      type="button"
      className={`fav-tile ${device.on ? 'on' : ''} ${device.type}`}
      style={style}
      aria-pressed={device.on}
      aria-label={`${device.name}, ${roomName(state, device.roomId)}: ${device.on ? 'On' : 'Off'}. Tap to turn ${device.on ? 'off' : 'on'}`}
      onClick={() => dispatch({ type: 'device/toggle', deviceId: device.id })}
    >
      <span className="fav-top">
        <span className="fav-icon"><DeviceIcon device={device} size={24} /></span>
        <span className={`fav-state ${device.on ? 'on' : ''}`}>{device.on ? 'On' : 'Off'}</span>
      </span>
      <span className="fav-name">{device.name}</span>
      <span className="fav-sub">{roomName(state, device.roomId)}</span>
      <span className="fav-hint">Tap to turn {device.on ? 'off' : 'on'}</span>
    </button>
  );
}
