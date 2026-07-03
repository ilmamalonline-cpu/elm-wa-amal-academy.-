// components/ui/SoundWaveMark.tsx
// The academy's signature visual: concentric rings radiating from a single
// point — read as both a sound wave (phonetics, the academy's actual
// specialty) and a ripple of influence (علم وعمل، knowledge put into
// practice). Tints via `currentColor` so it can sit in gold or green.

export function SoundWaveMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" className={className} aria-hidden="true">
      <circle cx="100" cy="100" r="5" fill="currentColor" />
      <circle cx="100" cy="100" r="26" stroke="currentColor" strokeWidth="2" opacity="0.75" />
      <circle cx="100" cy="100" r="50" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
      <circle cx="100" cy="100" r="76" stroke="currentColor" strokeWidth="1.25" opacity="0.35" />
      <circle cx="100" cy="100" r="98" stroke="currentColor" strokeWidth="1" opacity="0.18" />
    </svg>
  )
}
