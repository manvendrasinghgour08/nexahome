import { BRAND } from '../core/brand';

/** NexaHome mark: an "N" sheltered by a roof line, on a charcoal tile. */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={`${BRAND.name} logo`}>
      <rect width="32" height="32" rx="9" style={{ fill: 'var(--logo-tile)' }} />
      <path d="M7 14.5 16 7l9 7.5" fill="none" stroke="#F5F0E7" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.5 24.5v-8l9 8v-8" fill="none" stroke="#CDBBA0" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Text logo "Nexa" + taupe "Home", optionally with the tagline. */
export function Logo({ size = 36, tagline = false }: { size?: number; tagline?: boolean }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      <span className="logo-text">
        <span className="logo-word">
          Nexa<span className="brand-accent">Home</span>
        </span>
        {tagline && <span className="logo-tagline">{BRAND.tagline}</span>}
      </span>
    </span>
  );
}
