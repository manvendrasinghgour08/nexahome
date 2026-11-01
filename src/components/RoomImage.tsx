import { Bath, BedDouble, BookOpen, CookingPot, DoorOpen, Home, Sofa } from 'lucide-react';
import { useState } from 'react';
import { ROOM_IMAGE } from '../core/format';
import type { RoomKind } from '../core/types';

const FALLBACK_ICON = { living: Sofa, bedroom: BedDouble, kitchen: CookingPot, bathroom: Bath, entrance: DoorOpen, study: BookOpen, other: Home };

/** Room photo with a gradient + icon fallback when the image is missing or fails to load. */
export function RoomImage({ kind, alt, className = '' }: { kind: RoomKind; alt: string; className?: string }) {
  const src = ROOM_IMAGE[kind];
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    const Icon = FALLBACK_ICON[kind];
    return (
      <div className={`room-img fallback fb-${kind} ${className}`} role="img" aria-label={alt}>
        <Icon size={40} strokeWidth={1.4} />
      </div>
    );
  }
  return <img className={`room-img ${className}`} src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}
