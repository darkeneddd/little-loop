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
  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    isActive
      ? 'bg-purple-100 text-purple-700'
      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
  }`

export default function NavBar() {
  const { role, setRole } = useRole()
  const links = ROLE_LINKS[role] || []

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <NavLink to="/" className="flex items-center gap-2 text-gray-900">
          <Recycle className="h-6 w-6 text-purple-600" />
          <span className="text-lg font-semibold">LittleLoop</span>
        </NavLink>

        <div className="flex items-center gap-1">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={linkClasses}>
              {link.label}
            </NavLink>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600">
          Viewing as
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>
    </nav>
  )
}
