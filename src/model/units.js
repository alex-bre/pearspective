// The document is always in meters; fields show and accept the chosen unit.
// Factors are integers so fromUnit divides exactly (3 / 1000 === 0.003).
const PER_METER = { m: 1, cm: 100, mm: 1000 }

// Display precision: 0.1 mm in every unit, so float noise never shows.
const DECIMALS = { m: 4, cm: 2, mm: 1 }

export const UNIT_OPTIONS = [
  { value: 'm', label: 'Meters' },
  { value: 'cm', label: 'Centimeters' },
  { value: 'mm', label: 'Millimeters' },
]

/** Meters → a number in `unit`, rounded to display precision. */
export const toUnit = (meters, unit) => +(meters * PER_METER[unit]).toFixed(DECIMALS[unit])

/** A number in `unit` → meters. */
export const fromUnit = (value, unit) => value / PER_METER[unit]

/** "0.5 m", "50 cm", … */
export const formatLength = (meters, unit) => `${toUnit(meters, unit)} ${unit}`
