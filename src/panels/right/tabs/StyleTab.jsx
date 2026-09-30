import { useStore } from '../../../state/store'
import { coalesce } from '../../../state/history'
import { FINISH, SWATCHES } from '../../../model/objects'
import { ColorInput, Group, Range } from '../../common/Controls'
import styles from './StyleTab.module.css'

/** Colour, finish and opacity. Shows the last-picked object; edits every selected one. */
export default function StyleTab() {
  const selection = useStore((s) => s.selection)
  const obj = useStore((s) => s.document.objects[s.selection[s.selection.length - 1]])
  const styleSelected = useStore((s) => s.styleSelected)

  // The picker and the slider fire on every movement; each session is one undo step.
  const live = (prop, value) => {
    coalesce(`${prop}:${selection.join(',')}`)
    styleSelected({ [prop]: value })
  }

  return (
    <>
      <Group title="Color">
        <div className={styles.swatches}>
          {SWATCHES.map((c) => (
            <button
              key={c}
              className={styles.swatch}
              title={c}
              aria-label={`Colour ${c}`}
              data-active={obj.color === c || undefined}
              style={{ background: c }}
              onClick={() => styleSelected({ color: c })}
            />
          ))}
        </div>
        <ColorInput value={obj.color} onChange={(c) => live('color', c)} />
      </Group>

      <Group title="Finish">
        <div className={styles.segmented} role="radiogroup" aria-label="Finish">
          {Object.keys(FINISH).map((f) => (
            <button
              key={f}
              role="radio"
              aria-checked={obj.finish === f}
              data-active={obj.finish === f || undefined}
              onClick={() => styleSelected({ finish: f })}
            >
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </Group>

      <Group title="Opacity">
        <div className={styles.opacityRow}>
          <Range label="Opacity" min={0.1} max={1} step={0.01} value={obj.opacity} onChange={(v) => live('opacity', v)} />
          <span className={styles.pct}>{Math.round(obj.opacity * 100)}%</span>
        </div>
      </Group>
    </>
  )
}
