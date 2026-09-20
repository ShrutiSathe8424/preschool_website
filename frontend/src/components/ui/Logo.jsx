/** A sprouting seed — two leaves over a seedling stem. */
export default function Logo({ size = 26, mono = false }) {
  const leafA = mono ? "#ffffff" : "var(--leaf-500)";
  const leafB = mono ? "rgba(255,255,255,0.72)" : "var(--teal-500)";
  const stem = mono ? "rgba(255,255,255,0.9)" : "var(--tangerine-500)";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 30V15" stroke={stem} strokeWidth="3.2" strokeLinecap="round" />
      <path d="M16 17C16 11 12 7 5 7c0 6 4 10 11 10Z" fill={leafA} />
      <path d="M16 19c0-5.5 3.6-9 10-9 0 5.5-3.6 9-10 9Z" fill={leafB} />
      <circle cx="16" cy="30" r="1.8" fill={stem} />
    </svg>
  );
}
