import { Routes, Route } from 'react-router-dom'
import NavBar from './components/NavBar'
import RequireRole from './components/RequireRole'
import Landing from './pages/Landing'
import PassportScanner from './pages/PassportScanner'
import Passport from './pages/Passport'
import Marketplace from './pages/Marketplace'
import TradeIn from './pages/TradeIn'
import Dashboard from './pages/Dashboard'

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/scan" element={<PassportScanner />} />
          <Route path="/passport/:id" element={<Passport />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/trade-in" element={<TradeIn />} />
          <Route
            path="/dashboard"
            element={
              <RequireRole allow="Corporate">
                <Dashboard />
              </RequireRole>
            }
          />
        </Routes>
      </main>
    </div>
  )
}

export default App
