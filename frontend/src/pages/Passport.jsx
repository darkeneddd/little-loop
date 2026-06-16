import { useParams } from 'react-router-dom'

// Placeholder -- built out in T11 (the demo's hero screen).
export default function Passport() {
  const { id } = useParams()
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-gray-900">Digital Passport</h1>
      <p className="mt-2 text-gray-600">
        Garment <code className="rounded bg-gray-100 px-1.5 py-0.5">{id}</code>{' '}
        -- full passport UI coming in T11.
      </p>
    </div>
  )
}
