import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { apiClient } from '../services/api';
import { 
  ErrorState, 
  ErrorBoundaryContextType, 
  ErrorInfo,
  ContextProviderProps 
} from './types';

// Action Types
type ErrorBoundaryAction =
  | { type: 'ERROR_SET'; payload: { error: Error; errorInfo: ErrorInfo } }
  | { type: 'ERROR_CLEAR' }
  | { type: 'ERROR_REPORT_START' }
  | { type: 'ERROR_REPORT_SUCCESS' }
  | { type: 'ERROR_REPORT_FAILURE' }
  | { type: 'ERROR_RETRY' }
  | { type: 'ERROR_CLEAR_HISTORY' };

// Initial State
const initialState: ErrorState = {
  hasError: false,
  error: null,
  errorInfo: null,
  errorHistory: [],
  isReporting: false,
};

// Reducer
const errorBoundaryReducer = (state: ErrorState, action: ErrorBoundaryAction): ErrorState => {
  switch (action.type) {
    case 'ERROR_SET': {
      const errorEntry = {
        error: action.payload.error,
        errorInfo: action.payload.errorInfo,
        timestamp: action.payload.errorInfo.timestamp,
      };
      
      return {
        ...state,
        hasError: true,
        error: action.payload.error,
        errorInfo: action.payload.errorInfo,
        errorHistory: [errorEntry, ...state.errorHistory.slice(0, 49)], // Keep last 50 errors
      };
    }

    case 'ERROR_CLEAR':
      return {
        ...state,
        hasError: false,
        error: null,
        errorInfo: null,
      };

    case 'ERROR_REPORT_START':
      return {
        ...state,
        isReporting: true,
      };

    case 'ERROR_REPORT_SUCCESS':
    case 'ERROR_REPORT_FAILURE':
      return {
        ...state,
        isReporting: false,
      };

    case 'ERROR_RETRY':
      return {
        ...state,
        hasError: false,
        error: null,
        errorInfo: null,
      };

    case 'ERROR_CLEAR_HISTORY':
      return {
        ...state,
        errorHistory: [],
      };

    default:
      return state;
  }
};

// Create Context
const ErrorBoundaryContext = createContext<ErrorBoundaryContextType | undefined>(undefined);

// Provider Component
export const ErrorBoundaryProvider: React.FC<ContextProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(errorBoundaryReducer, initialState);

  // Set error function
  const setError = useCallback((error: Error, errorInfo: ErrorInfo) => {
    dispatch({
      type: 'ERROR_SET',
      payload: { error, errorInfo },
    });
  }, []);

  // Clear error function
  const clearError = useCallback(() => {
    dispatch({ type: 'ERROR_CLEAR' });
  }, []);

  // Report error function
  const reportError = useCallback(async (error: Error, errorInfo?: ErrorInfo) => {
    try {
      dispatch({ type: 'ERROR_REPORT_START' });

      const reportData = {
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack,
        },
        errorInfo: errorInfo || state.errorInfo,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        appVersion: process.env.REACT_APP_VERSION || 'unknown',
        buildNumber: process.env.REACT_APP_BUILD_NUMBER || 'unknown',
      };

      // Send error report to server
      await apiClient.post('/errors/report', reportData);

      dispatch({ type: 'ERROR_REPORT_SUCCESS' });
    } catch (reportError) {
      console.error('Failed to report error:', reportError);
      dispatch({ type: 'ERROR_REPORT_FAILURE' });
    }
  }, [state.errorInfo]);

  // Retry function
  const retry = useCallback(() => {
    dispatch({ type: 'ERROR_RETRY' });
  }, []);

  // Get error history function
  const getErrorHistory = useCallback(() => {
    return state.errorHistory;
  }, [state.errorHistory]);

  // Clear error history function
  const clearErrorHistory = useCallback(() => {
    dispatch({ type: 'ERROR_CLEAR_HISTORY' });
  }, []);

  const contextValue: ErrorBoundaryContextType = {
    ...state,
    setError,
    clearError,
    reportError,
    retry,
    getErrorHistory,
    clearErrorHistory,
  };

  return (
    <ErrorBoundaryContext.Provider value={contextValue}>
      {children}
    </ErrorBoundaryContext.Provider>
  );
};

// Error Boundary Component
interface ErrorBoundaryComponentProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryComponentProps> {
  static contextType = ErrorBoundaryContext;
  context!: React.ContextType<typeof ErrorBoundaryContext>;

  constructor(props: ErrorBoundaryComponentProps) {
    super(props);
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const context = this.context;
    if (!context) return;

    const errorBoundaryInfo: ErrorInfo = {
      componentStack: errorInfo.componentStack || '',
      errorBoundary: 'ErrorBoundary',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Set error in context
    context.setError(error, errorBoundaryInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorBoundaryInfo);
    }

    // Auto-report error
    context.reportError(error, errorBoundaryInfo);
  }

  render() {
    const context = this.context;
    if (context?.hasError) {
      return this.props.fallback || (
        <ErrorFallback
          error={context.error}
          errorInfo={context.errorInfo}
          onRetry={context.retry}
          onReport={() => context.reportError(context.error!, context.errorInfo!)}
          isReporting={context.isReporting}
        />
      );
    }

    return this.props.children;
  }
}

// Error Fallback Component
interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onRetry: () => void;
  onReport: () => void;
  isReporting: boolean;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorInfo,
  onRetry,
  onReport,
  isReporting,
}) => {
  return (
    <div style={{
      padding: '20px',
      textAlign: 'center',
      backgroundColor: '#fff5f5',
      border: '1px solid #fed7d7',
      borderRadius: '8px',
      margin: '20px',
    }}>
      <h2 style={{ color: '#e53e3e', marginBottom: '16px' }}>
        Something went wrong
      </h2>
      
      <p style={{ color: '#742a2a', marginBottom: '16px' }}>
        We're sorry, but something unexpected happened. Our team has been notified.
      </p>

      {process.env.NODE_ENV === 'development' && error && (
        <details style={{ 
          textAlign: 'left', 
          backgroundColor: '#f7fafc', 
          padding: '16px', 
          borderRadius: '4px',
          marginBottom: '16px',
          fontSize: '12px',
          fontFamily: 'monospace'
        }}>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '8px' }}>
            Error Details
          </summary>
          <p><strong>Error:</strong> {error.toString()}</p>
          <p><strong>Stack:</strong></p>
          <pre style={{ whiteSpace: 'pre-wrap', backgroundColor: '#edf2f7', padding: '8px', borderRadius: '4px' }}>
            {error.stack}
          </pre>
          {errorInfo && (
            <>
              <p><strong>Component Stack:</strong></p>
              <pre style={{ whiteSpace: 'pre-wrap', backgroundColor: '#edf2f7', padding: '8px', borderRadius: '4px' }}>
                {errorInfo.componentStack}
              </pre>
            </>
          )}
        </details>
      )}

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={onRetry}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3182ce',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Try Again
        </button>

        <button
          onClick={onReport}
          disabled={isReporting}
          style={{
            padding: '8px 16px',
            backgroundColor: isReporting ? '#a0aec0' : '#48bb78',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isReporting ? 'not-allowed' : 'pointer',
            fontSize: '14px',
          }}
        >
          {isReporting ? 'Reporting...' : 'Report Issue'}
        </button>

        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '8px 16px',
            backgroundColor: '#718096',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Reload Page
        </button>
      </div>
    </div>
  );
};

// Custom hook
export const useErrorBoundary = (): ErrorBoundaryContextType => {
  const context = useContext(ErrorBoundaryContext);
  if (context === undefined) {
    throw new Error('useErrorBoundary must be used within an ErrorBoundaryProvider');
  }
  return context;
};

// Export for testing
export { ErrorBoundaryContext };

// Higher-order component for error boundaries
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback} onError={onError}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};
