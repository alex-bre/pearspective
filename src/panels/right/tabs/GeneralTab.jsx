import { useStore } from '../../../state/store'
import { UNIT_OPTIONS, toUnit, fromUnit } from '../../../model/units'
import { Field, Group, Hint, NumberInput, Select, Toggle } from '../../common/Controls'

const MIN_PLAYGROUND = 0.1 // m
const MIN_GRID = 0.001 // m

/** Scene-wide settings: units, playground size, grid, snapping. */
export default function GeneralTab() {
  const settings = useStore((s) => s.settings)
  const playground = useStore((s) => s.document.playground)
  const setSetting = useStore((s) => s.setSetting)
  const setPlayground = useStore((s) => s.setPlayground)
  const u = settings.unit

  // A length field: shows the display unit, stores meters.
  const length = (meters, minMeters, stepMeters, apply) => (
    <NumberInput
      value={toUnit(meters, u)}
      unit={u}
      min={toUnit(minMeters, u)}
      step={toUnit(stepMeters, u)}
      onChange={(v) => apply(fromUnit(v, u))}
    />
  )

  return (
    <>
      <Group title="Playground">
        <Field label="Units">
          <Select value={u} options={UNIT_OPTIONS} onChange={(v) => setSetting('unit', v)} />
        </Field>
        <Field label="Width">
          {length(playground.w, MIN_PLAYGROUND, settings.grid, (v) => setPlayground('w', v))}
        </Field>
        <Field label="Depth">
          {length(playground.d, MIN_PLAYGROUND, settings.grid, (v) => setPlayground('d', v))}
        </Field>
      </Group>

      <Group title="Grid">
        <Field label="Size">{length(settings.grid, MIN_GRID, 0.01, (v) => setSetting('grid', v))}</Field>
        <Field label="Show grid" wide>
          <Toggle checked={settings.showGrid} onChange={(v) => setSetting('showGrid', v)} />
        </Field>
      </Group>

      <Group title="Snapping">
        <Field label="Snap to grid" wide>
          <Toggle checked={settings.snap} onChange={(v) => setSetting('snap', v)} />
        </Field>
        <Field label="Snap to ground" wide>
          <Toggle checked={settings.snapGround} onChange={(v) => setSetting('snapGround', v)} />
        </Field>
        <Hint>Objects rest on the ground and move in grid steps. Resizing snaps to the grid, rotating to 15°.</Hint>
      </Group>
    </>
  )
}
