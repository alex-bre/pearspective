import { useStore } from '../../../state/store'
import { LABELS } from '../../../model/objects'
import { toUnit, fromUnit } from '../../../model/units'
import { Group, NumberInput, TextInput } from '../../common/Controls'
import styles from './ArrangeTab.module.css'

const MIN_SIZE = 0.001 // m
const AXIS_COLOR = ['var(--x)', 'var(--y)', 'var(--z)']

/** Properties of the selection. With several selected, the last one picked is edited. */
export default function ArrangeTab() {
  const count = useStore((s) => s.selection.length)
  const obj = useStore((s) => s.document.objects[s.selection[s.selection.length - 1]])
  const { unit: u, grid, snapGround } = useStore((s) => s.settings)
  // Actions never change, so they are read once rather than subscribed to.
  const { renameObject, updateObject, dropToGround, centerObject, duplicateSelected, removeSelected } = useStore.getState()

  const setAxis = (key, i, v) => updateObject(obj.id, { [key]: obj[key].map((c, j) => (j === i ? v : c)) })
  // A length field for component i of position/size: shows the display unit, stores meters.
  const length = (key, i, prefix, extra = {}) => (
    <NumberInput
      value={toUnit(obj[key][i], u)}
      unit={u}
      prefix={prefix}
      step={toUnit(grid, u)}
      onChange={(v) => setAxis(key, i, fromUnit(v, u))}
      {...extra}
    />
  )

  return (
    <>
      <Group title={count > 1 ? `${count} selected · editing last` : LABELS[obj.type]}>
        <TextInput value={obj.name} onChange={(name) => renameObject(obj.id, name)} />
      </Group>

      <Group title="Position" right={snapGround ? `${u} · Y rests on ground` : u}>
        <div className={styles.xyz}>
          {length('position', 0, 'X', { prefixColor: AXIS_COLOR[0] })}
          {length('position', 1, 'Y', { prefixColor: AXIS_COLOR[1], disabled: snapGround })}
          {length('position', 2, 'Z', { prefixColor: AXIS_COLOR[2] })}
        </div>
      </Group>

      <Group title="Size" right={u}>
        <div className={styles.xyz}>
          {length('size', 0, 'W', { min: toUnit(MIN_SIZE, u) })}
          {length('size', 2, 'D', { min: toUnit(MIN_SIZE, u) })}
          {length('size', 1, 'H', { min: toUnit(MIN_SIZE, u) })}
        </div>
      </Group>

      <Group title="Rotation" right="degrees">
        <div className={styles.xyz}>
          {[0, 1, 2].map((i) => (
            <NumberInput
              key={i}
              value={obj.rotation[i]}
              prefix={'XYZ'[i]}
              prefixColor={AXIS_COLOR[i]}
              step={15}
              onChange={(v) => setAxis('rotation', i, v)}
            />
          ))}
        </div>
      </Group>

      <Group>
        <div className={styles.actions}>
          <button className={styles.action} onClick={() => dropToGround(obj.id)}>
            Drop to ground
          </button>
          <button className={styles.action} onClick={() => centerObject(obj.id)}>
            Center
          </button>
          <button className={styles.action} title="Duplicate (Ctrl+D)" onClick={duplicateSelected}>
            Duplicate
          </button>
          <button className={`${styles.action} ${styles.danger}`} title="Delete (Del)" onClick={removeSelected}>
            Delete
          </button>
        </div>
      </Group>
    </>
  )
}
