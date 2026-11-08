/**
 * Ikon for dokumentasjonen til Sandkassen: en sandkasse sett forfra, med sandhaug og spade.
 * Tegnet med currentColor, så det følger fargen til knappen det står i.
 */
export default function SandboxIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={0.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Spade: skaft og håndtak */}
      <path d="M11 11 14.2 4.8" />
      <path d="M13.2 2.8h3.2l-.9 2.6h-1.6z" />
      {/* Sandhaug */}
      <path d="M4.5 12c3-4.5 12-4.5 15 0" />
      {/* Kant og kasse */}
      <rect x="2" y="12" width="20" height="3" rx="0.5" />
      <rect x="4" y="15" width="16" height="5.5" rx="0.5" />
    </svg>
  );
}
