import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { QrCode, ScanLine, AlertCircle } from 'lucide-react'
import { getGarment } from '../api'

const QR_REGION_ID = 'qr-reader'

export default function PassportScanner() {
  const [manualId, setManualId] = useState('')
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const scannerRef = useRef(null)
  const navigate = useNavigate()

  // Tear down the camera stream on unmount or when scanning is toggled off,
  // so we don't leak an open camera if the user navigates away mid-scan.
  useEffect(() => {
    if (!scanning) return

    const scanner = new Html5Qrcode(QR_REGION_ID)
    scannerRef.current = scanner
    let cancelled = false

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 220 },
        (decodedText) => {
          if (cancelled) return
          cancelled = true
          handleResolved(extractGarmentId(decodedText))
        },
        () => {
          // Per-frame "no QR found" callback -- expected constantly while
          // scanning, nothing to surface to the user.
        },
      )
      .catch((err) => {
        setError(`Could not start camera: ${err?.message || err}`)
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

  // QR payloads may be a bare garment ID or a full passport URL
  // (e.g. https://.../passport/<id>) -- handle either.
  function extractGarmentId(text) {
    const trimmed = text.trim()
    const match = trimmed.match(/passport\/([^/?#]+)/)
    return match ? match[1] : trimmed
  }

  async function handleResolved(id) {
    setScanning(false)
    await goToPassport(id)
  }

  async function goToPassport(id) {
    const garmentId = id.trim()
    if (!garmentId) {
      setError('Enter a garment ID.')
      return
    }
    setChecking(true)
    setError('')
    try {
      await getGarment(garmentId)
      navigate(`/passport/${garmentId}`)
    } catch (err) {
      setError(`No passport found for "${garmentId}".`)
    } finally {
      setChecking(false)
    }
  }

  function handleManualSubmit(e) {
    e.preventDefault()
    goToPassport(manualId)
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="text-center">
        <QrCode className="mx-auto h-10 w-10 text-carter-blue" />
        <h1 className="mt-3 text-2xl font-semibold text-deep-navy">Scan Passport</h1>
        <p className="mt-2 text-text-muted">
          Scan a garment's QR tag or enter its ID to view its Digital Garment
          Passport.
        </p>
      </div>

      <form onSubmit={handleManualSubmit} className="mt-8 flex gap-2">
        <input
          type="text"
          value={manualId}
          onChange={(e) => setManualId(e.target.value)}
          placeholder="Garment ID (e.g. a1b2c3...)"
          className="flex-1 rounded-md border border-hairline px-3 py-2 text-sm text-deep-navy focus:outline-none focus:ring-2 focus:ring-carter-blue"
        />
        <button
          type="submit"
          disabled={checking}
          className="rounded-full bg-carter-blue px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {checking ? 'Checking...' : 'View Passport'}
        </button>
      </form>

      <div className="mt-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-hairline" />
        <span className="text-xs uppercase tracking-wide text-text-muted">or</span>
        <div className="h-px flex-1 bg-hairline" />
      </div>

      <div className="mt-6 text-center">
        {!scanning ? (
          <button
            type="button"
            onClick={() => {
              setError('')
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

      {scanning ? (
        <div
          id={QR_REGION_ID}
          className="mx-auto mt-4 max-w-sm overflow-hidden rounded-md border-2 border-dashed border-blue-mid"
        />
      ) : (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-md border-2 border-dashed border-blue-mid bg-cream px-4 py-8">
          <QrCode className="h-7 w-7 text-carter-blue" />
          <p className="text-[11px] text-text-muted">QR scan preview appears here</p>
        </div>
      )}

      {error && (
        <div className="mt-6 flex items-center gap-2 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}
