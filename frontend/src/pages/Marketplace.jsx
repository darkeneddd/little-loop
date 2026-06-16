import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag, SlidersHorizontal, CheckCircle2, AlertCircle } from 'lucide-react'
import { listGarments, purchaseGarment } from '../api'

const SIZES = ['Newborn', '0-3M', '3-6M', '6-9M', '9-12M', '12-18M', '18-24M', '2T', '3T']

// Grade label derived from condition score -- mirrors assessment.py's
// GRADE_BANDS thresholds (90/75/60/40/0) and Design.md's Grade badge colors.
// Poor isn't in that table, so it shares Rejected's color (both "bad").
function gradeFor(score) {
  if (score >= 90) return { label: 'Excellent', color: 'bg-loop-green' }
  if (score >= 75) return { label: 'Good', color: 'bg-green-dark' }
  if (score >= 60) return { label: 'Fair', color: 'bg-warning' }
  return { label: 'Poor', color: 'bg-danger' }
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShoppingBag className="h-6 w-6 text-carter-blue" />
          <h1 className="text-2xl font-semibold text-deep-navy">Marketplace</h1>
        </div>
        {!loading && (
          <p className="text-sm text-text-muted">
            {garments.length} garment{garments.length === 1 ? '' : 's'}
          </p>
        )}
      </div>
      <p className="mt-1 text-text-muted">
        Pre-loved Carter's garments, inspected and sanitized, ready for their next family.
      </p>

      {purchased && (
        <div className="mt-6 flex items-start gap-3 rounded-md bg-mint-tint px-4 py-3 text-sm text-green-dark">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-loop-green" />
          <div>
            <p className="font-medium">
              You purchased {purchased.product_name} (size {purchased.size})!
            </p>
            <p className="mt-0.5">
              Its passport has been updated.{' '}
              <Link to={`/passport/${purchased.id}`} className="font-semibold underline">
                View passport
              </Link>
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-6 flex items-center gap-2 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-[16rem_1fr]">
        {/* Filter sidebar */}
        <aside className="self-start rounded-md border-[0.5px] border-hairline bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-deep-navy">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted">
              Size
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setFilters((f) => ({ ...f, size: '' }))}
                className={`rounded-full border-[1.5px] px-2.5 py-1 text-xs font-medium ${
                  filters.size === ''
                    ? 'border-carter-blue bg-sky-tint text-blue-dark'
                    : 'border-hairline text-text-muted'
                }`}
              >
                All
              </button>
              {SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, size: f.size === s ? '' : s }))}
                  className={`rounded-full border-[1.5px] px-2.5 py-1 text-xs font-medium ${
                    filters.size === s
                      ? 'border-carter-blue bg-sky-tint text-blue-dark'
                      : 'border-hairline text-text-muted'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <label className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted">
              Min. condition score
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={filters.condition_min}
              onChange={(e) => setFilters((f) => ({ ...f, condition_min: e.target.value }))}
              placeholder="e.g. 70"
              className="mt-1 w-full rounded-md border border-hairline px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-carter-blue"
            />
          </div>

          <div className="mt-4">
            <label className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted">
              Max. price ($)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={filters.price_max}
              onChange={(e) => setFilters((f) => ({ ...f, price_max: e.target.value }))}
              placeholder="e.g. 10"
              className="mt-1 w-full rounded-md border border-hairline px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-carter-blue"
            />
          </div>

          <button
            type="button"
            onClick={() => setFilters(emptyFilters)}
            className="mt-5 w-full rounded-full border border-hairline px-3 py-1.5 text-sm font-medium text-deep-navy"
          >
            Clear filters
          </button>
        </aside>

        {/* Resale grid */}
        <div>
          {loading ? (
            <p className="py-16 text-center text-text-muted">Loading marketplace...</p>
          ) : garments.length === 0 ? (
            <p className="py-16 text-center text-text-muted">
              No garments match these filters. Try widening them.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {garments.map((g) => {
                const grade = gradeFor(g.current_condition_score)
                return (
                  <div
                    key={g.id}
                    className="overflow-hidden rounded-lg border-[0.5px] border-hairline bg-white"
                  >
                    <Link to={`/passport/${g.id}`} className="relative block">
                      <img
                        src={g.thumbnail_url}
                        alt={g.product_name}
                        className="h-44 w-full object-cover"
                      />
                      <span
                        className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ${grade.color}`}
                      >
                        {grade.label}
                      </span>
                    </Link>
                    <div className="p-4">
                      <Link to={`/passport/${g.id}`} className="font-medium text-deep-navy">
                        {g.product_name}
                      </Link>
                      <p className="mt-0.5 text-sm text-text-muted">Size {g.size}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <Link
                          to={`/passport/${g.id}`}
                          className="rounded-md bg-carter-blue px-2.5 py-1 text-[10px] font-medium text-white"
                        >
                          View
                        </Link>
                        <span className="font-mono text-lg font-medium text-deep-navy">
                          ${g.price?.toFixed(2)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePurchase(g.id)}
                        disabled={purchasing === g.id}
                        className="mt-3 w-full rounded-full bg-carter-blue px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
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
