import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  PackageOpen,
  Recycle,
  Users,
  DollarSign,
  Droplets,
  Cloud,
  Award,
  AlertCircle,
} from 'lucide-react'
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
// participants, revenue), with total garments prepended for program-size
// context.
function kpiCards(data) {
  return [
    {
      key: 'total_garments',
      label: 'Garments in Program',
      value: data.total_garments,
      icon: LayoutDashboard,
      color: 'text-gray-700 bg-gray-100',
    },
    {
      key: 'returned',
      label: 'Returned',
      value: data.returned,
      icon: PackageOpen,
      color: 'text-amber-700 bg-amber-100',
    },
    {
      key: 'resold',
      label: 'Resold',
      value: data.resold,
      icon: Recycle,
      color: 'text-green-700 bg-green-100',
    },
    {
      key: 'participants',
      label: 'Families Served',
      value: data.participants,
      icon: Users,
      color: 'text-blue-700 bg-blue-100',
    },
    {
      key: 'revenue_generated',
      label: 'Revenue Generated',
      value: `$${data.revenue_generated.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-purple-700 bg-purple-100',
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
      <div className="mx-auto max-w-5xl px-4 py-16 text-center text-gray-500">
        Loading dashboard...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
        <p className="mt-2 text-gray-600">{error}</p>
      </div>
    )
  }

  // Recharts wants an array, not the {size: count} dict /dashboard returns.
  const returnsBySizeData = Object.entries(data.returns_by_size).map(([size, count]) => ({
    size,
    count,
  }))

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center gap-3">
        <LayoutDashboard className="h-7 w-7 text-purple-600" />
        <h1 className="text-2xl font-semibold text-gray-900">Corporate Dashboard</h1>
      </div>
      <p className="mt-1 text-gray-600">
        Program-wide circularity and sustainability impact, updated live.
      </p>

      {/* KPI cards */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {kpiCards(data).map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.key}
              className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200"
            >
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${card.color}`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <p className="mt-3 text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-500">{card.label}</p>
            </div>
          )
        })}
      </div>

      {/* Sustainability totals */}
      <div className="mt-8 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Sustainability Impact</h2>
        <p className="mt-1 text-xs text-gray-400">
          Based on fixed LCA proxies: 2,700 L water saved and 2 kg CO₂ avoided per completed
          cycle.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-4">
            <Award className="h-8 w-8 flex-shrink-0 text-gray-500" />
            <div>
              <p className="text-2xl font-bold text-gray-700">
                {data.sustainability.cycles_completed}
              </p>
              <p className="text-xs text-gray-500">Cycles completed</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-cyan-50 px-4 py-4">
            <Droplets className="h-8 w-8 flex-shrink-0 text-cyan-600" />
            <div>
              <p className="text-2xl font-bold text-cyan-700">
                {data.sustainability.water_saved_liters.toLocaleString()} L
              </p>
              <p className="text-xs text-cyan-600">Water saved</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-4">
            <Cloud className="h-8 w-8 flex-shrink-0 text-emerald-600" />
            <div>
              <p className="text-2xl font-bold text-emerald-700">
                {data.sustainability.co2_avoided_kg} kg
              </p>
              <p className="text-xs text-emerald-600">CO₂ avoided</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Top durable products table */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Most Durable Products</h2>
          <p className="mt-1 text-xs text-gray-400">
            Ranked by completed cycles, then current condition score.
          </p>
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-gray-400">
                <th className="pb-2">Product</th>
                <th className="pb-2">Size</th>
                <th className="pb-2 text-right">Cycles</th>
                <th className="pb-2 text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.top_durable_garments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-400">
                    No completed cycles yet.
                  </td>
                </tr>
              ) : (
                data.top_durable_garments.map((g) => (
                  <tr key={g.id}>
                    <td className="py-2">
                      <p className="font-medium text-gray-900">{g.product_name}</p>
                      <p className="text-xs text-gray-400">SKU {g.sku}</p>
                    </td>
                    <td className="py-2 text-gray-600">{g.size}</td>
                    <td className="py-2 text-right text-gray-600">{g.cycles_completed}</td>
                    <td className="py-2 text-right font-semibold text-gray-900">
                      {g.current_condition_score}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Returns by size */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Returns by Size</h2>
          <p className="mt-1 text-xs text-gray-400">
            Trade-in volume across each garment size.
          </p>
          <div className="mt-4 h-64">
            {returnsBySizeData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-gray-400">
                No returns recorded yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={returnsBySizeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="size" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#9333ea" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
