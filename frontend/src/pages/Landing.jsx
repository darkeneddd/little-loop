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

function Stat({ icon: Icon, value, label }) {
  return (
    <div className="rounded-md border-[0.5px] border-hairline bg-white p-4 text-center">
      <Icon className="mx-auto h-5 w-5 text-carter-blue" />
      <p className="mt-2 font-mono text-xl font-medium text-deep-navy">{value}</p>
      <p className="mt-0.5 text-[9px] uppercase tracking-[0.08em] text-text-muted">{label}</p>
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
      <div className="bg-deep-navy text-white">
        <div className="mx-auto max-w-5xl px-4 py-20 text-center">
          <Recycle className="mx-auto h-10 w-10 text-carter-blue" />
          <p className="eyebrow mt-4 text-carter-blue">Carter's circularity program</p>
          <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">LittleLoop</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/70">
            A circular program for baby clothes. Every garment carries a Digital Garment
            Passport that tracks it from first wear through trade-in, AI inspection, and
            resale, so great clothes keep finding new families instead of the landfill.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/marketplace"
              className="inline-flex items-center gap-2 rounded-full bg-carter-blue px-5 py-2.5 text-sm font-medium text-white"
            >
              <ShoppingBag className="h-4 w-4" />
              Shop LittleLoop
            </Link>
            <Link
              to="/scan"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-5 py-2.5 text-sm font-medium text-white"
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
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-sky-tint text-carter-blue">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 font-medium text-deep-navy">{v.title}</h3>
                <p className="mt-2 text-sm text-text-muted">{v.body}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Live stats, from GET /dashboard */}
      <div className="border-t-[0.5px] border-hairline bg-white">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <p className="eyebrow text-center text-carter-blue">Our impact so far</p>
          {error ? (
            <p className="mt-6 text-center text-text-muted">{error}</p>
          ) : !data ? (
            <p className="mt-6 text-center text-text-muted">Loading live stats...</p>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat icon={PackageOpen} value={data.total_garments} label="Garments in program" />
              <Stat icon={Users} value={data.participants} label="Families served" />
              <Stat
                icon={Droplets}
                value={`${data.sustainability.water_saved_liters.toLocaleString()} L`}
                label="Water saved"
              />
              <Stat icon={Cloud} value={`${data.sustainability.co2_avoided_kg} kg`} label="CO₂ avoided" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
