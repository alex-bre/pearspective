/* The pear mark. Filled from theme tokens so it lifts in dark mode. */
export default function PearMark({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true">
      <rect x="12.2" y="1" width="1.6" height="5.5" rx="0.8" fill="var(--leaf)" />
      <ellipse cx="17.2" cy="4.2" rx="3.6" ry="1.6" transform="rotate(-25 17.2 4.2)" fill="var(--leaf)" />
      <circle cx="13" cy="10.8" r="5" fill="var(--pear)" />
      <circle cx="13" cy="17.6" r="7.4" fill="var(--pear)" />
    </svg>
  )
}
