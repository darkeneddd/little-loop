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
  RefreshCw,
} from 'lucide-react'
import { getGarment, assessImage, submitTradeIn } from '../api'
import ImpactReceipt from '../components/ImpactReceipt'

const QR_REGION_ID = 'trade-in-qr-reader'

// Mirrors Passport.jsx's status badge map -- duplicated rather than shared
// since each page still owns its own small color maps (see also
// Marketplace.jsx's gradeFor).
const STATUS_BADGE = {
  active: 'bg-carter-blue',
  returned: 'bg-warning',
  sanitizing: 'bg-blue-dark',
  resale: 'bg-loop-green',
  retired: 'bg-text-muted',
}

// Mirrors assessment.py's GRADE_BANDS wording + Design.md's Grade badge
// colors. Poor isn't in that table, so it shares Rejected's color.
const GRADE_BADGE = {
  Excellent: 'bg-loop-green',
  Good: 'bg-green-dark',
  Fair: 'bg-warning',
  Poor: 'bg-danger',
  Rejected: 'bg-danger',
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
  // Same "families served" definition Passport.jsx uses, for the approval
  // confirmation's impact receipt (T16).
  const familiesServed = decisionResult?.garment.cycles.filter(
    (c) => c.event_type === 'purchased',
  ).length

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="h-6 w-6 text-carter-blue" />
        <h1 className="text-2xl font-semibold text-deep-navy">Employee Trade-In</h1>
      </div>
      <p className="mt-1 text-text-muted">
        Scan a garment, run the AI condition assessment, and approve or reject the trade-in.
      </p>

      {!garment ? (
        <div className="mt-8 max-w-2xl rounded-md border-[0.5px] border-hairline bg-white p-6">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              placeholder="Garment ID (e.g. a1b2c3...)"
              className="flex-1 rounded-md border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-carter-blue"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-carter-blue px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load Garment'}
            </button>
          </form>

          <div className="mt-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-hairline" />
            <span className="text-xs uppercase tracking-wide text-text-muted">or</span>
            <div className="h-px flex-1 bg-hairline" />
          </div>

          <div className="mt-5 text-center">
            {!scanning ? (
              <button
                type="button"
                onClick={() => {
                  setLoadError('')
                  setScanning(true)
                }}
                className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-carter-blue px-4 py-2 text-sm font-medium text-carter-blue"
              >
                <ScanLine className="h-4 w-4" />
                Scan QR Code
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setScanning(false)}
                className="rounded-full border border-hairline px-4 py-2 text-sm font-medium text-deep-navy"
              >
                Cancel Scan
              </button>
            )}
          </div>

          {scanning && (
            <div
              id={QR_REGION_ID}
              className="mx-auto mt-4 max-w-sm overflow-hidden rounded-md border-2 border-dashed border-blue-mid"
            />
          )}

          {loadError && (
            <div className="mt-5 flex items-center gap-2 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {loadError}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left column: garment info + photo upload */}
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4 rounded-md border-[0.5px] border-hairline bg-white p-5">
              <div>
                <p className="font-medium text-deep-navy">{garment.product_name}</p>
                <p className="text-sm text-text-muted">
                  Size {garment.size} &middot; SKU {garment.sku}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize text-white ${
                      STATUS_BADGE[garment.current_status] || 'bg-text-muted'
                    }`}
                  >
                    {garment.current_status}
                  </span>
                  <span className="font-mono text-xs text-text-muted">
                    score {garment.current_condition_score}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 text-sm font-medium text-text-muted"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Start over
              </button>
            </div>

            {!decisionResult && (
              <div className="rounded-md border-[0.5px] border-hairline bg-white p-5">
                <p className="text-sm font-semibold text-deep-navy">Garment Photo</p>
                <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-blue-mid bg-cream px-4 py-8 text-center">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Garment to assess"
                      className="h-32 w-32 rounded-md object-cover"
                    />
                  ) : (
                    <>
                      <Upload className="h-7 w-7 text-carter-blue" />
                      <span className="mt-2 text-[11px] text-text-muted">Click to upload a photo</span>
                    </>
                  )}
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>

                <button
                  type="button"
                  onClick={handleRunAssessment}
                  disabled={!imageBase64 || assessing}
                  className="mt-4 w-full rounded-full bg-carter-blue px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {assessing ? 'Assessing...' : 'Run Assessment'}
                </button>

                {assessError && (
                  <div className="mt-3 flex items-center gap-2 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {assessError}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right column: AI assessment result + decision */}
          <div className="space-y-6">
            {!decisionResult && assessment && (
              <div className="rounded-md border-[0.5px] border-hairline bg-white p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-deep-navy">AI Assessment</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ${gradeBadge}`}>
                    {assessment.grade}
                  </span>
                </div>
                <p className="mt-2 font-mono text-3xl font-medium text-deep-navy">
                  {assessment.condition_score}
                  <span className="text-sm font-normal text-text-muted"> / 100</span>
                </p>
                <div className="mt-2 h-1.5 w-full rounded-full bg-sky-tint">
                  <div
                    className="h-1.5 rounded-full bg-loop-green"
                    style={{ width: `${assessment.condition_score}%` }}
                  />
                </div>

                {assessment.defects.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {assessment.defects.map((d) => (
                      <span
                        key={d}
                        className="rounded-full border border-[#F0C97E] bg-warning-bg px-2.5 py-0.5 text-[10px] text-warning-text"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-text-muted">No defects detected.</p>
                )}

                <p className="mt-3 font-mono text-sm text-text-muted">
                  Recommended resale price: ${assessment.recommended_price?.toFixed(2)}
                </p>

                {!assessment.eligible_for_trade_in && (
                  <div className="mt-3 flex items-center gap-2 rounded-md bg-warning-bg px-3 py-2 text-sm text-warning-text">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    AI recommends against trade-in, but the final call is yours.
                  </div>
                )}

                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleDecision('approve')}
                    disabled={deciding !== null}
                    className="flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-loop-green px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {deciding === 'approve' ? 'Approving...' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecision('reject')}
                    disabled={deciding !== null}
                    className="flex flex-1 items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-danger-bg bg-white px-3 py-2 text-sm font-medium text-danger disabled:opacity-50"
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
                  className="mt-3 w-full rounded-md border border-hairline px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-carter-blue"
                />

                {decisionError && (
                  <div className="mt-3 flex items-center gap-2 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {decisionError}
                  </div>
                )}
              </div>
            )}

            {!decisionResult && !assessment && (
              <div className="flex h-full items-center justify-center rounded-md border-[0.5px] border-hairline bg-white p-5 text-center text-sm text-text-muted">
                Upload a photo and run the assessment to see results here.
              </div>
            )}

            {/* Decision confirmation */}
            {decisionResult && decisionResult.decision === 'approve' && (
              <div className="rounded-md bg-mint-tint p-6">
                <div className="flex items-center gap-2 text-green-dark">
                  <CheckCircle2 className="h-6 w-6" />
                  <p className="text-lg font-semibold">Trade-in approved!</p>
                </div>
                {latestReward && (
                  <div className="mt-3 flex items-center gap-2 text-green-dark">
                    <Gift className="h-5 w-5" />
                    <p className="font-medium">
                      Reward issued: ${latestReward.value.toFixed(2)}{' '}
                      {latestReward.reward_type.replace('_', ' ')}
                    </p>
                  </div>
                )}
                <ImpactReceipt
                  className="mt-4"
                  familiesServed={familiesServed}
                  waterSavedLiters={decisionResult.garment.sustainability.water_saved_liters}
                  co2AvoidedKg={decisionResult.garment.sustainability.co2_avoided_kg}
                  wasteDivertedCount={decisionResult.garment.sustainability.cycles_completed}
                />
                <p className="mt-4 text-sm text-green-dark">
                  The garment is now listed on the Marketplace at $
                  {decisionResult.garment.price?.toFixed(2)}.
                </p>
                <button
                  type="button"
                  onClick={handleReset}
                  className="mt-5 rounded-full border border-loop-green px-4 py-2 text-sm font-medium text-green-dark"
                >
                  Start next trade-in
                </button>
              </div>
            )}

            {decisionResult && decisionResult.decision === 'reject' && (
              <div className="rounded-md bg-danger-bg p-6">
                <div className="flex items-center gap-2 text-danger">
                  <XCircle className="h-6 w-6" />
                  <p className="text-lg font-semibold">Trade-in rejected</p>
                </div>
                <p className="mt-2 text-sm text-danger">{rejectionNote}</p>
                <p className="mt-3 text-sm text-danger">
                  The garment has been returned to the family. No reward issued.
                </p>
                <button
                  type="button"
                  onClick={handleReset}
                  className="mt-5 rounded-full border border-danger px-4 py-2 text-sm font-medium text-danger"
                >
                  Start next trade-in
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
