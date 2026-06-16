import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag, SlidersHorizontal, CheckCircle2, AlertCircle } from 'lucide-react'
import { listGarments, purchaseGarment } from '../api'

const SIZES = ['Newborn', '0-3M', '3-6M', '6-9M', '9-12M', '12-18M', '18-24M', '2T', '3T']

// Grade label derived from condition score -- mirrors the thresholds used
// for the Passport screen's condition-score color, just bucketed into the
// same grade wording /assess returns (Excellent/Good/Fair/Poor).
function gradeFor(score) {
  if (score >= 90) return { label: 'Excellent', color: 'text-green-700 bg-green-100' }
  if (score >= 75) return { label: 'Good', color: 'text-blue-700 bg-blue-100' }
  if (score >= 60) return { label: 'Fair', color: 'text-amber-700 bg-amber-100' }
  return { label: 'Poor', color: 'text-red-700 bg-red-100' }
}

const emptyFilters = { size: '', condition_min: '', price_max: '' }

export default function Marketplace() {
  const [filters, setFilters] = useState(emptyFilters)
  const [garments, setGarments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [purchasing, setPurchasing] = useState(null) // garment id mid-purchase
  const [purchased, setPurchased] = useState(null) // last successfully purchased garment

  function load() {
    setLoading(true)
    setError('')
    listGarments({
      size: filters.size || undefined,
      condition_min: filters.condition_min === '' ? undefined : Number(filters.condition_min),
      price_max: filters.price_max === '' ? undefined : Number(filters.price_max),
    })
      .then(setGarments)
      .catch(() => setError('Could not load the marketplace. Try again.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  async function handlePurchase(id) {
    setPurchasing(id)
    setError('')
    try {
      const updated = await purchaseGarment(id)
      setGarments((prev) => prev.filter((g) => g.id !== id))
      setPurchased(updated)
    } catch (err) {
      setError('Purchase failed. The garment may no longer be available.')
    } finally {
      setPurchasing(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center gap-3">
        <ShoppingBag className="h-7 w-7 text-purple-600" />
        <h1 className="text-2xl font-semibold text-gray-900">Marketplace</h1>
      </div>
      <p className="mt-1 text-gray-600">
        Pre-loved Carter's garments, inspected and sanitized, ready for their next family.
      </p>

      {purchased && (
        <div className="mt-6 flex items-start gap-3 rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
          <div>
            <p className="font-medium">
              You purchased {purchased.product_name} (size {purchased.size})!
            </p>
            <p className="mt-0.5 text-green-700">
              Its passport has been updated.{' '}
              <Link to={`/passport/${purchased.id}`} className="font-semibold underline">
                View passport
              </Link>
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-6 flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-[16rem_1fr]">
        {/* Filter sidebar */}
        <aside className="self-start rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </div>

          <div className="mt-4">
            <label className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Size
            </label>
            <select
              value={filters.size}
              onChange={(e) => setFilters((f) => ({ ...f, size: e.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All sizes</option>
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4">
            <label className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Min. condition score
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={filters.condition_min}
              onChange={(e) => setFilters((f) => ({ ...f, condition_min: e.target.value }))}
              placeholder="e.g. 70"
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="mt-4">
            <label className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Max. price ($)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={filters.price_max}
              onChange={(e) => setFilters((f) => ({ ...f, price_max: e.target.value }))}
              placeholder="e.g. 10"
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <button
            type="button"
            onClick={() => setFilters(emptyFilters)}
            className="mt-5 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Clear filters
          </button>
        </aside>

        {/* Resale grid */}
        <div>
          {loading ? (
            <p className="py-16 text-center text-gray-500">Loading marketplace...</p>
          ) : garments.length === 0 ? (
            <p className="py-16 text-center text-gray-500">
              No garments match these filters. Try widening them.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {garments.map((g) => {
                const grade = gradeFor(g.current_condition_score)
                return (
                  <div
                    key={g.id}
                    className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200"
                  >
                    <Link to={`/passport/${g.id}`}>
                      <img
                        src={g.thumbnail_url}
                        alt={g.product_name}
                        className="h-44 w-full object-cover"
                      />
                    </Link>
                    <div className="p-4">
                      <Link
                        to={`/passport/${g.id}`}
                        className="font-semibold text-gray-900 hover:text-purple-700"
                      >
                        {g.product_name}
                      </Link>
                      <p className="mt-0.5 text-sm text-gray-500">Size {g.size}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${grade.color}`}
                        >
                          {grade.label}
                        </span>
                        <span className="text-lg font-bold text-gray-900">
                          ${g.price?.toFixed(2)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePurchase(g.id)}
                        disabled={purchasing === g.id}
                        className="mt-3 w-full rounded-md bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                      >
                        {purchasing === g.id ? 'Purchasing...' : 'Purchase'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
