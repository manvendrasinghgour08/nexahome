/** Minimal line drawing of a cosy home — pure SVG in brand colours, no image file needed. */
export function HomeIllustration({ lightsOn = true }: { lightsOn?: boolean }) {
  return (
    <svg className="home-illustration" viewBox="0 0 240 160" role="img" aria-label={lightsOn ? 'A cosy house with warm lights on' : 'A quiet house with the lights off'}>
      <circle cx="196" cy="34" r="16" className="ill-sun" />
      <path d="M18 132h204" className="ill-ground" />
      <path d="M44 132V78l60-44 60 44v54" className="ill-wall" />
      <path d="M34 84l70-52 70 52" className="ill-roof" />
      <rect x="132" y="44" width="14" height="22" rx="2" className="ill-wall" />
      <rect x="62" y="88" width="30" height="26" rx="3" className={lightsOn ? 'ill-window on' : 'ill-window'} />
      <path d="M77 88v26M62 101h30" className="ill-line" />
      <rect x="114" y="94" width="26" height="38" rx="3" className="ill-door" />
      <circle cx="134" cy="114" r="1.8" className="ill-knob" />
      <path d="M196 132v-26" className="ill-line" />
      <path d="M196 112c-10-4-12-14-6-20 4 6 8 10 6 20zM196 118c9-4 12-12 7-18-4 5-8 9-7 18z" className="ill-leaf" />
      <path d="M28 132c0-8 6-12 12-12s10 5 10 12" className="ill-leaf" />
    </svg>
  );
}
