import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Recycle,
  ShoppingBag,
  ScanLine,
  Repeat,
  ShieldCheck,
  Sparkles,
  Droplets,
  Cloud,
  Users,
  PackageOpen,
} from 'lucide-react'
import { getDashboard } from '../api'

// Three-column value props (T17) -- mirrors the actual loop CLAUDE.md
// describes: Purchase -> Wear -> Trade-In -> AI Inspect -> Sanitize -> Resale.
const VALUE_PROPS = [
  {
    icon: Repeat,
    title: 'Trade in, not toss out',
    body: "Outgrown Carter's garments get a second (and third) family instead of the landfill.",
  },
  {
    icon: ShieldCheck,
    title: 'AI-inspected & sanitized',
    body: 'Every returned garment is condition-scored by AI, cleaned, and only resold if it passes.',
  },
  {
    icon: Sparkles,
    title: 'Rewarded for returning',
    body: "Trade in a garment and earn store credit, tracked right on its Digital Garment Passport.",
  },
]

function Stat({ icon: Icon, value, label, color }) {
  return (
    <div className="text-center">
      <span
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${color}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}

export default function Landing() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getDashboard()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {
        if (!cancelled) setError('Live stats are unavailable right now.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div>
      {/* Hero */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white">
        <div className="mx-auto max-w-5xl px-4 py-20 text-center">
          <Recycle className="mx-auto h-12 w-12 text-purple-200" />
          <h1 className="mt-4 text-4xl font-bold sm:text-5xl">Carter's LittleLoop</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-purple-100">
            A circular program for baby clothes. Every garment carries a Digital Garment
            Passport that tracks it from first wear through trade-in, AI inspection, and
            resale, so great clothes keep finding new families instead of the landfill.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/marketplace"
              className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-purple-700 hover:bg-purple-50"
            >
              <ShoppingBag className="h-4 w-4" />
              Shop LittleLoop
            </Link>
            <Link
              to="/scan"
              className="inline-flex items-center gap-2 rounded-md border border-white/60 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
            >
              <ScanLine className="h-4 w-4" />
              Scan a Passport
            </Link>
          </div>
        </div>
      </div>

      {/* Value props */}
      <div className="mx-auto max-w-5xl px-4 py-14">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {VALUE_PROPS.map((v) => {
            const Icon = v.icon
            return (
              <div key={v.title} className="text-center">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 font-semibold text-gray-900">{v.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{v.body}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Live stats, from GET /dashboard */}
      <div className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-center text-lg font-semibold text-gray-900">Our impact so far</h2>
          {error ? (
            <p className="mt-6 text-center text-gray-400">{error}</p>
          ) : !data ? (
            <p className="mt-6 text-center text-gray-400">Loading live stats...</p>
          ) : (
            <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
              <Stat
                icon={PackageOpen}
                value={data.total_garments}
                label="Garments in program"
                color="text-gray-700 bg-gray-100"
              />
              <Stat
                icon={Users}
                value={data.participants}
                label="Families served"
                color="text-blue-700 bg-blue-100"
              />
              <Stat
                icon={Droplets}
                value={`${data.sustainability.water_saved_liters.toLocaleString()} L`}
                label="Water saved"
                color="text-cyan-700 bg-cyan-100"
              />
              <Stat
                icon={Cloud}
                value={`${data.sustainability.co2_avoided_kg} kg`}
                label="CO₂ avoided"
                color="text-emerald-700 bg-emerald-100"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
