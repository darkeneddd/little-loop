import { useEffect, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import {
  ClipboardCheck,
  ScanLine,
  Upload,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Gift,
  Droplets,
  Cloud,
  RefreshCw,
} from 'lucide-react'
import { getGarment, assessImage, submitTradeIn } from '../api'

const QR_REGION_ID = 'trade-in-qr-reader'

// Mirrors Passport.jsx's status badge map -- duplicated rather than shared
// since each page still owns its own small color maps (see also
// Marketplace.jsx's gradeFor).
const STATUS_BADGE = {
  active: 'bg-blue-100 text-blue-700',
  returned: 'bg-amber-100 text-amber-700',
  sanitizing: 'bg-purple-100 text-purple-700',
  resale: 'bg-green-100 text-green-700',
  retired: 'bg-gray-200 text-gray-600',
}

// Mirrors assessment.py's GRADE_BANDS wording.
const GRADE_BADGE = {
  Excellent: 'bg-green-100 text-green-700',
  Good: 'bg-blue-100 text-blue-700',
  Fair: 'bg-amber-100 text-amber-700',
  Poor: 'bg-orange-100 text-orange-700',
  Rejected: 'bg-red-100 text-red-700',
}

// QR payloads may be a bare garment ID or a full passport URL.
function extractGarmentId(text) {
  const trimmed = text.trim()
  const match = trimmed.match(/passport\/([^/?#]+)/)
  return match ? match[1] : trimmed
}

export default function TradeIn() {
  const [manualId, setManualId] = useState('')
  const [scanning, setScanning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [garment, setGarment] = useState(null)

  const [imagePreview, setImagePreview] = useState('')
  const [imageBase64, setImageBase64] = useState('')
  const [assessing, setAssessing] = useState(false)
  const [assessError, setAssessError] = useState('')
  const [assessment, setAssessment] = useState(null)

  const [deciding, setDeciding] = useState(null) // 'approve' | 'reject' | null
  const [rejectReason, setRejectReason] = useState('')
  const [decisionError, setDecisionError] = useState('')
  const [decisionResult, setDecisionResult] = useState(null) // { decision, garment }

  // QR scanner lifecycle -- same start/teardown pattern as PassportScanner,
  // but on a decode we load the garment inline instead of navigating away.
  useEffect(() => {
    if (!scanning) return
    const scanner = new Html5Qrcode(QR_REGION_ID)
    let cancelled = false

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 220 },
        (decodedText) => {
          if (cancelled) return
          cancelled = true
          setScanning(false)
          loadGarment(extractGarmentId(decodedText))
        },
        () => {
          // Per-frame "no QR found" callback -- nothing to surface.
        },
      )
      .catch((err) => {
        setLoadError(`Could not start camera: ${err?.message || err}`)
        setScanning(false)
      })

    return () => {
      cancelled = true
      scanner
        .stop()
        .then(() => scanner.clear())
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning])

  async function loadGarment(id) {
    const garmentId = id.trim()
    if (!garmentId) {
      setLoadError('Enter a garment ID.')
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      const data = await getGarment(garmentId)
      setGarment(data)
    } catch (err) {
      setLoadError(`No garment found for "${garmentId}".`)
    } finally {
      setLoading(false)
    }
  }

  function handleManualSubmit(e) {
    e.preventDefault()
    loadGarment(manualId)
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAssessment(null)
    setAssessError('')
    setDecisionResult(null)
    setDecisionError('')
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result)
      setImagePreview(dataUrl)
      // Backend only ever hashes/stores this string -- strip the data URL
      // prefix so the field holds plain base64, matching the API's naming.
      setImageBase64(dataUrl.split(',')[1] || dataUrl)
    }
    reader.readAsDataURL(file)
  }

  async function handleRunAssessment() {
    if (!imageBase64) return
    setAssessing(true)
    setAssessError('')
    try {
      const result = await assessImage(imageBase64)
      setAssessment(result)
    } catch (err) {
      setAssessError('Assessment failed. Try again.')
    } finally {
      setAssessing(false)
    }
  }

  async function handleDecision(decision) {
    if (!garment || !assessment) return
    setDeciding(decision)
    setDecisionError('')
    try {
      const updated = await submitTradeIn({
        garment_id: garment.id,
        assessment_result: assessment,
        employee_decision: decision,
        ...(decision === 'reject' && rejectReason ? { reason: rejectReason } : {}),
      })
      setDecisionResult({ decision, garment: updated })
    } catch (err) {
      setDecisionError('Could not submit the trade-in decision. Try again.')
    } finally {
      setDeciding(null)
    }
  }

  function handleReset() {
    setManualId('')
    setLoadError('')
    setGarment(null)
    setImagePreview('')
    setImageBase64('')
    setAssessment(null)
    setAssessError('')
    setDeciding(null)
    setRejectReason('')
    setDecisionError('')
    setDecisionResult(null)
  }

  const gradeBadge = assessment ? GRADE_BADGE[assessment.grade] || 'bg-gray-100 text-gray-600' : ''

  // Newest reward / rejection note from the post-decision garment -- same
  // per-cycle fields the Passport timeline already displays.
  const latestReward = decisionResult?.garment.cycles.flatMap((c) => c.rewards).slice(-1)[0]
  const rejectionNote = decisionResult?.garment.cycles.slice(-1)[0]?.notes

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="h-7 w-7 text-purple-600" />
        <h1 className="text-2xl font-semibold text-gray-900">Employee Trade-In</h1>
      </div>
      <p className="mt-1 text-gray-600">
        Scan a garment, run the AI condition assessment, and approve or reject the trade-in.
      </p>

      {!garment ? (
        <div className="mt-8 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              placeholder="Garment ID (e.g. a1b2c3...)"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load Garment'}
            </button>
          </form>

          <div className="mt-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs uppercase tracking-wide text-gray-400">or</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="mt-5 text-center">
            {!scanning ? (
              <button
                type="button"
                onClick={() => {
                  setLoadError('')
                  setScanning(true)
                }}
                className="inline-flex items-center gap-2 rounded-md border border-purple-600 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50"
              >
                <ScanLine className="h-4 w-4" />
                Scan QR Code
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setScanning(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel Scan
              </button>
            )}
          </div>

          {scanning && (
            <div id={QR_REGION_ID} className="mx-auto mt-4 max-w-sm overflow-hidden rounded-md" />
          )}

          {loadError && (
            <div className="mt-5 flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {loadError}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Garment summary */}
          <div className="mt-8 flex items-start justify-between gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <div>
              <p className="font-semibold text-gray-900">{garment.product_name}</p>
              <p className="text-sm text-gray-500">
                Size {garment.size} &middot; SKU {garment.sku}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                    STATUS_BADGE[garment.current_status] || 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {garment.current_status}
                </span>
                <span className="text-xs text-gray-500">
                  Current score: {garment.current_condition_score}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Start over
            </button>
          </div>

          {!decisionResult && (
            <>
              {/* Photo upload + assessment */}
              <div className="mt-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
                <p className="text-sm font-semibold text-gray-900">Garment Photo</p>
                <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-gray-300 px-4 py-8 text-center hover:border-purple-400">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Garment to assess"
                      className="h-32 w-32 rounded-md object-cover"
                    />
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-gray-400" />
                      <span className="mt-2 text-sm text-gray-500">Click to upload a photo</span>
                    </>
                  )}
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>

                <button
                  type="button"
                  onClick={handleRunAssessment}
                  disabled={!imageBase64 || assessing}
                  className="mt-4 w-full rounded-md bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {assessing ? 'Assessing...' : 'Run Assessment'}
                </button>

                {assessError && (
                  <div className="mt-3 flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {assessError}
                  </div>
                )}
              </div>

              {/* Assessment results */}
              {assessment && (
                <div className="mt-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">AI Assessment</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${gradeBadge}`}>
                      {assessment.grade}
                    </span>
                  </div>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {assessment.condition_score}
                    <span className="text-sm font-normal text-gray-400"> / 100</span>
                  </p>

                  {assessment.defects.length > 0 ? (
                    <ul className="mt-2 list-inside list-disc text-sm text-gray-600">
                      {assessment.defects.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-gray-500">No defects detected.</p>
                  )}

                  <p className="mt-2 text-sm text-gray-600">
                    Recommended resale price: ${assessment.recommended_price?.toFixed(2)}
                  </p>

                  {!assessment.eligible_for_trade_in && (
                    <div className="mt-3 flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      AI recommends against trade-in, but the final call is yours.
                    </div>
                  )}

                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleDecision('approve')}
                      disabled={deciding !== null}
                      className="flex flex-1 items-center justify-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {deciding === 'approve' ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecision('reject')}
                      disabled={deciding !== null}
                      className="flex flex-1 items-center justify-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      {deciding === 'reject' ? 'Rejecting...' : 'Reject'}
                    </button>
                  </div>

                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Optional rejection reason..."
                    rows={2}
                    className="mt-3 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />

                  {decisionError && (
                    <div className="mt-3 flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      {decisionError}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Decision confirmation */}
          {decisionResult && decisionResult.decision === 'approve' && (
            <div className="mt-6 rounded-xl bg-green-50 p-6 ring-1 ring-green-200">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle2 className="h-6 w-6" />
                <p className="text-lg font-semibold">Trade-in approved!</p>
              </div>
              {latestReward && (
                <div className="mt-3 flex items-center gap-2 text-green-700">
                  <Gift className="h-5 w-5" />
                  <p className="font-medium">
                    Reward issued: ${latestReward.value.toFixed(2)}{' '}
                    {latestReward.reward_type.replace('_', ' ')}
                  </p>
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-3">
                  <Droplets className="h-6 w-6 text-cyan-600" />
                  <div>
                    <p className="text-lg font-bold text-cyan-700">
                      {decisionResult.garment.sustainability.water_saved_liters.toLocaleString()} L
                    </p>
                    <p className="text-xs text-cyan-600">Lifetime water saved</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-3">
                  <Cloud className="h-6 w-6 text-emerald-600" />
                  <div>
                    <p className="text-lg font-bold text-emerald-700">
                      {decisionResult.garment.sustainability.co2_avoided_kg} kg
                    </p>
                    <p className="text-xs text-emerald-600">Lifetime CO₂ avoided</p>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm text-green-700">
                The garment is now listed on the Marketplace at $
                {decisionResult.garment.price?.toFixed(2)}.
              </p>
              <button
                type="button"
                onClick={handleReset}
                className="mt-5 rounded-md border border-green-300 px-4 py-2 text-sm font-medium text-green-800 hover:bg-green-100"
              >
                Start next trade-in
              </button>
            </div>
          )}

          {decisionResult && decisionResult.decision === 'reject' && (
            <div className="mt-6 rounded-xl bg-red-50 p-6 ring-1 ring-red-200">
              <div className="flex items-center gap-2 text-red-800">
                <XCircle className="h-6 w-6" />
                <p className="text-lg font-semibold">Trade-in rejected</p>
              </div>
              <p className="mt-2 text-sm text-red-700">{rejectionNote}</p>
              <p className="mt-3 text-sm text-red-700">
                The garment has been returned to the family. No reward issued.
              </p>
              <button
                type="button"
                onClick={handleReset}
                className="mt-5 rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
              >
                Start next trade-in
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
