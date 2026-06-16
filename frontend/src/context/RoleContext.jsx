import { createContext, useContext, useState } from 'react'

// No real auth (per CLAUDE.md) -- the role is just UI state that controls
// which nav links / screens are visible, switchable any time via the nav
// dropdown.
export const ROLES = ['Parent', 'Employee', 'Corporate']

const RoleContext = createContext(undefined)

export function RoleProvider({ children }) {
  const [role, setRole] = useState('Parent')
  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  const ctx = useContext(RoleContext)
  if (ctx === undefined) {
    throw new Error('useRole must be used within a RoleProvider')
  }
  return ctx
}
