import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api';
import { 
  PreferencesState, 
  PreferencesContextType, 
  UserPreferences,
  ContextProviderProps 
} from './types';

// Action Types
type PreferencesAction =
  | { type: 'PREFERENCES_UPDATE'; payload: Partial<UserPreferences> }
  | { type: 'PREFERENCES_RESET' }
  | { type: 'PREFERENCES_SET_LOADING'; payload: boolean }
  | { type: 'PREFERENCES_SET_ERROR'; payload: string }
  | { type: 'PREFERENCES_CLEAR_ERROR' }
  | { type: 'PREFERENCES_SET_DIRTY'; payload: boolean }
  | { type: 'PREFERENCES_LOAD'; payload: UserPreferences };

// Default preferences
const defaultPreferences: UserPreferences = {
  theme: 'system',
  language: 'en',
  currency: 'USD',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '12h',
  notifications: {
    email: true,
    push: true,
    sms: false,
    inApp: true,
  },
  privacy: {
    profileVisibility: 'public',
    showOnlineStatus: true,
    allowDirectMessages: true,
    shareAnalytics: false,
  },
  accessibility: {
    highContrast: false,
    largeText: false,
    reducedMotion: false,
    screenReader: false,
  },
  dashboard: {
    defaultView: 'overview',
    widgets: ['balance', 'transactions', 'chart'],
    layout: 'grid',
  },
};

// Initial State
const initialState: PreferencesState = {
  preferences: defaultPreferences,
  isLoading: false,
  error: null,
  isDirty: false,
};

// Reducer
const preferencesReducer = (state: PreferencesState, action: PreferencesAction): PreferencesState => {
  switch (action.type) {
    case 'PREFERENCES_UPDATE':
      return {
        ...state,
        preferences: { ...state.preferences, ...action.payload },
        isDirty: true,
      };

    case 'PREFERENCES_RESET':
      return {
        ...state,
        preferences: defaultPreferences,
        isDirty: true,
      };

    case 'PREFERENCES_SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'PREFERENCES_SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case 'PREFERENCES_CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    case 'PREFERENCES_SET_DIRTY':
      return {
        ...state,
        isDirty: action.payload,
      };

    case 'PREFERENCES_LOAD':
      return {
        ...state,
        preferences: action.payload,
        isLoading: false,
        error: null,
        isDirty: false,
      };

    default:
      return state;
  }
};

// Create Context
const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

// Provider Component
export const PreferencesProvider: React.FC<ContextProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(preferencesReducer, initialState);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const loadLocalPreferences = () => {
      try {
        const savedPreferences = localStorage.getItem('userPreferences');
        if (savedPreferences) {
          const parsed = JSON.parse(savedPreferences);
          dispatch({ type: 'PREFERENCES_LOAD', payload: { ...defaultPreferences, ...parsed } });
        }
      } catch (error) {
        console.error('Failed to load preferences from localStorage:', error);
      }
    };

    loadLocalPreferences();
  }, []);

  // Apply theme changes to document
  useEffect(() => {
    const { theme } = state.preferences;
    
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [state.preferences.theme]);

  // Apply accessibility settings
  useEffect(() => {
    const { accessibility } = state.preferences;
    
    document.documentElement.setAttribute('data-high-contrast', accessibility.highContrast.toString());
    document.documentElement.setAttribute('data-large-text', accessibility.largeText.toString());
    document.documentElement.setAttribute('data-reduced-motion', accessibility.reducedMotion.toString());
    document.documentElement.setAttribute('data-screen-reader', accessibility.screenReader.toString());
  }, [state.preferences.accessibility]);

  // Update preferences function
  const updatePreferences = useCallback((updates: Partial<UserPreferences>) => {
    dispatch({ type: 'PREFERENCES_UPDATE', payload: updates });
  }, []);

  // Reset preferences function
  const resetPreferences = useCallback(() => {
    dispatch({ type: 'PREFERENCES_RESET' });
  }, []);

  // Save preferences to localStorage
  const saveToLocalStorage = useCallback(() => {
    try {
      localStorage.setItem('userPreferences', JSON.stringify(state.preferences));
    } catch (error) {
      console.error('Failed to save preferences to localStorage:', error);
    }
  }, [state.preferences]);

  // Save preferences to server
  const savePreferences = useCallback(async () => {
    try {
      dispatch({ type: 'PREFERENCES_SET_LOADING', payload: true });
      
      await apiClient.post('/user/preferences', state.preferences);
      
      // Save to localStorage as backup
      saveToLocalStorage();
      
      dispatch({ type: 'PREFERENCES_SET_DIRTY', payload: false });
      dispatch({ type: 'PREFERENCES_SET_LOADING', payload: false });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to save preferences';
      dispatch({ type: 'PREFERENCES_SET_ERROR', payload: message });
      throw error;
    }
  }, [state.preferences, saveToLocalStorage]);

  // Load preferences from server
  const loadPreferences = useCallback(async () => {
    try {
      dispatch({ type: 'PREFERENCES_SET_LOADING', payload: true });
      
      const response = await apiClient.get<UserPreferences>('/user/preferences');
      
      dispatch({ type: 'PREFERENCES_LOAD', payload: response.data });
      
      // Also save to localStorage
      saveToLocalStorage();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to load preferences';
      dispatch({ type: 'PREFERENCES_SET_ERROR', payload: message });
      
      // If server fails, try to load from localStorage
      const savedPreferences = localStorage.getItem('userPreferences');
      if (savedPreferences) {
        try {
          const parsed = JSON.parse(savedPreferences);
          dispatch({ type: 'PREFERENCES_LOAD', payload: { ...defaultPreferences, ...parsed } });
        } catch (parseError) {
          console.error('Failed to parse saved preferences:', parseError);
        }
      }
    }
  }, [saveToLocalStorage]);

  // Export preferences as JSON string
  const exportPreferences = useCallback((): string => {
    return JSON.stringify(state.preferences, null, 2);
  }, [state.preferences]);

  // Import preferences from JSON string
  const importPreferences = useCallback((data: string) => {
    try {
      const parsed = JSON.parse(data);
      
      // Validate the imported data
      const validatedPreferences = validatePreferences(parsed);
      
      dispatch({ type: 'PREFERENCES_UPDATE', payload: validatedPreferences });
    } catch (error) {
      dispatch({ type: 'PREFERENCES_SET_ERROR', payload: 'Invalid preferences data' });
      throw error;
    }
  }, []);

  // Validate imported preferences
  const validatePreferences = useCallback((data: any): Partial<UserPreferences> => {
    const validated: Partial<UserPreferences> = {};
    
    // Validate theme
    if (['light', 'dark', 'system'].includes(data.theme)) {
      validated.theme = data.theme;
    }
    
    // Validate language
    if (['en', 'es', 'fr', 'de', 'zh', 'ja'].includes(data.language)) {
      validated.language = data.language;
    }
    
    // Validate currency
    if (['USD', 'EUR', 'GBP', 'JPY', 'CNY'].includes(data.currency)) {
      validated.currency = data.currency;
    }
    
    // Validate nested objects
    if (data.notifications && typeof data.notifications === 'object') {
      validated.notifications = { ...defaultPreferences.notifications, ...data.notifications };
    }
    
    if (data.privacy && typeof data.privacy === 'object') {
      validated.privacy = { ...defaultPreferences.privacy, ...data.privacy };
    }
    
    if (data.accessibility && typeof data.accessibility === 'object') {
      validated.accessibility = { ...defaultPreferences.accessibility, ...data.accessibility };
    }
    
    if (data.dashboard && typeof data.dashboard === 'object') {
      validated.dashboard = { ...defaultPreferences.dashboard, ...data.dashboard };
    }
    
    return validated;
  }, []);

  // Clear error function
  const clearError = useCallback(() => {
    dispatch({ type: 'PREFERENCES_CLEAR_ERROR' });
  }, []);

  // Set loading function
  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'PREFERENCES_SET_LOADING', payload: loading });
  }, []);

  // Auto-save preferences when they change (debounced)
  useEffect(() => {
    if (!state.isDirty) return;

    const timeoutId = setTimeout(() => {
      saveToLocalStorage();
    }, 1000); // Debounce for 1 second

    return () => clearTimeout(timeoutId);
  }, [state.preferences, state.isDirty, saveToLocalStorage]);

  const contextValue: PreferencesContextType = {
    ...state,
    updatePreferences,
    resetPreferences,
    savePreferences,
    loadPreferences,
    exportPreferences,
    importPreferences,
    clearError,
    setLoading,
  };

  return (
    <PreferencesContext.Provider value={contextValue}>
      {children}
    </PreferencesContext.Provider>
  );
};

// Custom hook
export const usePreferences = (): PreferencesContextType => {
  const context = useContext(PreferencesContext);
  if (context === undefined) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
};

// Export for testing
export { PreferencesContext };

// Utility functions for common preference updates
export const useThemePreferences = () => {
  const { preferences, updatePreferences } = usePreferences();
  
  const setTheme = (theme: UserPreferences['theme']) => {
    updatePreferences({ theme });
  };
  
  const toggleTheme = () => {
    const newTheme = preferences.theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };
  
  return {
    theme: preferences.theme,
    setTheme,
    toggleTheme,
  };
};

export const useNotificationPreferences = () => {
  const { preferences, updatePreferences } = usePreferences();
  
  const updateNotificationSettings = (settings: Partial<UserPreferences['notifications']>) => {
    updatePreferences({
      notifications: { ...preferences.notifications, ...settings },
    });
  };
  
  return {
    notifications: preferences.notifications,
    updateNotificationSettings,
  };
};

export const useAccessibilityPreferences = () => {
  const { preferences, updatePreferences } = usePreferences();
  
  const updateAccessibilitySettings = (settings: Partial<UserPreferences['accessibility']>) => {
    updatePreferences({
      accessibility: { ...preferences.accessibility, ...settings },
    });
  };
  
  return {
    accessibility: preferences.accessibility,
    updateAccessibilitySettings,
  };
};
