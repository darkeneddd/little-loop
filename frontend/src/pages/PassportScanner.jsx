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
        <QrCode className="mx-auto h-10 w-10 text-purple-600" />
        <h1 className="mt-3 text-2xl font-semibold text-gray-900">Scan Passport</h1>
        <p className="mt-2 text-gray-600">
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
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          type="submit"
          disabled={checking}
          className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {checking ? 'Checking...' : 'View Passport'}
        </button>
      </form>

      <div className="mt-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs uppercase tracking-wide text-gray-400">or</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <div className="mt-6 text-center">
        {!scanning ? (
          <button
            type="button"
            onClick={() => {
              setError('')
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

      {error && (
        <div className="mt-6 flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}
