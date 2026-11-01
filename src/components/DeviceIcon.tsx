import { AppWindow, BellRing, DoorClosed, DoorOpen, Droplets, Fan, Lightbulb, LightbulbOff, PersonStanding, Plug, Speaker, Thermometer, Tv } from 'lucide-react';
import type { Device } from '../core/types';

export function DeviceIcon({ device, size = 20 }: { device: Device; size?: number }) {
  switch (device.type) {
    case 'light':
      return device.on ? <Lightbulb size={size} /> : <LightbulbOff size={size} />;
    case 'appliance':
      if (device.kind === 'tv') return <Tv size={size} />;
      if (device.kind === 'fan') return <Fan size={size} className={device.on ? 'spin' : undefined} />;
      if (device.kind === 'speaker') return <Speaker size={size} />;
      return <Plug size={size} />;
    case 'thermostat':
      return <Thermometer size={size} />;
    case 'climate':
      return <Droplets size={size} />;
    case 'doorbell':
      return <BellRing size={size} />;
    case 'motion':
      return <PersonStanding size={size} />;
    case 'contact':
      if (device.kind === 'window') return <AppWindow size={size} />;
      return device.open ? <DoorOpen size={size} /> : <DoorClosed size={size} />;
  }
}
