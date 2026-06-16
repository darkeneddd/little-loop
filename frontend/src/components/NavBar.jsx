import { NavLink } from 'react-router-dom'
import { Recycle } from 'lucide-react'
import { ROLES, useRole } from '../context/RoleContext'

// Per CLAUDE.md's User Roles & Views table -- each role only sees the
// screens relevant to it. Landing + Passport are useful regardless of role
// (anyone might want to scan/view a passport), so they stay visible always.
const ROLE_LINKS = {
  Parent: [
    { to: '/scan', label: 'Scan Passport' },
    { to: '/marketplace', label: 'Marketplace' },
  ],
  Employee: [{ to: '/trade-in', label: 'Trade-In' }],
  Corporate: [{ to: '/dashboard', label: 'Dashboard' }],
}

const linkClasses = ({ isActive }) =>
  `rounded-md px-3 py-2 text-xs font-medium transition-colors ${
    isActive ? 'text-deep-navy' : 'text-text-muted hover:text-deep-navy'
  }`

export default function NavBar() {
  const { role, setRole } = useRole()
  const links = ROLE_LINKS[role] || []
  // Parent gets the standard blue pill CTA; Employee/Corporate replace it
  // with a Deep Navy role badge instead (Design.md, Nav bar + per-screen
  // "Role indicator" notes), using the same dropdown either way since role
  // switching has to stay reachable from every screen.
  const isParent = role === 'Parent'

  return (
    <div className="px-5 pt-5">
      <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-xl border-[0.5px] border-hairline bg-white px-5 py-3.5">
        <NavLink to="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-carter-blue">
            <Recycle className="h-4 w-4 text-white" />
          </span>
          <span className="text-sm font-semibold text-deep-navy">
            Little<span className="text-carter-blue">Loop</span>
          </span>
        </NavLink>

        <div className="flex items-center gap-1">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={linkClasses}>
              {link.label}
            </NavLink>
          ))}
        </div>

        <label
          className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-white ${
            isParent ? 'bg-carter-blue' : 'bg-deep-navy'
          }`}
        >
          <span className="text-white/70">Viewing as</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="bg-transparent text-xs font-medium text-white focus:outline-none [&>option]:text-deep-navy"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </nav>
    </div>
  )
}
