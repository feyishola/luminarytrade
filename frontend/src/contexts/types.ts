// Authentication Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'user' | 'admin' | 'moderator';
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  isEmailVerified: boolean;
  preferences?: UserPreferences;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  lastActivity: string | null;
}

export interface AuthContextType extends AuthState {
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

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  confirmPassword?: string;
}

// Wallet Types
export interface WalletState {
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
}

export interface WalletContextType extends WalletState {
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

export interface Transaction {
  id: string;
  hash: string;
  from: string;
  to: string;
  amount: string;
  gasUsed: string;
  gasPrice: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: string;
  blockNumber?: number;
  data?: string;
}

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  logoURI?: string;
  isNative: boolean;
}

// Notification Types
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number; // in milliseconds, 0 for persistent
  timestamp: string;
  isRead: boolean;
  actions?: NotificationAction[];
  metadata?: Record<string, any>;
}

export interface NotificationAction {
  label: string;
  action: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

export interface NotificationState {
  notifications: Notification[];
  maxNotifications: number;
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

export interface NotificationContextType extends NotificationState {
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

// Preferences Types
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'es' | 'fr' | 'de' | 'zh' | 'ja';
  currency: 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY';
  timezone: string;
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  timeFormat: '12h' | '24h';
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
    inApp: boolean;
  };
  privacy: {
    profileVisibility: 'public' | 'private' | 'friends';
    showOnlineStatus: boolean;
    allowDirectMessages: boolean;
    shareAnalytics: boolean;
  };
  accessibility: {
    highContrast: boolean;
    largeText: boolean;
    reducedMotion: boolean;
    screenReader: boolean;
  };
  dashboard: {
    defaultView: 'overview' | 'transactions' | 'analytics';
    widgets: string[];
    layout: 'grid' | 'list';
  };
}

export interface PreferencesState {
  preferences: UserPreferences;
  isLoading: boolean;
  error: string | null;
  isDirty: boolean; // has unsaved changes
}

export interface PreferencesContextType extends PreferencesState {
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  resetPreferences: () => void;
  savePreferences: () => Promise<void>;
  loadPreferences: () => Promise<void>;
  exportPreferences: () => string;
  importPreferences: (data: string) => void;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

// Error Boundary Types
export interface ErrorInfo {
  componentStack: string;
  errorBoundary: string;
  timestamp: string;
  userAgent: string;
  url: string;
  userId?: string;
}

export interface ErrorState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorHistory: Array<{
    error: Error;
    errorInfo: ErrorInfo;
    timestamp: string;
  }>;
  isReporting: boolean;
}

export interface ErrorBoundaryContextType extends ErrorState {
  setError: (error: Error, errorInfo: ErrorInfo) => void;
  clearError: () => void;
  reportError: (error: Error, errorInfo?: ErrorInfo) => Promise<void>;
  retry: () => void;
  getErrorHistory: () => ErrorState['errorHistory'];
  clearErrorHistory: () => void;
}

// Global App State
export interface AppState {
  isOnline: boolean;
  isMaintenance: boolean;
  version: string;
  buildNumber: string;
  environment: 'development' | 'staging' | 'production';
}

export interface AppContextType extends AppState {
  setOnlineStatus: (isOnline: boolean) => void;
  setMaintenanceMode: (isMaintenance: boolean) => void;
  checkForUpdates: () => Promise<void>;
  getAppInfo: () => { version: string; buildNumber: string };
}

// Context Provider Props
export interface ContextProviderProps {
  children: React.ReactNode;
}

// Hook Return Types
export type UseAuth = AuthContextType;
export type UseWallet = WalletContextType;
export type UseNotification = NotificationContextType;
export type UsePreferences = PreferencesContextType;
export type UseErrorBoundary = ErrorBoundaryContextType;
export type UseApp = AppContextType;
