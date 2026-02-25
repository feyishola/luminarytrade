import React from 'react';
import { useAuth } from '../AuthContext';
import { useWallet } from '../WalletContext';
import {
  useNotification,
  createSuccessNotification,
  createErrorNotification,
  createWarningNotification,
  createInfoNotification,
} from '../NotificationContext';
import {
  usePreferences,
  useThemePreferences,
  useNotificationPreferences,
  useAccessibilityPreferences,
} from '../PreferencesContext';
import { useErrorBoundary } from '../ErrorBoundaryContext';

// Export all custom hooks from contexts
export { useAuth } from '../AuthContext';
export { useWallet } from '../WalletContext';
export { useNotification, 
  createSuccessNotification, 
  createErrorNotification, 
  createWarningNotification, 
  createInfoNotification 
} from '../NotificationContext';
export { usePreferences, 
  useThemePreferences, 
  useNotificationPreferences, 
  useAccessibilityPreferences 
} from '../PreferencesContext';
export { useErrorBoundary } from '../ErrorBoundaryContext';

// Combined hooks for common use cases
export const useAppState = () => {
  const auth = useAuth();
  const wallet = useWallet();
  const notification = useNotification();
  const preferences = usePreferences();
  const errorBoundary = useErrorBoundary();

  return {
    auth,
    wallet,
    notification,
    preferences,
    errorBoundary,
    isLoading: auth.isLoading || wallet.isLoading || preferences.isLoading,
    hasError: !!auth.error || !!wallet.error || !!preferences.error || errorBoundary.hasError,
  };
};

// Hook for authenticated user state
export const useAuthenticatedUser = () => {
  const auth = useAuth();
  const notification = useNotification();

  if (!auth.isAuthenticated) {
    throw new Error('User must be authenticated to use this hook');
  }

  return {
    user: auth.user!,
    token: auth.token!,
    logout: auth.logout,
    updateProfile: auth.updateProfile,
    // Add notification helpers
    showSuccess: (message: string, title?: string) => {
      notification.addNotification(createSuccessNotification(message, title));
    },
    showError: (message: string, title?: string) => {
      notification.addNotification(createErrorNotification(message, title));
    },
  };
};

// Hook for wallet operations
export const useWalletOperations = () => {
  const wallet = useWallet();
  const notification = useNotification();

  const connectWithNotification = async (provider: typeof wallet.provider) => {
    try {
      await wallet.connect(provider);
      notification.addNotification(createSuccessNotification(
        `Wallet connected successfully to ${provider}`,
        'Wallet Connected'
      ));
    } catch (error: any) {
      notification.addNotification(createErrorNotification(
        error.message || 'Failed to connect wallet',
        'Connection Failed'
      ));
      throw error;
    }
  };

  const disconnectWithNotification = () => {
    wallet.disconnect();
    notification.addNotification(createInfoNotification(
      'Wallet disconnected',
      'Wallet Disconnected'
    ));
  };

  const sendTransactionWithNotification = async (to: string, amount: string, data?: string) => {
    try {
      const tx = await wallet.sendTransaction(to, amount, data);
      notification.addNotification(createSuccessNotification(
        `Transaction sent: ${tx.hash}`,
        'Transaction Successful'
      ));
      return tx;
    } catch (error: any) {
      notification.addNotification(createErrorNotification(
        error.message || 'Transaction failed',
        'Transaction Failed'
      ));
      throw error;
    }
  };

  return {
    ...wallet,
    connect: connectWithNotification,
    disconnect: disconnectWithNotification,
    sendTransaction: sendTransactionWithNotification,
  };
};

// Hook for global notifications
export const useGlobalNotifications = () => {
  const notification = useNotification();
  const auth = useAuth();
  const wallet = useWallet();

  // Auto-notify on auth state changes
  React.useEffect(() => {
    if (auth.isAuthenticated && auth.user && !auth.isLoading) {
      notification.addNotification(createSuccessNotification(
        `Welcome back, ${auth.user.name}!`,
        'Login Successful'
      ));
    }
  }, [auth.isAuthenticated, auth.user, auth.isLoading, notification]);

  // Auto-notify on wallet connection
  React.useEffect(() => {
    if (wallet.isConnected && wallet.address && !wallet.isLoading) {
      notification.addNotification(createSuccessNotification(
        `Wallet connected: ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`,
        'Wallet Connected'
      ));
    }
  }, [wallet.isConnected, wallet.address, wallet.isLoading, notification]);

  return notification;
};

// Hook for error handling
export const useErrorHandler = () => {
  const errorBoundary = useErrorBoundary();
  const notification = useNotification();

  const handleError = React.useCallback((error: Error, context?: string) => {
    // Add notification
    notification.addNotification(createErrorNotification(
      error.message,
      context ? `Error in ${context}` : 'Application Error'
    ));

    // Report to error boundary
    errorBoundary.reportError(error, {
      componentStack: context || 'Unknown',
      errorBoundary: 'useErrorHandler',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    });
  }, [errorBoundary, notification]);

  const handleAsyncError = React.useCallback(async (
    asyncFn: () => Promise<any>,
    context?: string
  ) => {
    try {
      return await asyncFn();
    } catch (error) {
      handleError(error as Error, context);
      throw error;
    }
  }, [handleError]);

  return {
    handleError,
    handleAsyncError,
    hasError: errorBoundary.hasError,
    error: errorBoundary.error,
    retry: errorBoundary.retry,
  };
};

// Hook for application state persistence
export const useAppStatePersistence = () => {
  const auth = useAuth();
  const wallet = useWallet();
  const preferences = usePreferences();

  const saveState = React.useCallback(() => {
    const state = {
      auth: {
        isAuthenticated: auth.isAuthenticated,
        user: auth.user,
        lastActivity: auth.lastActivity,
      },
      wallet: {
        isConnected: wallet.isConnected,
        address: wallet.address,
        provider: wallet.provider,
        network: wallet.network,
      },
      preferences: preferences.preferences,
    };

    try {
      localStorage.setItem('appState', JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save app state:', error);
    }
  }, [auth, wallet, preferences]);

  const loadState = React.useCallback(() => {
    try {
      const saved = localStorage.getItem('appState');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load app state:', error);
    }
    return null;
  }, []);

  const clearState = React.useCallback(() => {
    localStorage.removeItem('appState');
  }, []);

  return {
    saveState,
    loadState,
    clearState,
  };
};
