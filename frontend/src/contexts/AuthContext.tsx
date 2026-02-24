import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api';
import { 
  AuthState, 
  AuthContextType, 
  User, 
  RegisterData,
  ContextProviderProps 
} from './types';

// Action Types
type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'AUTH_FAILURE'; payload: string }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'AUTH_UPDATE_USER'; payload: Partial<User> }
  | { type: 'AUTH_CLEAR_ERROR' }
  | { type: 'AUTH_SET_LOADING'; payload: boolean }
  | { type: 'AUTH_UPDATE_ACTIVITY' }
  | { type: 'AUTH_REFRESH_TOKEN'; payload: string };

// Initial State
const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('authToken'),
  isAuthenticated: false,
  isLoading: false,
  error: null,
  lastActivity: null,
};

// Reducer
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        lastActivity: new Date().toISOString(),
      };

    case 'AUTH_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
        lastActivity: null,
      };

    case 'AUTH_LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        lastActivity: null,
      };

    case 'AUTH_UPDATE_USER':
      return {
        ...state,
        user: state.user ? { ...state.user, ...action.payload } : null,
      };

    case 'AUTH_CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    case 'AUTH_SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'AUTH_UPDATE_ACTIVITY':
      return {
        ...state,
        lastActivity: new Date().toISOString(),
      };

    case 'AUTH_REFRESH_TOKEN':
      return {
        ...state,
        token: action.payload,
        lastActivity: new Date().toISOString(),
      };

    default:
      return state;
  }
};

// Create Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider Component
export const AuthProvider: React.FC<ContextProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize auth state from stored token
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('authToken');
      if (token) {
        try {
          dispatch({ type: 'AUTH_START' });
          apiClient.setAuthToken(token);
          
          const response = await apiClient.get<User>('/auth/me');
          
          dispatch({
            type: 'AUTH_SUCCESS',
            payload: {
              user: response.data,
              token,
            },
          });
        } catch (error) {
          localStorage.removeItem('authToken');
          apiClient.removeAuthToken();
          dispatch({
            type: 'AUTH_FAILURE',
            payload: 'Session expired. Please login again.',
          });
        }
      }
    };

    initializeAuth();
  }, []);

  // Update activity on user interaction
  useEffect(() => {
    const updateActivity = () => {
      if (state.isAuthenticated) {
        dispatch({ type: 'AUTH_UPDATE_ACTIVITY' });
      }
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, updateActivity);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
    };
  }, [state.isAuthenticated]);

  // Auto-logout after inactivity
  useEffect(() => {
    if (!state.isAuthenticated || !state.lastActivity) return;

    const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    const timeoutId = setTimeout(() => {
      dispatch({ type: 'AUTH_LOGOUT' });
      localStorage.removeItem('authToken');
      apiClient.removeAuthToken();
    }, INACTIVITY_TIMEOUT);

    return () => clearTimeout(timeoutId);
  }, [state.lastActivity, state.isAuthenticated]);

  // Login function
  const login = useCallback(async (email: string, password: string) => {
    try {
      dispatch({ type: 'AUTH_START' });
      
      const response = await apiClient.post<{ user: User; token: string }>('/auth/login', {
        email,
        password,
      });

      const { user, token } = response.data;
      
      // Store token
      localStorage.setItem('authToken', token);
      apiClient.setAuthToken(token);

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { user, token },
      });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Login failed';
      dispatch({ type: 'AUTH_FAILURE', payload: message });
      throw error;
    }
  }, []);

  // Register function
  const register = useCallback(async (userData: RegisterData) => {
    try {
      dispatch({ type: 'AUTH_START' });
      
      const response = await apiClient.post<{ user: User; token: string }>('/auth/register', userData);

      const { user, token } = response.data;
      
      // Store token
      localStorage.setItem('authToken', token);
      apiClient.setAuthToken(token);

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { user, token },
      });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Registration failed';
      dispatch({ type: 'AUTH_FAILURE', payload: message });
      throw error;
    }
  }, []);

  // Logout function
  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    apiClient.removeAuthToken();
    dispatch({ type: 'AUTH_LOGOUT' });
  }, []);

  // Refresh token function
  const refreshToken = useCallback(async () => {
    try {
      const response = await apiClient.post<{ token: string }>('/auth/refresh');
      const { token } = response.data;
      
      localStorage.setItem('authToken', token);
      apiClient.setAuthToken(token);
      
      dispatch({ type: 'AUTH_REFRESH_TOKEN', payload: token });
    } catch (error) {
      logout();
      throw error;
    }
  }, [logout]);

  // Update profile function
  const updateProfile = useCallback(async (userData: Partial<User>) => {
    try {
      dispatch({ type: 'AUTH_SET_LOADING', payload: true });
      
      const response = await apiClient.put<User>('/auth/profile', userData);
      
      dispatch({
        type: 'AUTH_UPDATE_USER',
        payload: response.data,
      });
      
      dispatch({ type: 'AUTH_SET_LOADING', payload: false });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Profile update failed';
      dispatch({ type: 'AUTH_FAILURE', payload: message });
      dispatch({ type: 'AUTH_SET_LOADING', payload: false });
      throw error;
    }
  }, []);

  // Change password function
  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    try {
      dispatch({ type: 'AUTH_SET_LOADING', payload: true });
      
      await apiClient.post('/auth/change-password', {
        oldPassword,
        newPassword,
      });
      
      dispatch({ type: 'AUTH_SET_LOADING', payload: false });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Password change failed';
      dispatch({ type: 'AUTH_FAILURE', payload: message });
      dispatch({ type: 'AUTH_SET_LOADING', payload: false });
      throw error;
    }
  }, []);

  // Forgot password function
  const forgotPassword = useCallback(async (email: string) => {
    try {
      dispatch({ type: 'AUTH_SET_LOADING', payload: true });
      
      await apiClient.post('/auth/forgot-password', { email });
      
      dispatch({ type: 'AUTH_SET_LOADING', payload: false });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Password reset request failed';
      dispatch({ type: 'AUTH_FAILURE', payload: message });
      dispatch({ type: 'AUTH_SET_LOADING', payload: false });
      throw error;
    }
  }, []);

  // Reset password function
  const resetPassword = useCallback(async (token: string, newPassword: string) => {
    try {
      dispatch({ type: 'AUTH_SET_LOADING', payload: true });
      
      await apiClient.post('/auth/reset-password', {
        token,
        newPassword,
      });
      
      dispatch({ type: 'AUTH_SET_LOADING', payload: false });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Password reset failed';
      dispatch({ type: 'AUTH_FAILURE', payload: message });
      dispatch({ type: 'AUTH_SET_LOADING', payload: false });
      throw error;
    }
  }, []);

  // Verify email function
  const verifyEmail = useCallback(async (token: string) => {
    try {
      dispatch({ type: 'AUTH_SET_LOADING', payload: true });
      
      const response = await apiClient.post<User>('/auth/verify-email', { token });
      
      dispatch({
        type: 'AUTH_UPDATE_USER',
        payload: { ...response.data, isEmailVerified: true },
      });
      
      dispatch({ type: 'AUTH_SET_LOADING', payload: false });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Email verification failed';
      dispatch({ type: 'AUTH_FAILURE', payload: message });
      dispatch({ type: 'AUTH_SET_LOADING', payload: false });
      throw error;
    }
  }, []);

  // Clear error function
  const clearError = useCallback(() => {
    dispatch({ type: 'AUTH_CLEAR_ERROR' });
  }, []);

  // Set loading function
  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'AUTH_SET_LOADING', payload: loading });
  }, []);

  const contextValue: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    refreshToken,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    verifyEmail,
    clearError,
    setLoading,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Export for testing
export { AuthContext };
