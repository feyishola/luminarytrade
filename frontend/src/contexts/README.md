# Global State Management with Context API & Custom Hooks

This document provides comprehensive guidance on using the centralized state management system built with React Context API and custom hooks.

## Overview

The state management system provides:

- **Centralized Authentication State** - User login, tokens, profile management
- **Wallet Connection State** - Multi-provider wallet support, transactions, balance
- **Global Notifications** - Toast messages, alerts, system notifications
- **User Preferences** - Theme, language, accessibility settings
- **Error Boundary** - Global error handling and reporting
- **Custom Hooks** - Easy-to-use hooks for all state operations

## Architecture

```
src/contexts/
├── types.ts                    # All TypeScript interfaces
├── AuthContext.tsx            # Authentication state
├── WalletContext.tsx          # Wallet connection state
├── NotificationContext.tsx    # Global notifications
├── PreferencesContext.tsx     # User preferences
├── ErrorBoundaryContext.tsx   # Error handling
├── Providers.tsx              # Provider composition
├── hooks/
│   └── index.ts               # Custom hooks
├── __tests__/
│   └── *.test.tsx            # Unit tests
└── README.md                  # This documentation
```

## Quick Start

### 1. Wrap Your App with Providers

```tsx
import { AppProviders } from './contexts/Providers';

function App() {
  return (
    <AppProviders>
      <YourAppComponents />
    </AppProviders>
  );
}
```

### 2. Use Custom Hooks in Components

```tsx
import { useAuth, useWallet, useNotification } from './contexts/hooks';

function MyComponent() {
  const { user, isAuthenticated, login } = useAuth();
  const { connect, isConnected, address } = useWallet();
  const { addNotification } = useNotification();

  const handleLogin = async () => {
    try {
      await login(email, password);
      addNotification({
        type: 'success',
        title: 'Welcome!',
        message: 'Login successful'
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Login Failed',
        message: error.message
      });
    }
  };

  return (
    <div>
      {isAuthenticated ? <p>Welcome, {user.name}!</p> : <LoginButton />}
      {isConnected ? <p>Wallet: {address}</p> : <ConnectWalletButton />}
    </div>
  );
}
```

## Authentication Context

### Features

- User login/logout
- JWT token management
- Profile updates
- Password management
- Email verification
- Auto-logout on inactivity
- Persistent sessions

### Usage

```tsx
import { useAuth } from './contexts/hooks';

function AuthComponent() {
  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    updateProfile,
    clearError
  } = useAuth();

  const handleLogin = async (email: string, password: string) => {
    try {
      await login(email, password);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleProfileUpdate = async (updates) => {
    try {
      await updateProfile(updates);
    } catch (error) {
      console.error('Profile update failed:', error);
    }
  };

  return (
    <div>
      {isLoading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      {isAuthenticated ? (
        <div>
          <h1>Welcome, {user.name}!</h1>
          <button onClick={logout}>Logout</button>
        </div>
      ) : (
        <LoginForm onLogin={handleLogin} />
      )}
    </div>
  );
}
```

### Auth Hook API

```typescript
interface AuthContextType {
  // State
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  lastActivity: string | null;

  // Methods
  login: (email: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  updateProfile: (userData: Partial<User>) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}
```

## Wallet Context

### Features

- Multi-provider support (MetaMask, WalletConnect, Phantom, Coinbase)
- Connection management
- Balance tracking
- Transaction history
- Network switching
- Message signing
- Token management

### Usage

```tsx
import { useWallet } from './contexts/hooks';

function WalletComponent() {
  const {
    isConnected,
    address,
    balance,
    provider,
    network,
    connect,
    disconnect,
    sendTransaction,
    signMessage
  } = useWallet();

  const handleConnect = async () => {
    try {
      await connect('metamask');
    } catch (error) {
      console.error('Wallet connection failed:', error);
    }
  };

  const handleSendTransaction = async () => {
    try {
      const tx = await sendTransaction('0x...', '0.1');
      console.log('Transaction sent:', tx.hash);
    } catch (error) {
      console.error('Transaction failed:', error);
    }
  };

  return (
    <div>
      {isConnected ? (
        <div>
          <p>Connected: {address}</p>
          <p>Balance: {balance} ETH</p>
          <p>Network: {network}</p>
          <button onClick={() => disconnect()}>Disconnect</button>
          <button onClick={handleSendTransaction}>Send ETH</button>
        </div>
      ) : (
        <button onClick={handleConnect}>Connect Wallet</button>
      )}
    </div>
  );
}
```

### Wallet Hook API

```typescript
interface WalletContextType {
  // State
  isConnected: boolean;
  address: string | null;
  balance: string;
  network: 'mainnet' | 'testnet' | 'devnet';
  provider: 'metamask' | 'walletconnect' | 'phantom' | 'coinbase' | null;
  chainId: number | null;
  isLoading: boolean;
  error: string | null;
  transactionHistory: Transaction[];
  tokens: Token[];

  // Methods
  connect: (provider: WalletState['provider']) => Promise<void>;
  disconnect: () => void;
  switchNetwork: (network: WalletState['network']) => Promise<void>;
  sendTransaction: (to: string, amount: string, data?: string) => Promise<Transaction>;
  signMessage: (message: string) => Promise<string>;
  getBalance: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  addToken: (token: Token) => void;
  removeToken: (address: string) => void;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}
```

## Notification Context

### Features

- Toast notifications
- Customizable positions
- Sound and vibration
- Auto-dismissal
- Notification history
- Custom actions

### Usage

```tsx
import { 
  useNotification, 
  createSuccessNotification, 
  createErrorNotification 
} from './contexts/hooks';

function NotificationComponent() {
  const { 
    notifications, 
    addNotification, 
    removeNotification,
    clearNotifications 
  } = useNotification();

  const showSuccess = () => {
    addNotification(createSuccessNotification(
      'Operation completed successfully!',
      'Success'
    ));
  };

  const showError = () => {
    addNotification(createErrorNotification(
      'Something went wrong. Please try again.',
      'Error'
    ));
  };

  const showCustom = () => {
    addNotification({
      type: 'info',
      title: 'Custom Notification',
      message: 'This is a custom notification with actions',
      duration: 0, // Persistent
      actions: [
        {
          label: 'Undo',
          action: () => console.log('Undo action'),
          variant: 'secondary'
        },
        {
          label: 'Retry',
          action: () => console.log('Retry action'),
          variant: 'primary'
        }
      ]
    });
  };

  return (
    <div>
      <button onClick={showSuccess}>Show Success</button>
      <button onClick={showError}>Show Error</button>
      <button onClick={showCustom}>Show Custom</button>
      <button onClick={clearNotifications}>Clear All</button>
      
      <div>
        {notifications.map(notification => (
          <div key={notification.id}>
            <h4>{notification.title}</h4>
            <p>{notification.message}</p>
            <button onClick={() => removeNotification(notification.id)}>
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Notification Hook API

```typescript
interface NotificationContextType {
  // State
  notifications: Notification[];
  maxNotifications: number;
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  soundEnabled: boolean;
  vibrationEnabled: boolean;

  // Methods
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => string;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  updateNotification: (id: string, updates: Partial<Notification>) => void;
  setMaxNotifications: (max: number) => void;
  setPosition: (position: NotificationState['position']) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setVibrationEnabled: (enabled: boolean) => void;
}
```

## Preferences Context

### Features

- Theme management (light/dark/system)
- Language settings
- Accessibility options
- Notification preferences
- Privacy settings
- Dashboard customization
- Persistent storage

### Usage

```tsx
import { 
  usePreferences, 
  useThemePreferences,
  useAccessibilityPreferences 
} from './contexts/hooks';

function PreferencesComponent() {
  const { preferences, updatePreferences, savePreferences } = usePreferences();
  const { theme, setTheme, toggleTheme } = useThemePreferences();
  const { accessibility, updateAccessibilitySettings } = useAccessibilityPreferences();

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
  };

  const handleAccessibilityUpdate = (settings) => {
    updateAccessibilitySettings(settings);
  };

  return (
    <div>
      <div>
        <h3>Theme</h3>
        <select value={theme} onChange={(e) => handleThemeChange(e.target.value)}>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
        <button onClick={toggleTheme}>Toggle Theme</button>
      </div>

      <div>
        <h3>Accessibility</h3>
        <label>
          <input
            type="checkbox"
            checked={accessibility.highContrast}
            onChange={(e) => handleAccessibilityUpdate({ highContrast: e.target.checked })}
          />
          High Contrast
        </label>
        <label>
          <input
            type="checkbox"
            checked={accessibility.largeText}
            onChange={(e) => handleAccessibilityUpdate({ largeText: e.target.checked })}
          />
          Large Text
        </label>
      </div>

      <button onClick={savePreferences}>Save Preferences</button>
    </div>
  );
}
```

### Preferences Hook API

```typescript
interface PreferencesContextType {
  // State
  preferences: UserPreferences;
  isLoading: boolean;
  error: string | null;
  isDirty: boolean;

  // Methods
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  resetPreferences: () => void;
  savePreferences: () => Promise<void>;
  loadPreferences: () => Promise<void>;
  exportPreferences: () => string;
  importPreferences: (data: string) => void;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}
```

## Error Boundary Context

### Features

- Global error catching
- Error reporting
- Error history
- Retry functionality
- Development error details

### Usage

```tsx
import { ErrorBoundary, useErrorBoundary } from './contexts';

function MyComponent() {
  const { hasError, error, retry, reportError } = useErrorBoundary();

  const handleError = () => {
    try {
      // Risky operation
      throw new Error('Something went wrong!');
    } catch (error) {
      reportError(error);
    }
  };

  if (hasError) {
    return (
      <div>
        <h2>Something went wrong</h2>
        <p>{error?.message}</p>
        <button onClick={retry}>Try Again</button>
      </div>
    );
  }

  return (
    <div>
      <button onClick={handleError}>Trigger Error</button>
    </div>
  );
}

// Wrap components with ErrorBoundary
function App() {
  return (
    <ErrorBoundary>
      <MyComponent />
    </ErrorBoundary>
  );
}
```

### Error Boundary Hook API

```typescript
interface ErrorBoundaryContextType {
  // State
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorHistory: Array<{
    error: Error;
    errorInfo: ErrorInfo;
    timestamp: string;
  }>;
  isReporting: boolean;

  // Methods
  setError: (error: Error, errorInfo: ErrorInfo) => void;
  clearError: () => void;
  reportError: (error: Error, errorInfo?: ErrorInfo) => Promise<void>;
  retry: () => void;
  getErrorHistory: () => ErrorState['errorHistory'];
  clearErrorHistory: () => void;
}
```

## Provider Composition

### Available Providers

```tsx
import {
  AppProviders,           // All providers with error boundary
  AppStateProviders,      // All state providers (no error boundary)
  AuthOnlyProviders,      // Auth + notifications only
  WalletProviders,        // Wallet-focused providers
  DevProviders,           // Development providers with debugging
  ProviderSets,           // Pre-configured provider sets
  createProviders         // Configurable provider composition
} from './contexts/Providers';
```

### Usage Examples

```tsx
// Full application (recommended)
<AppProviders>
  <App />
</AppProviders>

// Public pages (no auth required)
<ProviderSets.public>
  <LandingPage />
</ProviderSets.public>

// Authenticated pages only
<ProviderSets.authenticated>
  <Dashboard />
</ProviderSets.authenticated>

// Custom provider configuration
const CustomProviders = createProviders({
  withErrorBoundary: true,
  withAuth: true,
  withWallet: false,
  withNotifications: true,
  withPreferences: true,
});

<CustomProviders>
  <SettingsPage />
</CustomProviders>
```

## Advanced Hooks

### Combined State Hook

```tsx
import { useAppState } from './contexts/hooks';

function AppHeader() {
  const { auth, wallet, notification, isLoading, hasError } = useAppState();

  return (
    <header>
      {isLoading && <LoadingSpinner />}
      {hasError && <ErrorIndicator />}
      {auth.isAuthenticated && <UserProfile user={auth.user} />}
      {wallet.isConnected && <WalletInfo address={wallet.address} />}
      <NotificationBell count={notification.notifications.length} />
    </header>
  );
}
```

### Authenticated User Hook

```tsx
import { useAuthenticatedUser } from './contexts/hooks';

function UserProfile() {
  const { user, logout, updateProfile, showSuccess, showError } = useAuthenticatedUser();

  const handleUpdateProfile = async (updates) => {
    try {
      await updateProfile(updates);
      showSuccess('Profile updated successfully!');
    } catch (error) {
      showError('Failed to update profile');
    }
  };

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
}
```

### Wallet Operations Hook

```tsx
import { useWalletOperations } from './contexts/hooks';

function WalletInterface() {
  const { 
    isConnected, 
    address, 
    balance, 
    connect, 
    disconnect, 
    sendTransaction 
  } = useWalletOperations();

  return (
    <div>
      {isConnected ? (
        <div>
          <p>Connected: {address}</p>
          <p>Balance: {balance} ETH</p>
          <button onClick={() => disconnect()}>Disconnect</button>
          <button onClick={() => sendTransaction('0x...', '0.1')}>
            Send ETH
          </button>
        </div>
      ) : (
        <button onClick={() => connect('metamask')}>Connect Wallet</button>
      )}
    </div>
  );
}
```

## Best Practices

### 1. Provider Placement

Place providers at the highest level possible:

```tsx
// ✅ Good - At app root
function App() {
  return (
    <AppProviders>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </Router>
    </AppProviders>
  );
}

// ❌ Bad - Inside individual components
function Dashboard() {
  return (
    <AppProviders>
      <DashboardContent />
    </AppProviders>
  );
}
```

### 2. Error Handling

Always handle async errors in hooks:

```tsx
// ✅ Good
function LoginComponent() {
  const { login, clearError } = useAuth();
  
  const handleLogin = async (email, password) => {
    try {
      await login(email, password);
    } catch (error) {
      // Error is handled in context, but you can add UI feedback
      console.error('Login failed:', error);
    }
  };
  
  return <LoginForm onLogin={handleLogin} />;
}

// ❌ Bad - No error handling
function BadLoginComponent() {
  const { login } = useAuth();
  
  const handleLogin = async (email, password) => {
    await login(email, password); // Errors not handled
  };
  
  return <LoginForm onLogin={handleLogin} />;
}
```

### 3. Loading States

Use loading states for better UX:

```tsx
// ✅ Good
function DataComponent() {
  const { isLoading, user } = useAuth();
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  return <div>Welcome, {user?.name}!</div>;
}

// ❌ Bad - No loading state
function BadDataComponent() {
  const { user } = useAuth();
  
  return <div>Welcome, {user?.name}!</div>; // May show undefined during loading
}
```

### 4. Conditional Rendering

Render based on authentication state:

```tsx
// ✅ Good
function ProtectedComponent() {
  const { isAuthenticated, user } = useAuth();
  
  if (!isAuthenticated) {
    return <LoginRequired />;
  }
  
  return <div>Welcome, {user.name}!</div>;
}

// ❌ Bad - Accessing user without checking auth
function BadProtectedComponent() {
  const { user } = useAuth();
  
  return <div>Welcome, {user.name}!</div>; // May crash if not authenticated
}
```

### 5. Performance Optimization

Use specific hooks instead of combined hooks when possible:

```tsx
// ✅ Good - Only what you need
function ThemeComponent() {
  const { theme, setTheme } = useThemePreferences();
  return <ThemeSelector theme={theme} onChange={setTheme} />;
}

// ❌ Bad - Loading everything when you only need theme
function BadThemeComponent() {
  const { preferences } = usePreferences();
  return <ThemeSelector theme={preferences.theme} onChange={setTheme} />;
}
```

## Testing

### Testing Components with Contexts

```tsx
import { render, screen } from '@testing-library/react';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationProvider } from '../contexts/NotificationContext';

// Test wrapper
const TestWrapper = ({ children }) => (
  <AuthProvider>
    <NotificationProvider>
      {children}
    </NotificationProvider>
  </AuthProvider>
);

// Test component
test('renders user profile when authenticated', () => {
  render(<UserProfile />, { wrapper: TestWrapper });
  
  // Test your component
  expect(screen.getByText('User Profile')).toBeInTheDocument();
});
```

### Mocking Context Values

```tsx
import { render, screen } from '@testing-library/react';
import { useAuth } from '../contexts/hooks';

// Mock the hook
jest.mock('../contexts/hooks', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Test User', email: 'test@example.com' },
    isAuthenticated: true,
    isLoading: false,
    error: null,
  }),
}));

test('renders with mocked auth', () => {
  render(<UserProfile />);
  expect(screen.getByText('Test User')).toBeInTheDocument();
});
```

## Migration Guide

### From Prop Drilling

**Before:**
```tsx
function App() {
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  
  return (
    <div>
      <Navbar user={user} wallet={wallet} />
      <Dashboard user={user} wallet={wallet} />
      <Settings user={user} wallet={wallet} />
    </div>
  );
}
```

**After:**
```tsx
function App() {
  return (
    <AppProviders>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </Router>
    </AppProviders>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const { wallet } = useWallet();
  
  return (
    <div>
      <Navbar />
      <DashboardContent />
      <Settings />
    </div>
  );
}
```

### From Redux/MobX

**Before:**
```tsx
import { useSelector, useDispatch } from 'react-redux';

function Component() {
  const user = useSelector(state => state.auth.user);
  const dispatch = useDispatch();
  
  const login = (email, password) => {
    dispatch(authActions.login(email, password));
  };
  
  return <div>{user?.name}</div>;
}
```

**After:**
```tsx
import { useAuth } from '../contexts/hooks';

function Component() {
  const { user, login } = useAuth();
  
  return <div>{user?.name}</div>;
}
```

## Troubleshooting

### Common Issues

1. **"Hook must be used within provider"**
   - Ensure component is wrapped with the appropriate provider
   - Check provider hierarchy

2. **State not persisting**
   - Check localStorage usage
   - Verify save functions are called

3. **Performance issues**
   - Use specific hooks instead of combined hooks
   - Implement proper memoization

4. **TypeScript errors**
   - Ensure proper type imports
   - Check interface definitions

### Debug Mode

Enable debug logging in development:

```tsx
// In development
if (process.env.NODE_ENV === 'development') {
  console.log('Auth State:', useAuth());
  console.log('Wallet State:', useWallet());
  console.log('Notification State:', useNotification());
}
```

## Conclusion

This context-based state management system provides:

- ✅ **No prop drilling** - Clean component interfaces
- ✅ **Type safety** - Full TypeScript support
- ✅ **Performance** - Optimized re-renders
- ✅ **Flexibility** - Modular and composable
- ✅ **Testing** - Easy to test and mock
- ✅ **Scalability** - Grows with your application

The system eliminates prop drilling while maintaining clean, testable, and performant code. Use the appropriate hooks for your needs and follow the best practices for optimal results.
