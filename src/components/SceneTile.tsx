import { Film, Moon, Plane, Sparkles, Sunrise } from 'lucide-react';
import type { Scene } from '../core/types';
import { useFlash } from '../state/flash';
import { useStore } from '../state/store';

export const SCENE_ICON = { sunrise: Sunrise, film: Film, plane: Plane, moon: Moon, sparkles: Sparkles };

/** Short, friendly one-liners for the preset quick actions. */
const SHORT: Record<string, string> = {
  'scene-morning': 'Lights up, coffee on',
  'scene-movie': 'Dim lights, TV on',
  'scene-away': 'All off, home protected',
  'scene-sleep': 'Lights off, sleep well',
};

export function SceneTile({ scene, detailed = false }: { scene: Scene; detailed?: boolean }) {
  const { state, dispatch } = useStore();
  const flash = useFlash();
  const Icon = SCENE_ICON[scene.icon] ?? Sparkles;
  const active = state.activeSceneId === scene.id;
  return (
    <button
      type="button"
      className={`scene-tile ${active ? 'active' : ''} ${detailed ? 'detailed' : ''}`}
      aria-pressed={active}
      aria-label={`Start ${scene.name}`}
      onClick={() => {
        dispatch({ type: 'scene/activate', sceneId: scene.id });
        flash(`${scene.name} started`);
      }}
    >
      <span className="scene-icon"><Icon size={detailed ? 26 : 22} /></span>
      <span className="scene-text">
        <strong>{scene.name}</strong>
        <span>{detailed ? scene.description : SHORT[scene.id] ?? scene.description}</span>
      </span>
      <span className={`scene-state ${active ? 'on' : ''}`}>{active ? 'Running' : 'Start'}</span>
    </button>
  );
}
