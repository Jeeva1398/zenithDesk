import { useId } from 'react';

// The ZenithDesk mark, traced from the brand sheet: a Z whose base is a ticket
// stub (notched ends + perforation), with an amber "zenith" sun cut free at the
// top-right corner. Drawn in its own 369×390 box with the Z's top-left at 0,0.
const Z_PATH = 'M0 0H285A84 84 0 0 0 367 83L135 307H369V390H0V307L232 83H0Z';

function ZGlyph({ id, color }) {
  return (
    <>
      <mask id={`${id}-cut`} maskUnits="userSpaceOnUse" x="-40" y="-100" width="480" height="520">
        <path d={Z_PATH} fill="#fff" />
        <circle cx="0" cy="348" r="26" fill="#000" />
        <circle cx="369" cy="348" r="26" fill="#000" />
        <rect x="264" y="303" width="15" height="19" rx="3" fill="#000" />
        <rect x="264" y="339" width="15" height="19" rx="3" fill="#000" />
        <rect x="264" y="375" width="15" height="19" rx="3" fill="#000" />
      </mask>
      <path d={Z_PATH} fill={color} mask={`url(#${id}-cut)`} />
      <circle cx="369" cy="0" r="55" fill={`url(#${id}-sun)`} />
    </>
  );
}

function SunGradient({ id }) {
  return (
    <linearGradient id={`${id}-sun`} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#FFB547" />
      <stop offset="1" stopColor="#FF8A3D" />
    </linearGradient>
  );
}

// App-icon form: the reversed mark on the indigo rounded square.
export function LogoMark({ className = 'size-8' }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="ZenithDesk">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5B50F5" />
          <stop offset="1" stopColor="#1B1466" />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0" stopColor="#FFB547" stopOpacity="0.45" />
          <stop offset="1" stopColor="#FFB547" stopOpacity="0" />
        </radialGradient>
        <SunGradient id={id} />
      </defs>
      <rect width="100" height="100" rx="24" fill={`url(#${id}-bg)`} />
      <circle cx="75" cy="24" r="22" fill={`url(#${id}-glow)`} />
      <g transform="translate(18 24) scale(0.1545)">
        <ZGlyph id={id} color="#fff" />
      </g>
    </svg>
  );
}

// Full lockup: icon + "Zenith" (bold, ink) "Desk" (regular, indigo).
// Pass `reversed` on dark surfaces.
function Logo({ size = 'md', reversed = false, stacked = false }) {
  const iconClass = { sm: 'size-7', md: 'size-8', lg: 'size-11' }[size];
  const textClass = { sm: 'text-base', md: 'text-lg', lg: 'text-2xl' }[size];

  return (
    <div className={`flex items-center ${stacked ? 'flex-col gap-2.5' : 'gap-2.5'}`}>
      <LogoMark className={`${iconClass} shrink-0 drop-shadow-sm`} />
      <span className={`font-display ${textClass} leading-none tracking-[-0.012em]`}>
        <span className={`font-bold ${reversed ? 'text-white' : 'text-[#15123F] dark:text-white'}`}>Zenith</span>
        <span className={reversed ? 'text-[#B4AEFF]' : 'text-[#4F46E5] dark:text-[#B4AEFF]'}>Desk</span>
      </span>
    </div>
  );
}

export default Logo;
