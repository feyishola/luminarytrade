import React from 'react';
import { ErrorBoundary, ErrorBoundaryProvider } from './ErrorBoundaryContext';
import { AuthProvider } from './AuthContext';
import { WalletProvider } from './WalletContext';
import { NotificationProvider } from './NotificationContext';
import { PreferencesProvider } from './PreferencesContext';
import { ContextProviderProps } from './types';

// Individual provider components for selective usage
export const AppErrorBoundary: React.FC<ContextProviderProps> = ({ children }) => (
  <ErrorBoundaryProvider>
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  </ErrorBoundaryProvider>
);

export const AppAuthProvider: React.FC<ContextProviderProps> = ({ children }) => (
  <AuthProvider>
    {children}
  </AuthProvider>
);

export const AppWalletProvider: React.FC<ContextProviderProps> = ({ children }) => (
  <WalletProvider>
    {children}
  </WalletProvider>
);

export const AppNotificationProvider: React.FC<ContextProviderProps> = ({ children }) => (
  <NotificationProvider>
    {children}
  </NotificationProvider>
);

export const AppPreferencesProvider: React.FC<ContextProviderProps> = ({ children }) => (
  <PreferencesProvider>
    {children}
  </PreferencesProvider>
);

// Combined provider with all contexts
export const AppProviders: React.FC<ContextProviderProps> = ({ children }) => {
  return (
    <ErrorBoundaryProvider>
      <ErrorBoundary>
        <AuthProvider>
          <WalletProvider>
            <NotificationProvider>
              <PreferencesProvider>
                {children}
              </PreferencesProvider>
            </NotificationProvider>
          </WalletProvider>
        </AuthProvider>
      </ErrorBoundary>
    </ErrorBoundaryProvider>
  );
};

// Provider composition without error boundary (for use in existing error boundaries)
export const AppStateProviders: React.FC<ContextProviderProps> = ({ children }) => {
  return (
    <AuthProvider>
      <WalletProvider>
        <NotificationProvider>
          <PreferencesProvider>
            {children}
          </PreferencesProvider>
        </NotificationProvider>
      </WalletProvider>
    </AuthProvider>
  );
};

// Minimal providers for authentication-only flows
export const AuthOnlyProviders: React.FC<ContextProviderProps> = ({ children }) => {
  return (
    <ErrorBoundaryProvider>
      <ErrorBoundary>
        <AuthProvider>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </AuthProvider>
      </ErrorBoundary>
    </ErrorBoundaryProvider>
  );
};

// Wallet-focused providers for DeFi flows
export const WalletProviders: React.FC<ContextProviderProps> = ({ children }) => {
  return (
    <ErrorBoundaryProvider>
      <ErrorBoundary>
        <WalletProvider>
          <NotificationProvider>
            <PreferencesProvider>
              {children}
            </PreferencesProvider>
          </NotificationProvider>
        </WalletProvider>
      </ErrorBoundary>
    </ErrorBoundaryProvider>
  );
};

// Development providers with additional debugging
export const DevProviders: React.FC<ContextProviderProps> = ({ children }) => {
  if (process.env.NODE_ENV === 'development') {
    // Add any development-specific providers here
    console.log('🚀 Development providers initialized');
  }

  return (
    <ErrorBoundaryProvider>
      <ErrorBoundary>
        <AuthProvider>
          <WalletProvider>
            <NotificationProvider>
              <PreferencesProvider>
                {children}
              </PreferencesProvider>
            </NotificationProvider>
          </WalletProvider>
        </AuthProvider>
      </ErrorBoundary>
    </ErrorBoundaryProvider>
  );
};

// Provider configuration interface
export interface ProviderConfig {
  withErrorBoundary?: boolean;
  withAuth?: boolean;
  withWallet?: boolean;
  withNotifications?: boolean;
  withPreferences?: boolean;
  development?: boolean;
}

// Configurable provider composition
export const createProviders = (config: ProviderConfig = {}): React.FC<ContextProviderProps> => {
  const {
    withErrorBoundary = true,
    withAuth = true,
    withWallet = true,
    withNotifications = true,
    withPreferences = true,
    development = false,
  } = config;

  const ConfigurableProviders: React.FC<ContextProviderProps> = ({ children }) => {
    let content = children;

    // Wrap providers in reverse order (inner to outer)
    if (withPreferences) {
      content = <PreferencesProvider>{content}</PreferencesProvider>;
    }

    if (withNotifications) {
      content = <NotificationProvider>{content}</NotificationProvider>;
    }

    if (withWallet) {
      content = <WalletProvider>{content}</WalletProvider>;
    }

    if (withAuth) {
      content = <AuthProvider>{content}</AuthProvider>;
    }

    if (withErrorBoundary) {
      content = (
        <ErrorBoundaryProvider>
          <ErrorBoundary>{content}</ErrorBoundary>
        </ErrorBoundaryProvider>
      );
    }

    if (development && process.env.NODE_ENV === 'development') {
      console.log('🔧 Configurable providers initialized with config:', config);
    }

    return <>{content}</>;
  };

  return ConfigurableProviders;
};

// Pre-configured provider sets
export const ProviderSets = {
  // Full application
  full: createProviders({
    withErrorBoundary: true,
    withAuth: true,
    withWallet: true,
    withNotifications: true,
    withPreferences: true,
  }),

  // Public pages (no auth required)
  public: createProviders({
    withErrorBoundary: true,
    withAuth: false,
    withWallet: false,
    withNotifications: true,
    withPreferences: true,
  }),

  // Authenticated pages
  authenticated: createProviders({
    withErrorBoundary: true,
    withAuth: true,
    withWallet: false,
    withNotifications: true,
    withPreferences: true,
  }),

  // Wallet features
  wallet: createProviders({
    withErrorBoundary: true,
    withAuth: true,
    withWallet: true,
    withNotifications: true,
    withPreferences: false,
  }),

  // Minimal (for testing)
  minimal: createProviders({
    withErrorBoundary: false,
    withAuth: false,
    withWallet: false,
    withNotifications: true,
    withPreferences: false,
  }),
};

// Export default full providers
export default AppProviders;
