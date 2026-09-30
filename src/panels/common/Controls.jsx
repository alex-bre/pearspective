import { useEffect, useState } from 'react'
import styles from './Controls.module.css'

/* A labelled row: label on the left, control(s) on the right. `wide` gives the
   label the room and pushes a compact control (a toggle) to the right edge. */
export function Field({ label, wide, children }) {
  return (
    <div className={`${styles.field} ${wide ? styles.wide : ''}`}>
      <span className={styles.label}>{label}</span>
      <div className={styles.control}>{children}</div>
    </div>
  )
}

/* Section inside a tab. `right` sits opposite the title (e.g. a unit note). */
export function Group({ title, children, right }) {
  return (
    <section className={styles.group}>
      {title && (
        <div className={styles.groupHead}>
          <h3 className={styles.groupTitle}>{title}</h3>
          {right && <span className={styles.groupNote}>{right}</span>}
        </div>
      )}
      <div className={styles.groupBody}>{children}</div>
    </section>
  )
}

const display = (v) => (v == null || Number.isNaN(v) ? '' : String(Math.round(v * 1e4) / 1e4))

/**
 * Numeric input that commits on Enter/blur and nudges with the arrow keys
 * (Shift = ×10). A null value renders blank (e.g. mixed multi-selection).
 * `prefix` is a short tag inside the left edge (an axis letter), `unit` one on the right.
 */
export function NumberInput({ value, onChange, min, max, step = 1, unit, prefix, prefixColor, disabled, placeholder = '—', title }) {
  const [text, setText] = useState(display(value))
  useEffect(() => setText(display(value)), [value])

  const clamp = (n) => {
    if (min != null) n = Math.max(min, n)
    if (max != null) n = Math.min(max, n)
    return n
  }
  const commit = () => {
    const n = parseFloat(text)
    if (!Number.isNaN(n)) onChange(clamp(n))
    else setText(display(value))
  }
  const nudge = (dir, big) => onChange(clamp((value || 0) + dir * step * (big ? 10 : 1)))

  return (
    <span className={styles.numberWrap}>
      {prefix && (
        <span className={styles.prefix} style={{ color: prefixColor }}>
          {prefix}
        </span>
      )}
      <input
        className={styles.input}
        type="text"
        inputMode="decimal"
        value={text}
        disabled={disabled}
        placeholder={placeholder}
        title={title}
        style={{ paddingLeft: prefix ? 20 : undefined, paddingRight: unit ? 30 : undefined }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit()
            e.target.blur()
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            nudge(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey)
          }
        }}
        onBlur={commit}
      />
      {unit && <span className={styles.unit}>{unit}</span>}
    </span>
  )
}

/* Text input that commits on Enter/blur — one change per edit, not per keystroke.
   An empty entry reverts. */
export function TextInput({ value, onChange }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])

  const commit = () => {
    const v = text.trim()
    if (v && v !== value) onChange(v)
    else setText(value)
  }

  return (
    <input
      className={styles.input}
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
      onBlur={commit}
    />
  )
}

/* Colour control: a swatch that opens the native picker (live while dragging in
   it), and a hex field that commits on Enter/blur. The # is optional; anything
   that isn't six hex digits reverts. */
export function ColorInput({ value, onChange }) {
  const [hex, setHex] = useState(value)
  useEffect(() => setHex(value), [value])

  const commit = () => {
    const v = '#' + hex.trim().replace(/^#/, '').toLowerCase()
    if (/^#[0-9a-f]{6}$/.test(v) && v !== value) onChange(v)
    else setHex(value)
  }

  return (
    <div className={styles.colorRow}>
      <span className={styles.swatchWrap}>
        <span className={styles.swatch} style={{ background: value }} />
        <input
          className={styles.colorPicker}
          type="color"
          title="Pick a colour"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
      <input
        className={`${styles.input} mono`}
        type="text"
        spellCheck={false}
        aria-label="Hex colour"
        value={hex}
        onChange={(e) => setHex(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
        onBlur={commit}
      />
    </div>
  )
}

/* Slider. */
export function Range({ value, onChange, min = 0, max = 1, step = 0.01, label }) {
  return (
    <input
      className={styles.range}
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
    />
  )
}

/* Small on/off switch. */
export function Toggle({ checked, onChange, title, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={title}
      className={styles.toggle}
      data-on={checked || undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.knob} />
    </button>
  )
}

/* Dropdown. options: [{ value, label }] */
export function Select({ value, onChange, options, disabled }) {
  return (
    <select
      className={styles.select}
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => {
        const opt = options.find((o) => String(o.value) === e.target.value)
        onChange(opt ? opt.value : e.target.value)
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/* Faint explanatory text under a group's controls. */
export function Hint({ children }) {
  return <p className={styles.hint}>{children}</p>
}

/* Tab strip for the side panels. tabs: [{ id, label }] */
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className={styles.tabs} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          className={styles.tab}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
