import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Factory,
  ShoppingBag,
  PackageOpen,
  ClipboardCheck,
  Sparkles,
  Tag,
  Users,
  Droplets,
  Cloud,
  QrCode,
  AlertCircle,
} from 'lucide-react'
import { getGarment } from '../api'

// Icon + label per PassportCycle.event_type (see backend/models.py).
const EVENT_META = {
  manufactured: { icon: Factory, label: 'Manufactured', color: 'text-gray-500 bg-gray-100' },
  purchased: { icon: ShoppingBag, label: 'Purchased', color: 'text-blue-600 bg-blue-100' },
  returned: { icon: PackageOpen, label: 'Returned', color: 'text-amber-600 bg-amber-100' },
  inspected: { icon: ClipboardCheck, label: 'AI Inspected', color: 'text-purple-600 bg-purple-100' },
  sanitized: { icon: Sparkles, label: 'Sanitized', color: 'text-teal-600 bg-teal-100' },
  resold: { icon: Tag, label: 'Resold', color: 'text-green-600 bg-green-100' },
}

// Badge color per Garment.current_status (see backend/models.py).
const STATUS_BADGE = {
  active: 'bg-blue-100 text-blue-700',
  returned: 'bg-amber-100 text-amber-700',
  sanitizing: 'bg-purple-100 text-purple-700',
  resale: 'bg-green-100 text-green-700',
  retired: 'bg-gray-200 text-gray-600',
}

function conditionColor(score) {
  if (score >= 85) return 'text-green-600'
  if (score >= 60) return 'text-amber-600'
  return 'text-red-600'
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
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-gray-500">
        Loading passport...
      </div>
    )
  }

  if (error || !garment) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
        <h1 className="mt-3 text-xl font-semibold text-gray-900">Passport not found</h1>
        <p className="mt-2 text-gray-600">{error}</p>
        <Link
          to="/scan"
          className="mt-4 inline-block rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
        >
          Try another scan
        </Link>
      </div>
    )
  }

  // "Families served" -- each purchase event represents a new family taking
  // ownership of the garment.
  const familiesServed = garment.cycles.filter((c) => c.event_type === 'purchased').length
  const statusBadge = STATUS_BADGE[garment.current_status] || 'bg-gray-100 text-gray-600'
  const sustainability = garment.sustainability

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {/* Hero */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 px-6 py-8 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-purple-100">
                Digital Garment Passport
              </p>
              <h1 className="mt-1 text-3xl font-bold">{garment.product_name}</h1>
              <p className="mt-1 text-purple-100">
                Size {garment.size} &middot; SKU {garment.sku}
              </p>
            </div>
            <span
              className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold capitalize ${statusBadge}`}
            >
              {garment.current_status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-b border-gray-100 px-6 py-6 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Condition Score</p>
            <p className={`mt-1 text-3xl font-bold ${conditionColor(garment.current_condition_score)}`}>
              {garment.current_condition_score}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Manufactured</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {formatDate(garment.manufactured_at)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Cycles Completed</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {sustainability.cycles_completed}
            </p>
          </div>
        </div>

        {/* Impact metrics */}
        <div className="grid grid-cols-1 gap-4 px-6 py-6 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl bg-blue-50 px-4 py-4">
            <Users className="h-8 w-8 flex-shrink-0 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-blue-700">{familiesServed}</p>
              <p className="text-xs text-blue-600">Families served</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-cyan-50 px-4 py-4">
            <Droplets className="h-8 w-8 flex-shrink-0 text-cyan-600" />
            <div>
              <p className="text-2xl font-bold text-cyan-700">
                {sustainability.water_saved_liters.toLocaleString()} L
              </p>
              <p className="text-xs text-cyan-600">Water saved</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-4">
            <Cloud className="h-8 w-8 flex-shrink-0 text-emerald-600" />
            <div>
              <p className="text-2xl font-bold text-emerald-700">
                {sustainability.co2_avoided_kg} kg
              </p>
              <p className="text-xs text-emerald-600">CO₂ avoided</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-[1fr_auto]">
        {/* Lifecycle timeline */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Lifecycle Timeline</h2>
          <ol className="mt-4 space-y-6 border-l border-gray-200 pl-6">
            {garment.cycles.map((cycle) => {
              const meta = EVENT_META[cycle.event_type] || {
                icon: Tag,
                label: cycle.event_type,
                color: 'text-gray-500 bg-gray-100',
              }
              const Icon = meta.icon
              return (
                <li key={cycle.id} className="relative">
                  <span
                    className={`absolute -left-[34px] flex h-7 w-7 items-center justify-center rounded-full ${meta.color}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="text-sm font-semibold text-gray-900">{meta.label}</p>
                  <p className="text-xs text-gray-400">{formatDate(cycle.timestamp)}</p>
                  {cycle.condition_score_at_event != null && (
                    <p className="mt-1 text-xs text-gray-600">
                      Condition score: {cycle.condition_score_at_event}
                    </p>
                  )}
                  {cycle.notes && <p className="mt-1 text-xs text-gray-600">{cycle.notes}</p>}
                  {cycle.rewards.length > 0 && (
                    <p className="mt-1 text-xs font-medium text-purple-600">
                      Reward: {cycle.rewards.map((r) => `${r.reward_type} ($${r.value})`).join(', ')}
                    </p>
                  )}
                </li>
              )
            })}
          </ol>
        </div>

        {/* QR code */}
        <div className="flex flex-col items-center self-start rounded-xl bg-white p-4 text-center shadow-sm ring-1 ring-gray-200">
          <QrCode className="h-4 w-4 text-gray-400" />
          <img
            src={`/static/qr/${garment.id}.png`}
            alt="Garment passport QR code"
            className="mt-2 h-32 w-32"
          />
          <p className="mt-2 max-w-[8rem] break-all text-[10px] text-gray-400">{garment.id}</p>
        </div>
      </div>
    </div>
  )
}
