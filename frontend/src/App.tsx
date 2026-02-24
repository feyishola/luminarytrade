import React, { Suspense, lazy } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AuthPage from './components/auth/AuthPage';

// Lazy load route components
const Dashboard = lazy(() => import('./components/Dashboard'));
const CreditScoring = lazy(() => import('./components/CreditScoring'));
const FraudDetection = lazy(() => import('./components/FraudDetection'));
const WalletInterface = lazy(() => import('./components/WalletInterface'));
const TransactionPage = lazy(() => import('./components/TransactionPage'));

// Loading fallback component
const Loading: React.FC = () => (
  <div style={{ padding: '20px', textAlign: 'center' }}>
    <div className="loader">Loading...</div>
  </div>
);

const App: React.FC = () => {
  const { user, logout } = useAuth();

  // Prefetch component on hover
  const prefetchComponent = (componentName: string) => {
    switch (componentName) {
      case 'dashboard': import('./components/Dashboard'); break;
      case 'scoring': import('./components/CreditScoring'); break;
      case 'fraud': import('./components/FraudDetection'); break;
      case 'wallet': import('./components/WalletInterface'); break;
      case 'transactions': import('./components/TransactionPage'); break;
    }
  };

  return (
    <div className="app-container">
      <nav style={{ padding: '20px', borderBottom: '1px solid #ccc' }}>
        <ul style={{ display: 'flex', gap: '20px', listStyle: 'none', margin: 0, padding: 0, alignItems: 'center' }}>
          <li>
            <Link to="/" onMouseEnter={() => prefetchComponent('dashboard')}>Dashboard</Link>
          </li>
          <li>
            <Link to="/scoring" onMouseEnter={() => prefetchComponent('scoring')}>Credit Scoring</Link>
          </li>
          <li>
            <Link to="/fraud" onMouseEnter={() => prefetchComponent('fraud')}>Fraud Detection</Link>
          </li>
          <li>
            <Link to="/wallet" onMouseEnter={() => prefetchComponent('wallet')}>Wallet</Link>
          </li>
          <li>
            <Link to="/transactions" onMouseEnter={() => prefetchComponent('transactions')}>Transactions</Link>
          </li>
          <li style={{ marginLeft: 'auto' }}>
            {user ? (
              <button onClick={() => void logout()} style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5f5',
                background: '#eef2ff',
                color: '#4338ca',
                cursor: 'pointer',
              }}>
                Logout
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 12 }}>
                <Link to="/login">Login</Link>
                <Link to="/signup">Sign up</Link>
              </div>
            )}
          </li>
        </ul>
      </nav>

      <main style={{ padding: '20px' }}>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/signup" element={<AuthPage mode="signup" />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/scoring" element={<CreditScoring />} />
              <Route path="/fraud" element={<FraudDetection />} />
              <Route path="/wallet" element={<WalletInterface />} />
              <Route path="/transactions" element={<TransactionPage />} />
            </Route>
          </Routes>
        </Suspense>
      </main>
    </div>
  );
};

export default App;
