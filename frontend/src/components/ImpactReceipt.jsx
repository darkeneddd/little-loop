import { Users, Droplets, Cloud, Recycle } from 'lucide-react'

// One tile definition per metric -- shared across every consumer so the
// "families served / water saved / CO2 avoided / waste diverted" foursome
// (T16) always reads the same way, whether it's embedded in the Passport's
// impact section or the Trade-In approval card. A tile only renders if its
// prop is actually passed (undefined skips it), so callers that don't have
// all four numbers handy can still use this component.
const METRICS = [
  {
    key: 'familiesServed',
    icon: Users,
    label: 'Families served',
    tile: 'bg-blue-50',
    text: 'text-blue-700',
    icon_: 'text-blue-600',
    format: (v) => v,
  },
  {
    key: 'waterSavedLiters',
    icon: Droplets,
    label: 'Water saved',
    tile: 'bg-cyan-50',
    text: 'text-cyan-700',
    icon_: 'text-cyan-600',
    format: (v) => `${v.toLocaleString()} L`,
  },
  {
    key: 'co2AvoidedKg',
    icon: Cloud,
    label: 'CO₂ avoided',
    tile: 'bg-emerald-50',
    text: 'text-emerald-700',
    icon_: 'text-emerald-600',
    format: (v) => `${v} kg`,
  },
  {
    key: 'wasteDivertedCount',
    icon: Recycle,
    label: 'Garments diverted from landfill',
    tile: 'bg-violet-50',
    text: 'text-violet-700',
    icon_: 'text-violet-600',
    format: (v) => v,
  },
]

// Tailwind needs literal class strings to scan for -- can't interpolate
// `lg:grid-cols-${n}`, so look the column count up instead.
const LG_COLS = { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4' }

// Reusable "impact receipt" -- big numbers + Lucide icons, meant to feel
// like a shareable card (T16). Used on the Passport screen's impact section
// and the Employee Trade-In approval confirmation.
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
      {title && <p className="text-sm font-semibold text-gray-900">{title}</p>}
      <div
        className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${LG_COLS[tiles.length] || 'lg:grid-cols-4'} ${
          title ? 'mt-3' : ''
        }`}
      >
        {tiles.map((m) => {
          const Icon = m.icon
          return (
            <div key={m.key} className={`flex items-center gap-3 rounded-xl px-4 py-4 ${m.tile}`}>
              <Icon className={`h-8 w-8 flex-shrink-0 ${m.icon_}`} />
              <div>
                <p className={`text-2xl font-bold ${m.text}`}>{m.format(values[m.key])}</p>
                <p className={`text-xs ${m.icon_}`}>{m.label}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
