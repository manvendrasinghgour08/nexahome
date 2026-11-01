import { Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SceneTile } from '../components/SceneTile';
import { Card, EmptyState, PageHeader } from '../components/ui';
import { describeAction } from '../core/describe';
import { relativeTime } from '../core/format';
import { useNow, useStore } from '../state/store';

export function Scenes() {
  const { state } = useStore();
  const now = useNow();
  const unit = state.settings.tempUnit;
  const lastRun = (name: string) => state.activity.find((e) => e.category === 'scene' && e.message.startsWith(`Scene “${name}”`))?.ts ?? null;
  const active = state.scenes.find((s) => s.id === state.activeSceneId);

  return (
    <>
      <PageHeader
        title="Quick actions"
        back={{ to: '/', label: 'Home' }}
        subtitle={active ? `“${active.name}” is running. Changing a device by hand stops it.` : 'Tap Start and several things change at once.'}
      />
      {state.scenes.length ? (
        <div className="scene-cards">
          {state.scenes.map((s) => (
            <Card key={s.id} className="scene-card">
              <SceneTile scene={s} detailed />
              <div className="scene-steps">
                <div className="muted small">When you tap Start, this will:</div>
                <ul>
                  {s.actions.map((a, i) => <li key={i}>{describeAction(state, a, unit)}</li>)}
                  {s.actions.length === 0 && <li className="muted">Nothing — its devices were removed.</li>}
                </ul>
                <div className="muted small">Last used {relativeTime(lastRun(s.name), now)}</div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Sparkles size={28} />} title="No quick actions">Reset the demo home in Settings → Advanced to bring them back.</EmptyState>
      )}
      <p className="muted small">Tip: a routine can start a quick action for you, like “At 11 PM, start Sleep Mode”. <Link to="/automations">Create a routine</Link></p>
    </>
  );
}
