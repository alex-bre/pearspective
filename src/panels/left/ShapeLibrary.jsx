import { Group, Hint } from '../common/Controls'
import styles from './LeftPanel.module.css'

// Line glyphs drawn in a 34×34 box (lucide has no sphere, so all four are ours).
const SHAPES = [
  {
    type: 'cube',
    label: 'Cube',
    glyph: (
      <>
        <polygon points="17,4 29,10.5 29,23.5 17,30 5,23.5 5,10.5" />
        <polyline points="5,10.5 17,17 29,10.5" />
        <line x1="17" y1="17" x2="17" y2="30" />
      </>
    ),
  },
  {
    type: 'sphere',
    label: 'Sphere',
    glyph: (
      <>
        <circle cx="17" cy="17" r="12.5" />
        <ellipse cx="17" cy="17" rx="12.5" ry="4.5" />
      </>
    ),
  },
  {
    type: 'cylinder',
    label: 'Cylinder',
    glyph: (
      <>
        <ellipse cx="17" cy="8" rx="10" ry="3.5" />
        <path d="M7 8v18c0 1.9 4.5 3.5 10 3.5s10-1.6 10-3.5V8" />
      </>
    ),
  },
  {
    type: 'cone',
    label: 'Cone',
    glyph: (
      <>
        <path d="M17 4 7 26" />
        <path d="M17 4l10 22" />
        <ellipse cx="17" cy="26" rx="10" ry="3.5" />
      </>
    ),
  },
]

export default function ShapeLibrary() {
  return (
    <Group title="Primitives">
      <div className={styles.shapeGrid}>
        {SHAPES.map((s) => (
          <button key={s.type} className={styles.shape} title={`Add ${s.label.toLowerCase()}`}>
            <svg
              width="34"
              height="34"
              viewBox="0 0 34 34"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {s.glyph}
            </svg>
            <span className={styles.shapeLabel}>{s.label}</span>
          </button>
        ))}
      </div>
      <Hint>Click to add, or drag onto the playground.</Hint>
    </Group>
  )
}
