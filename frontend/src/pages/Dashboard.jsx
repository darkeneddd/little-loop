import { useEffect, useState } from 'react'
import { LayoutDashboard, PackageOpen, Recycle, Users, DollarSign, Award, AlertCircle } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { getDashboard } from '../api'

// KPI tiles, in the order TODO.md's T14 lists them (returned, resold,
// participants, revenue) -- a 4-column grid per Design.md, so
// total_garments (program-size context) moves to the page subtitle instead
// of a 5th tile.
function kpiCards(data) {
  return [
    { key: 'returned', label: 'Returned', value: data.returned, icon: PackageOpen },
    { key: 'resold', label: 'Resold', value: data.resold, icon: Recycle },
    { key: 'participants', label: 'Families Served', value: data.participants, icon: Users },
    {
      key: 'revenue_generated',
      label: 'Revenue Generated',
      value: `$${data.revenue_generated.toFixed(2)}`,
      icon: DollarSign,
    },
  ]
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getDashboard()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load dashboard data.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center text-text-muted">
        Loading dashboard...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-danger" />
        <p className="mt-2 text-text-muted">{error}</p>
      </div>
    )
  }

  // Recharts wants an array, not the {size: count} dict /dashboard returns.
  const returnsBySizeData = Object.entries(data.returns_by_size).map(([size, count]) => ({
    size,
    count,
  }))
  const maxScore = 100

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center gap-3">
        <LayoutDashboard className="h-6 w-6 text-carter-blue" />
        <h1 className="text-2xl font-semibold text-deep-navy">Corporate Dashboard</h1>
      </div>
      <p className="mt-1 text-text-muted">
        {data.total_garments} garments in the program &middot; circularity and sustainability
        impact, updated live.
      </p>

      {/* KPI cards */}
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpiCards(data).map((card) => {
          const Icon = card.icon
          return (
            <div key={card.key} className="rounded-md border-[0.5px] border-hairline bg-white p-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sky-tint text-carter-blue">
                <Icon className="h-5 w-5" />
              </span>
              <p className="mt-3 font-mono text-xl font-semibold text-deep-navy">{card.value}</p>
              <p className="text-[9px] uppercase tracking-[0.08em] text-text-muted">{card.label}</p>
            </div>
          )
        })}
      </div>

      {/* Sustainability totals -- full-width Deep Navy banner */}
      <div className="mt-8 rounded-md bg-deep-navy p-5">
        <div className="flex items-center gap-2 text-white">
          <Award className="h-4 w-4 text-carter-blue" />
          <h2 className="text-sm font-semibold">Sustainability Impact</h2>
        </div>
        <p className="mt-1 text-[10px] text-white/40">
          Based on fixed LCA proxies: 2,700 L water saved and 2 kg CO₂ avoided per completed
          cycle.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="font-mono text-lg font-medium text-carter-blue">
              {data.sustainability.cycles_completed}
            </p>
            <p className="text-[9px] uppercase tracking-[0.08em] text-white/40">Cycles completed</p>
          </div>
          <div>
            <p className="font-mono text-lg font-medium text-carter-blue">
              {data.sustainability.water_saved_liters.toLocaleString()} L
            </p>
            <p className="text-[9px] uppercase tracking-[0.08em] text-white/40">Water saved</p>
          </div>
          <div>
            <p className="font-mono text-lg font-medium text-carter-blue">
              {data.sustainability.co2_avoided_kg} kg
            </p>
            <p className="text-[9px] uppercase tracking-[0.08em] text-white/40">CO₂ avoided</p>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Top durable products table */}
        <div className="rounded-md border-[0.5px] border-hairline bg-white p-6">
          <h2 className="text-sm font-semibold text-deep-navy">Most Durable Products</h2>
          <p className="mt-1 text-[10px] text-text-muted">
            Ranked by completed cycles, then current condition score.
          </p>
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="text-[9px] uppercase tracking-[0.08em] text-text-muted">
                <th className="pb-2">Product</th>
                <th className="pb-2 text-right">Cycles</th>
                <th className="pb-2 text-right">Condition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {data.top_durable_garments.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-text-muted">
                    No completed cycles yet.
                  </td>
                </tr>
              ) : (
                data.top_durable_garments.map((g) => (
                  <tr key={g.id}>
                    <td className="py-2">
                      <p className="font-medium text-deep-navy">{g.product_name}</p>
                      <p className="text-[10px] text-text-muted">
                        SKU {g.sku} &middot; {g.size}
                      </p>
                    </td>
                    <td className="py-2 text-right font-mono text-text-muted">
                      {g.cycles_completed}
                    </td>
                    <td className="py-2 pl-4">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1 w-16 rounded-full bg-sky-tint">
                          <div
                            className="h-1 rounded-full bg-carter-blue"
                            style={{
                              width: `${((g.current_condition_score || 0) / maxScore) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="font-mono text-xs font-medium text-deep-navy">
                          {g.current_condition_score}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Returns by size */}
        <div className="rounded-md border-[0.5px] border-hairline bg-white p-6">
          <h2 className="text-sm font-semibold text-deep-navy">Returns by Size</h2>
          <p className="mt-1 text-[10px] text-text-muted">Trade-in volume across each garment size.</p>
          <div className="mt-4 h-64">
            {returnsBySizeData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-text-muted">
                No returns recorded yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={returnsBySizeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3F6FD" />
                  <XAxis dataKey="size" tick={{ fontSize: 11, fill: '#6B7A8D' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6B7A8D' }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#00ABE1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
