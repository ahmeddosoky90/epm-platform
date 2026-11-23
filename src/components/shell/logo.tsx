export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5ac8fa" /><stop offset="1" stopColor="#5856d6" /></linearGradient></defs>
      <rect width="32" height="32" rx="8" fill="url(#lg)" />
      <circle cx="16" cy="16" r="6.5" fill="none" stroke="#fff" strokeWidth="2.2" />
      <path d="M16 4.5v5M16 22.5v5M4.5 16h5M22.5 16h5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity=".85" />
    </svg>
  );
}
