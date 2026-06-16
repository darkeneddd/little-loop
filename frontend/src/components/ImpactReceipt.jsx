import { Users, Droplets, Cloud, Recycle } from 'lucide-react'

// One tile definition per metric -- shared across every consumer so the
// "families served / water saved / CO2 avoided / waste diverted" foursome
// (T16) always reads the same way, whether it's embedded in the Passport's
// impact section or the Trade-In approval card. A tile only renders if its
// prop is actually passed (undefined skips it), so callers that don't have
// all four numbers handy can still use this component.
//
// Styling follows Design.md's "Impact chips" spec: uniform Sky Tint
// background, DM Mono value in Blue dark, muted uppercase label -- not
// per-metric tile colors.
const METRICS = [
  {
    key: 'familiesServed',
    icon: Users,
    label: 'Families served',
    format: (v) => v,
  },
  {
    key: 'waterSavedLiters',
    icon: Droplets,
    label: 'Water saved',
    format: (v) => `${v.toLocaleString()} L`,
  },
  {
    key: 'co2AvoidedKg',
    icon: Cloud,
    label: 'CO₂ avoided',
    format: (v) => `${v} kg`,
  },
  {
    key: 'wasteDivertedCount',
    icon: Recycle,
    label: 'Garments diverted',
    format: (v) => v,
  },
]

// Tailwind needs literal class strings to scan for -- can't interpolate
// `lg:grid-cols-${n}`, so look the column count up instead.
const LG_COLS = { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4' }

// Reusable "impact receipt" -- Sky Tint chips with DM Mono numbers, meant to
// feel like a shareable card (T16). Used on the Passport screen's impact
// section and the Employee Trade-In approval confirmation.
export default function ImpactReceipt({
  familiesServed,
  waterSavedLiters,
  co2AvoidedKg,
  wasteDivertedCount,
  title,
  className = '',
}) {
  const values = { familiesServed, waterSavedLiters, co2AvoidedKg, wasteDivertedCount }
  const tiles = METRICS.filter((m) => values[m.key] !== undefined && values[m.key] !== null)

  return (
    <div className={className}>
      {title && <p className="eyebrow text-carter-blue">{title}</p>}
      <div
        className={`grid grid-cols-2 gap-3 ${LG_COLS[tiles.length] || 'lg:grid-cols-4'} ${
          title ? 'mt-3' : ''
        }`}
      >
        {tiles.map((m) => {
          const Icon = m.icon
          return (
            <div key={m.key} className="rounded-md bg-sky-tint px-4 py-4 text-center">
              <Icon className="mx-auto h-5 w-5 text-blue-dark" />
              <p className="mt-2 font-mono text-[15px] font-medium text-blue-dark">
                {m.format(values[m.key])}
              </p>
              <p className="mt-0.5 text-[9px] uppercase tracking-[0.06em] text-blue-dark/70">
                {m.label}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
