// The Ethos seal: a persona's "voice" (brass bars) measured against the
// manifest baseline, with one stroke breaching it (the violation, in oxblood).
// Matches /public/seal.svg used as the favicon.
export function Seal({ size = 34, className }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Ethos seal"
    >
      <circle cx="32" cy="32" r="24" fill="none" stroke="var(--brass)" strokeWidth="2.5" />
      <circle cx="32" cy="32" r="19" fill="none" stroke="var(--brass)" strokeWidth="1" opacity="0.5" />
      <line x1="16" y1="38" x2="48" y2="38" stroke="var(--brass)" strokeWidth="1.5" opacity="0.85" />
      <rect x="20" y="30" width="3.2" height="8" fill="var(--brass)" />
      <rect x="26" y="26" width="3.2" height="12" fill="var(--brass)" />
      <rect x="38" y="28" width="3.2" height="10" fill="var(--brass)" />
      <rect x="44" y="32" width="3.2" height="6" fill="var(--brass)" />
      <rect x="32" y="16" width="3.2" height="22" fill="var(--struck)" />
    </svg>
  );
}
