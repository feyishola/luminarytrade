import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { 
  NotificationState, 
  NotificationContextType, 
  Notification, 
  NotificationAction,
  ContextProviderProps 
} from './types';

// Action Types
type NotificationActionType =
  | { type: 'NOTIFICATION_ADD'; payload: Notification }
  | { type: 'NOTIFICATION_REMOVE'; payload: string }
  | { type: 'NOTIFICATION_CLEAR_ALL' }
  | { type: 'NOTIFICATION_MARK_READ'; payload: string }
  | { type: 'NOTIFICATION_MARK_ALL_READ' }
  | { type: 'NOTIFICATION_UPDATE'; payload: { id: string; updates: Partial<Notification> } }
  | { type: 'NOTIFICATION_SET_MAX'; payload: number }
  | { type: 'NOTIFICATION_SET_POSITION'; payload: NotificationState['position'] }
  | { type: 'NOTIFICATION_SET_SOUND_ENABLED'; payload: boolean }
  | { type: 'NOTIFICATION_SET_VIBRATION_ENABLED'; payload: boolean };

// Initial State
const initialState: NotificationState = {
  notifications: [],
  maxNotifications: 5,
  position: 'top-right',
  soundEnabled: true,
  vibrationEnabled: true,
};

// Reducer
const notificationReducer = (state: NotificationState, action: NotificationActionType): NotificationState => {
  switch (action.type) {
    case 'NOTIFICATION_ADD': {
      const newNotifications = [action.payload, ...state.notifications];
      
      // Remove oldest notifications if exceeding max
      if (newNotifications.length > state.maxNotifications) {
        newNotifications.splice(state.maxNotifications);
      }
      
      return {
        ...state,
        notifications: newNotifications,
      };
    }

    case 'NOTIFICATION_REMOVE':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload),
      };

    case 'NOTIFICATION_CLEAR_ALL':
      return {
        ...state,
        notifications: [],
      };

    case 'NOTIFICATION_MARK_READ':
      return {
        ...state,
        notifications: state.notifications.map(n =>
          n.id === action.payload ? { ...n, isRead: true } : n
        ),
      };

    case 'NOTIFICATION_MARK_ALL_READ':
      return {
        ...state,
        notifications: state.notifications.map(n => ({ ...n, isRead: true })),
      };

    case 'NOTIFICATION_UPDATE':
      return {
        ...state,
        notifications: state.notifications.map(n =>
          n.id === action.payload.id ? { ...n, ...action.payload.updates } : n
        ),
      };

    case 'NOTIFICATION_SET_MAX':
      return {
        ...state,
        maxNotifications: action.payload,
        // Trim notifications if needed
        notifications: state.notifications.slice(0, action.payload),
      };

    case 'NOTIFICATION_SET_POSITION':
      return {
        ...state,
        position: action.payload,
      };

    case 'NOTIFICATION_SET_SOUND_ENABLED':
      return {
        ...state,
        soundEnabled: action.payload,
      };

    case 'NOTIFICATION_SET_VIBRATION_ENABLED':
      return {
        ...state,
        vibrationEnabled: action.payload,
      };

    default:
      return state;
  }
};

// Create Context
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Provider Component
export const NotificationProvider: React.FC<ContextProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, initialState);
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('notificationSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (settings.maxNotifications) {
          dispatch({ type: 'NOTIFICATION_SET_MAX', payload: settings.maxNotifications });
        }
        if (settings.position) {
          dispatch({ type: 'NOTIFICATION_SET_POSITION', payload: settings.position });
        }
        if (typeof settings.soundEnabled === 'boolean') {
          dispatch({ type: 'NOTIFICATION_SET_SOUND_ENABLED', payload: settings.soundEnabled });
        }
        if (typeof settings.vibrationEnabled === 'boolean') {
          dispatch({ type: 'NOTIFICATION_SET_VIBRATION_ENABLED', payload: settings.vibrationEnabled });
        }
      } catch (error) {
        console.error('Failed to load notification settings:', error);
      }
    }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    const settings = {
      maxNotifications: state.maxNotifications,
      position: state.position,
      soundEnabled: state.soundEnabled,
      vibrationEnabled: state.vibrationEnabled,
    };
    localStorage.setItem('notificationSettings', JSON.stringify(settings));
  }, [state.maxNotifications, state.position, state.soundEnabled, state.vibrationEnabled]);

  // Play sound notification
  const playSound = useCallback(() => {
    if (!state.soundEnabled) return;

    try {
      const audio = new Audio('/notification-sound.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Ignore errors (user might not have interacted with page yet)
      });
    } catch (error) {
      // Ignore audio errors
    }
  }, [state.soundEnabled]);

  // Vibrate device
  const vibrate = useCallback(() => {
    if (!state.vibrationEnabled || !navigator.vibrate) return;

    try {
      navigator.vibrate([200, 100, 200]);
    } catch (error) {
      // Ignore vibration errors
    }
  }, [state.vibrationEnabled]);

  // Add notification function
  const addNotification = useCallback((
    notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>
  ): string => {
    const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: new Date().toISOString(),
      isRead: false,
    };

    dispatch({ type: 'NOTIFICATION_ADD', payload: newNotification });

    // Play sound and vibrate for new notifications
    if (notification.type === 'success' || notification.type === 'error') {
      playSound();
      vibrate();
    }

    // Auto-remove notification after duration (if specified)
    if (notification.duration && notification.duration > 0) {
      const timeout = setTimeout(() => {
        removeNotification(id);
      }, notification.duration);
      
      timeoutsRef.current.set(id, timeout);
    }

    return id;
  }, [playSound, vibrate]);

  // Remove notification function
  const removeNotification = useCallback((id: string) => {
    // Clear timeout if exists
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
    
    dispatch({ type: 'NOTIFICATION_REMOVE', payload: id });
  }, []);

  // Clear all notifications function
  const clearNotifications = useCallback(() => {
    // Clear all timeouts
    timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    timeoutsRef.current.clear();
    
    dispatch({ type: 'NOTIFICATION_CLEAR_ALL' });
  }, []);

  // Mark as read function
  const markAsRead = useCallback((id: string) => {
    dispatch({ type: 'NOTIFICATION_MARK_READ', payload: id });
  }, []);

  // Mark all as read function
  const markAllAsRead = useCallback(() => {
    dispatch({ type: 'NOTIFICATION_MARK_ALL_READ' });
  }, []);

  // Update notification function
  const updateNotification = useCallback((id: string, updates: Partial<Notification>) => {
    dispatch({ type: 'NOTIFICATION_UPDATE', payload: { id, updates } });
  }, []);

  // Set max notifications function
  const setMaxNotifications = useCallback((max: number) => {
    dispatch({ type: 'NOTIFICATION_SET_MAX', payload: max });
  }, []);

  // Set position function
  const setPosition = useCallback((position: NotificationState['position']) => {
    dispatch({ type: 'NOTIFICATION_SET_POSITION', payload: position });
  }, []);

  // Set sound enabled function
  const setSoundEnabled = useCallback((enabled: boolean) => {
    dispatch({ type: 'NOTIFICATION_SET_SOUND_ENABLED', payload: enabled });
  }, []);

  // Set vibration enabled function
  const setVibrationEnabled = useCallback((enabled: boolean) => {
    dispatch({ type: 'NOTIFICATION_SET_VIBRATION_ENABLED', payload: enabled });
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      timeoutsRef.current.clear();
    };
  }, []);

  const contextValue: NotificationContextType = {
    ...state,
    addNotification,
    removeNotification,
    clearNotifications,
    markAsRead,
    markAllAsRead,
    updateNotification,
    setMaxNotifications,
    setPosition,
    setSoundEnabled,
    setVibrationEnabled,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

// Custom hook
export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

// Export for testing
export { NotificationContext };

// Convenience functions for common notification types
export const createSuccessNotification = (
  message: string,
  title?: string,
  duration?: number
): Omit<Notification, 'id' | 'timestamp' | 'isRead'> => ({
  type: 'success',
  title: title || 'Success',
  message,
  duration: duration || 5000,
});

export const createErrorNotification = (
  message: string,
  title?: string,
  duration?: number
): Omit<Notification, 'id' | 'timestamp' | 'isRead'> => ({
  type: 'error',
  title: title || 'Error',
  message,
  duration: duration || 8000,
});

export const createWarningNotification = (
  message: string,
  title?: string,
  duration?: number
): Omit<Notification, 'id' | 'timestamp' | 'isRead'> => ({
  type: 'warning',
  title: title || 'Warning',
  message,
  duration: duration || 6000,
});

export const createInfoNotification = (
  message: string,
  title?: string,
  duration?: number
): Omit<Notification, 'id' | 'timestamp' | 'isRead'> => ({
  type: 'info',
  title: title || 'Info',
  message,
  duration: duration || 4000,
});
