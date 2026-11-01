import { ChevronRight, Thermometer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { roomClimate } from '../core/engine';
import { formatTemp } from '../core/format';
import type { Room } from '../core/types';
import { useStore } from '../state/store';
import { RoomImage } from './RoomImage';

export function RoomCard({ room }: { room: Room }) {
  const { state } = useStore();
  const devices = state.devices.filter((d) => d.roomId === room.id);
  const on = devices.filter((d) => (d.type === 'light' || d.type === 'appliance') && d.on).length;
  const climate = roomClimate(state, room.id);
  return (
    <Link to={`/rooms/${room.id}`} className="room-card" data-testid={`room-${room.id}`} aria-label={`Open ${room.name}`}>
      <div className="room-photo">
        <RoomImage kind={room.kind} alt={`${room.name} photo`} />
      </div>
      <div className="room-caption">
        <div>
          <strong className="room-name">{room.name}</strong>
          <span className="room-sub">
            {on ? `${on} ${on === 1 ? 'thing' : 'things'} on` : 'Everything off'}
            {climate && (
              <>
                {' · '}
                <Thermometer size={14} /> {formatTemp(climate.value, state.settings.tempUnit)}
              </>
            )}
          </span>
        </div>
        <ChevronRight size={20} className="room-chev" />
      </div>
    </Link>
  );
}
