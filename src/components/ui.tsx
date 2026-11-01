import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Severity } from '../core/types';

export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: ReactNode; actions?: ReactNode; back?: { to: string; label: string } }) {
  return (
    <header className="page-header">
      <div>
        {back && (
          <Link to={back.to} className="back-link">
            <ChevronLeft size={18} /> {back.label}
          </Link>
        )}
        <h1>{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Card({ title, icon, actions, children, className = '' }: { title?: string; icon?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          <h2>
            {icon && <span className="card-icon">{icon}</span>}
            {title}
          </h2>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Section({ title, hint, actions, children }: { title: string; hint?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <div>
          <h2 className="section-title">{title}</h2>
          {hint && <p className="section-hint">{hint}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** On/off switch that always shows its state in words, not just colour. */
export function Toggle({ checked, onChange, label, disabled, onText = 'On', offText = 'Off' }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; onText?: string; offText?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`switch ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-track">
        <span className="knob" />
      </span>
      <span className="switch-text" aria-hidden>{checked ? onText : offText}</span>
    </button>
  );
}

/** The big "Turn On / Turn Off" button used on every switchable device. */
export function PowerButton({ on, name, onToggle }: { on: boolean; name: string; onToggle: () => void }) {
  return (
    <button type="button" className={`power-btn ${on ? 'is-on' : ''}`} aria-label={`${on ? 'Turn Off' : 'Turn On'} ${name}`} onClick={onToggle}>
      {on ? 'Turn Off' : 'Turn On'}
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className={value === o.value ? 'active' : ''} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A clearly labelled section that opens and closes — used for advanced options. */
export function Disclosure({ label, hint, children, defaultOpen = false, advanced = false }: { label: string; hint?: string; children: ReactNode; defaultOpen?: boolean; advanced?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={`disclosure ${open ? 'open' : ''} ${advanced ? 'advanced' : ''}`}>
      <button type="button" className="disclosure-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <span className="disclosure-text">
          <span className="disclosure-label">
            {advanced && <span className="adv-tag">Advanced</span>}
            {label}
          </span>
          {hint && <span className="disclosure-hint">{hint}</span>}
        </span>
        <span className="disclosure-action">
          {open ? 'Hide' : 'Show'} <ChevronDown size={18} className="chev" />
        </span>
      </button>
      {open && (
        <div className="disclosure-body" id={id}>
          {children}
        </div>
      )}
    </div>
  );
}

/** Status shown with an icon AND words, never colour alone. */
export function Status({ tone, icon, children }: { tone: Severity | 'neutral' | 'on'; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={`status status-${tone}`}>
      {icon}
      {children}
    </span>
  );
}

export const Badge = Status;

export function LinkTile({ to, icon, title, text }: { to: string; icon: ReactNode; title: string; text: string }) {
  return (
    <Link to={to} className="link-tile">
      <span className="link-tile-icon">{icon}</span>
      <span className="link-tile-text">
        <strong>{title}</strong>
        <span>{text}</span>
      </span>
      <ChevronRight size={18} className="link-tile-chev" />
    </Link>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <strong>{title}</strong>
      {children && <div className="muted">{children}</div>}
    </div>
  );
}

/** Spinner with words, shown while something is loading. */
export function Loading({ label = 'Loading…', height }: { label?: string; height?: number }) {
  return (
    <div className="loading" role="status" style={height ? { minHeight: height } : undefined}>
      <span className="spinner" aria-hidden />
      {label}
    </div>
  );
}

/** Small "Demo" tag that marks pretend (simulated) activity. */
export function DemoTag() {
  return <span className="demo-tag" title="Pretend activity from the demo home — not a real event">Demo</span>;
}
