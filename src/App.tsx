import { useEffect, useState } from 'react'
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useStore } from './data/store'
import { initSync } from './data/sync'
import { Toaster } from './ui/toast'
import { LockGate } from './ui/LockScreen'
import { Shell } from './ui/Shell'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import TransactionForm from './pages/TransactionForm'
import Subscriptions from './pages/Subscriptions'
import SubscriptionForm from './pages/SubscriptionForm'
import More from './pages/More'
import Budgets from './pages/Budgets'
import Reports from './pages/Reports'
import Accounts from './pages/Accounts'
import AccountForm from './pages/AccountForm'
import Import from './pages/Import'
import Statement from './pages/Statement'
import Settings from './pages/Settings'
import CategoriesPage from './pages/Categories'
import RulesPage from './pages/Rules'
import SyncPage from './pages/Sync'
import Loans from './pages/Loans'
import LoanDetail from './pages/LoanDetail'
import LoanForm from './pages/LoanForm'
import Forecast from './pages/Forecast'
import QuickExpense from './pages/QuickExpense'
import WalletHelp from './pages/WalletHelp'
import Documents from './pages/Documents'
import PlannedForm from './pages/PlannedForm'
import Trips from './pages/Trips'
import TripDetail from './pages/TripDetail'
import TripForm from './pages/TripForm'

function useTheme() {
  const theme = useStore((s) => s.settings.theme)
  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
  }, [theme])
}

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  const onboarded = useStore((s) => s.onboarded)
  const [hydrated, setHydrated] = useState(useStore.persist.hasHydrated())
  useTheme()
  useEffect(() => {
    const unsub = useStore.persist.onFinishHydration(() => setHydrated(true))
    setHydrated(useStore.persist.hasHydrated())
    return unsub
  }, [])
  useEffect(() => {
    if (!hydrated) return
    useStore.getState().upgradeDefaults()
    return initSync()
  }, [hydrated])

  if (!hydrated) return null
  return (
    <LockGate>
    <HashRouter>
      <ScrollTop />
      <div className="app">
        {!onboarded ? (
          <Routes>
            <Route path="/parametres/synchro" element={<SyncPage />} />
            <Route path="*" element={<Onboarding />} />
          </Routes>
        ) : (
          <>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/operations" element={<Transactions />} />
              <Route path="/operations/nouvelle" element={<TransactionForm />} />
              <Route path="/operations/:id" element={<TransactionForm />} />
              <Route path="/abonnements" element={<Subscriptions />} />
              <Route path="/abonnements/nouveau" element={<SubscriptionForm />} />
              <Route path="/abonnements/:id" element={<SubscriptionForm />} />
              <Route path="/plus" element={<More />} />
              <Route path="/budgets" element={<Budgets />} />
              <Route path="/rapports" element={<Reports />} />
              <Route path="/comptes" element={<Accounts />} />
              <Route path="/comptes/nouveau" element={<AccountForm />} />
              <Route path="/comptes/:id" element={<AccountForm />} />
              <Route path="/prets" element={<Loans />} />
              <Route path="/prets/nouveau" element={<LoanForm />} />
              <Route path="/prets/:id" element={<LoanDetail />} />
              <Route path="/prets/:id/modifier" element={<LoanForm />} />
              <Route path="/rapide" element={<QuickExpense />} />
              <Route path="/parametres/wallet" element={<WalletHelp />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/previsionnel" element={<Forecast />} />
              <Route path="/previsionnel/nouveau" element={<PlannedForm />} />
              <Route path="/previsionnel/:id" element={<PlannedForm />} />
              <Route path="/voyages" element={<Trips />} />
              <Route path="/voyages/nouveau" element={<TripForm />} />
              <Route path="/voyages/:id" element={<TripDetail />} />
              <Route path="/voyages/:id/modifier" element={<TripForm />} />
              <Route path="/import" element={<Import />} />
              <Route path="/releve" element={<Statement />} />
              <Route path="/parametres" element={<Settings />} />
              <Route path="/parametres/categories" element={<CategoriesPage />} />
              <Route path="/parametres/regles" element={<RulesPage />} />
              <Route path="/parametres/synchro" element={<SyncPage />} />
              <Route path="*" element={<Dashboard />} />
            </Routes>
            <Shell />
          </>
        )}
        <Toaster />
      </div>
    </HashRouter>
    </LockGate>
  )
}
