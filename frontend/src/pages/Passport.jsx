import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { QrCode, AlertCircle } from 'lucide-react'
import { getGarment } from '../api'
import ImpactReceipt from '../components/ImpactReceipt'

// Event label per PassportCycle.event_type (see backend/models.py). The
// stitched-seam timeline (Design.md) carries event info in cream cards with
// no per-type icon -- just label, date/score, notes, and reward.
const EVENT_LABEL = {
  manufactured: 'Manufactured',
  purchased: 'Purchased',
  returned: 'Returned',
  inspected: 'AI Inspected',
  sanitized: 'Sanitized',
}

// Badge color per Garment.current_status (see backend/models.py) -- a
// lifecycle-status pill, distinct from the condition-grade pill in the hero.
const STATUS_BADGE = {
  active: 'bg-carter-blue',
  returned: 'bg-warning',
  sanitizing: 'bg-blue-dark',
  resale: 'bg-loop-green',
  retired: 'bg-text-muted',
}

// Mirrors assessment.py's GRADE_BANDS thresholds (90/75/60/40/0) so the
// hero's grade badge always agrees with what the Trade-In screen would have
// shown for this same score. Grade badge colors per Design.md's table;
// Poor isn't in that table so it shares Rejected's color (both are "bad").
const GRADE_BANDS = [
  { min: 90, label: 'Excellent', color: 'bg-loop-green' },
  { min: 75, label: 'Good', color: 'bg-green-dark' },
  { min: 60, label: 'Fair', color: 'bg-warning' },
  { min: 40, label: 'Poor', color: 'bg-danger' },
  { min: 0, label: 'Rejected', color: 'bg-danger' },
]

function gradeForScore(score) {
  return GRADE_BANDS.find((b) => score >= b.min) || GRADE_BANDS[GRADE_BANDS.length - 1]
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function Passport() {
  const { id } = useParams()
  const [garment, setGarment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    getGarment(id)
      .then((data) => {
        if (!cancelled) setGarment(data)
      })
      .catch(() => {
        if (!cancelled) setError(`No passport found for "${id}".`)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-text-muted">
        Loading passport...
      </div>
    )
  }

  if (error || !garment) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-danger" />
        <h1 className="mt-3 text-xl font-semibold text-deep-navy">Passport not found</h1>
        <p className="mt-2 text-text-muted">{error}</p>
        <Link
          to="/scan"
          className="mt-4 inline-block rounded-full bg-carter-blue px-5 py-2 text-sm font-medium text-white"
        >
          Try another scan
        </Link>
      </div>
    )
  }

  // "Families served" -- each purchase event represents a new family taking
  // ownership of the garment.
  const familiesServed = garment.cycles.filter((c) => c.event_type === 'purchased').length
  const statusBadge = STATUS_BADGE[garment.current_status] || 'bg-text-muted'
  const grade = gradeForScore(garment.current_condition_score ?? 0)
  const sustainability = garment.sustainability

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {/* Hero */}
      <div className="overflow-hidden rounded-xl border-[0.5px] border-hairline bg-white">
        <div className="hero-crosshatch px-6 py-8 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow text-carter-blue">Digital Garment Passport</p>
              <h1 className="mt-1 text-3xl font-semibold">{garment.product_name}</h1>
              <p className="mt-1 text-white/70">
                Size {garment.size} &middot; SKU {garment.sku} &middot; Manufactured{' '}
                {formatDate(garment.manufactured_at)}
              </p>
            </div>
            <span
              className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold capitalize text-white ${statusBadge}`}
            >
              {garment.current_status}
            </span>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <span className="rounded-full border border-white/15 bg-white/10 px-4 py-1.5 font-mono text-2xl font-medium text-white">
              {garment.current_condition_score}
            </span>
            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold text-white ${grade.color}`}>
              {grade.label}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-[1fr_auto]">
        {/* Lifecycle timeline -- stitched seam, not a generic dot-connector. */}
        <div>
          <p className="eyebrow text-carter-blue">Lifecycle Timeline</p>
          <ol className="relative mt-4 pl-6">
            <span className="timeline-thread absolute bottom-0 left-[7px] top-0 w-[2px]" />
            <div className="space-y-4">
              {garment.cycles.map((cycle) => {
                const label = EVENT_LABEL[cycle.event_type] || cycle.event_type
                const isGreen = cycle.event_type === 'sanitized'
                return (
                  <div key={cycle.id} className="relative">
                    <span
                      className={`absolute -left-[22px] top-1 h-2.5 w-2.5 rounded-full border-2 ${
                        isGreen ? 'border-loop-green bg-loop-green' : 'border-carter-blue bg-carter-blue'
                      }`}
                    />
                    <div className="rounded-[10px] border-[0.5px] border-hairline bg-cream px-3 py-2">
                      <p className="text-[11px] font-medium text-deep-navy">{label}</p>
                      <p className="font-mono text-[10px] text-text-muted">
                        {formatDate(cycle.timestamp)}
                        {cycle.condition_score_at_event != null &&
                          ` · score ${cycle.condition_score_at_event}`}
                      </p>
                      {cycle.notes && (
                        <p className="mt-1 text-[11px] text-text-muted">{cycle.notes}</p>
                      )}
                      {cycle.rewards.length > 0 && (
                        <p className="mt-1 text-[11px] font-medium text-carter-blue">
                          Reward:{' '}
                          {cycle.rewards.map((r) => `${r.reward_type} ($${r.value})`).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </ol>

          {/* Impact metrics -- below the timeline per Design.md */}
          <div className="mt-8">
            <ImpactReceipt
              title="Impact so far"
              familiesServed={familiesServed}
              waterSavedLiters={sustainability.water_saved_liters}
              co2AvoidedKg={sustainability.co2_avoided_kg}
              wasteDivertedCount={sustainability.cycles_completed}
            />
          </div>
        </div>

        {/* QR code -- below impact chips per Design.md (stacks below the
            timeline column on narrow screens, sits beside it on wide ones). */}
        <div className="flex flex-col items-center self-start rounded-xl border-[0.5px] border-hairline bg-white p-4 text-center">
          <QrCode className="h-4 w-4 text-carter-blue" />
          <img
            src={`/static/qr/${garment.id}.png`}
            alt="Garment passport QR code"
            className="mt-2 h-32 w-32"
          />
          <p className="mt-2 max-w-[8rem] break-all font-mono text-[10px] text-text-muted">
            {garment.id}
          </p>
        </div>
      </div>
    </div>
  )
}
