import { useRole } from '../context/RoleContext'

// Gates a route to a specific role. No real auth (per CLAUDE.md) -- this is
// just UI guidance so switching roles in the nav also switches what's
// reachable, e.g. Corporate Dashboard shouldn't be visible while "viewing
// as" Parent or Employee.
export default function RequireRole({ allow, children }) {
  const { role, setRole } = useRole()
  if (role !== allow) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-deep-navy">
          {allow} access only
        </h1>
        <p className="mt-2 text-text-muted">
          Switch to the {allow} role to view this screen.
        </p>
        <button
          type="button"
          onClick={() => setRole(allow)}
          className="mt-4 rounded-full bg-carter-blue px-5 py-2 text-sm font-medium text-white"
        >
          Switch to {allow}
        </button>
      </div>
    )
  }
  return children
}
