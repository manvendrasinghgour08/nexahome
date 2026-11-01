import { AlertTriangle, BellRing, CheckCircle2, Info, X } from 'lucide-react';
import { useEffect } from 'react';
import type { AppNotification } from '../core/types';
import { useStore } from '../state/store';
import { DemoTag } from './ui';

const ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, alert: AlertTriangle };

function Toast({ n }: { n: AppNotification }) {
  const { dispatch } = useStore();
  useEffect(() => {
    const id = window.setTimeout(() => dispatch({ type: 'toast/dismiss', id: n.id }), n.severity === 'alert' ? 9000 : 6000);
    return () => window.clearTimeout(id);
  }, [n.id, n.severity, dispatch]);
  const Icon = n.category === 'doorbell' ? BellRing : ICONS[n.severity];
  return (
    <div className={`toast toast-${n.severity}`} role={n.severity === 'alert' ? 'alert' : 'status'}>
      <span className="toast-icon"><Icon size={18} /></span>
      <div className="toast-body">
        <strong>{n.title} {(n.category === 'doorbell' || n.category === 'security') && <DemoTag />}</strong>
        <span>{n.message}</span>
      </div>
      <button className="icon-btn" aria-label="Dismiss pop-up" onClick={() => dispatch({ type: 'toast/dismiss', id: n.id })}>
        <X size={16} />
      </button>
    </div>
  );
}

export function Toasts() {
  const { state } = useStore();
  return (
    <div className="toasts" aria-live="polite">
      {state.toasts.map((n) => (
        <Toast key={n.id} n={n} />
      ))}
    </div>
  );
}
