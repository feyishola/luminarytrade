import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as authApi from "../services/auth";

export interface AuthState {
  user: authApi.AuthUser | null;
  accessToken: string | null;
  csrfToken: string | null;
  loading: boolean;
  error: string | null;
  sessionExpiresAt: string | null;
}

export interface AuthContextValue extends AuthState {
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithWallet: (params: {
    publicKey: string;
    message: string;
    signature: string;
  }) => Promise<void>;
  loginWithSocial: (params: {
    provider: string;
    token: string;
    email?: string;
  }) => Promise<void>;
  signup: (email: string, password: string, publicKey?: string) => Promise<authApi.SignupResponse>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refresh: () => Promise<void>;
  hasRole: (role: string) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const LOGOUT_EVENT_KEY = "auth:logout";

function decodeJwtExpiry(token: string): number | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(base64));
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    csrfToken: null,
    loading: true,
    error: null,
    sessionExpiresAt: null,
  });

  const refreshInFlight = useRef<Promise<void> | null>(null);
  const refreshTimer = useRef<number | null>(null);
  const sessionTimer = useRef<number | null>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  const clearTimers = useCallback(() => {
    if (refreshTimer.current) {
      window.clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
    if (sessionTimer.current) {
      window.clearTimeout(sessionTimer.current);
      sessionTimer.current = null;
    }
  }, []);

  const setSession = useCallback(
    (response: authApi.AuthResponse) => {
      clearTimers();
      setState((prev) => ({
        ...prev,
        user: response.user,
        accessToken: response.accessToken,
        csrfToken: response.csrfToken,
        sessionExpiresAt: response.sessionExpiresAt,
        error: null,
        loading: false,
      }));

      const exp = decodeJwtExpiry(response.accessToken);
      if (exp) {
        const refreshAt = exp - Date.now() - 60_000;
        if (refreshAt > 0) {
          refreshTimer.current = window.setTimeout(() => {
            void refreshRef.current();
          }, refreshAt);
        } else {
          void refreshRef.current();
        }
      }

      const sessionExpiryMs = Date.parse(response.sessionExpiresAt);
      if (!Number.isNaN(sessionExpiryMs)) {
        const msUntilExpiry = sessionExpiryMs - Date.now();
        if (msUntilExpiry > 0) {
          sessionTimer.current = window.setTimeout(() => {
            void logout();
          }, msUntilExpiry);
        }
      }
    },
    [clearTimers],
  );

  const setError = useCallback((error: unknown) => {
    setState((prev) => ({
      ...prev,
      error: error instanceof Error ? error.message : "Unexpected error",
    }));
  }, []);

  const ensureCsrf = useCallback(async () => {
    const existing = state.csrfToken || getCookie("csrf_token");
    if (existing) {
      setState((prev) => ({ ...prev, csrfToken: existing }));
      return existing;
    }

    const token = await authApi.getCsrfToken();
    setState((prev) => ({ ...prev, csrfToken: token }));
    return token;
  }, [state.csrfToken]);

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) {
      return refreshInFlight.current;
    }

    refreshInFlight.current = (async () => {
      try {
        const csrfToken = await ensureCsrf();
        const response = await authApi.refresh(csrfToken);
        setSession(response);
      } catch (error) {
        setState((prev) => ({
          ...prev,
          user: null,
          accessToken: null,
          sessionExpiresAt: null,
          loading: false,
        }));
      } finally {
        refreshInFlight.current = null;
      }
    })();

    return refreshInFlight.current;
  }, [ensureCsrf, setSession]);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    try {
      setState((prev) => ({ ...prev, loading: true }));
      const response = await authApi.loginWithEmail(email, password);
      setSession(response);
    } catch (error) {
      setError(error);
      setState((prev) => ({ ...prev, loading: false }));
      throw error;
    }
  }, [setError, setSession]);

  const loginWithWallet = useCallback(async (params: {
    publicKey: string;
    message: string;
    signature: string;
  }) => {
    try {
      setState((prev) => ({ ...prev, loading: true }));
      const response = await authApi.loginWithWallet(params);
      setSession(response);
    } catch (error) {
      setError(error);
      setState((prev) => ({ ...prev, loading: false }));
      throw error;
    }
  }, [setError, setSession]);

  const loginWithSocial = useCallback(async (params: {
    provider: string;
    token: string;
    email?: string;
  }) => {
    try {
      setState((prev) => ({ ...prev, loading: true }));
      const response = await authApi.loginWithSocial(params);
      setSession(response);
    } catch (error) {
      setError(error);
      setState((prev) => ({ ...prev, loading: false }));
      throw error;
    }
  }, [setError, setSession]);

  const signup = useCallback(async (email: string, password: string, publicKey?: string) => {
    try {
      setState((prev) => ({ ...prev, loading: true }));
      const response = await authApi.signup(email, password, publicKey);
      setState((prev) => ({ ...prev, loading: false }));
      return response;
    } catch (error) {
      setError(error);
      setState((prev) => ({ ...prev, loading: false }));
      throw error;
    }
  }, [setError]);

  const logout = useCallback(async () => {
    try {
      const csrfToken = await ensureCsrf();
      await authApi.logout(csrfToken);
    } catch (error) {
      // Ignore logout errors to ensure local cleanup
    } finally {
      clearTimers();
      setState((prev) => ({
        ...prev,
        user: null,
        accessToken: null,
        sessionExpiresAt: null,
        loading: false,
      }));
      localStorage.setItem(LOGOUT_EVENT_KEY, Date.now().toString());
    }
  }, [clearTimers, ensureCsrf]);

  const logoutAll = useCallback(async () => {
    try {
      const csrfToken = await ensureCsrf();
      await authApi.logoutAll(csrfToken);
    } catch {
      // ignore network errors
    } finally {
      clearTimers();
      setState((prev) => ({
        ...prev,
        user: null,
        accessToken: null,
        sessionExpiresAt: null,
        loading: false,
      }));
      localStorage.setItem(LOGOUT_EVENT_KEY, Date.now().toString());
    }
  }, [clearTimers, ensureCsrf]);

  const hasRole = useCallback(
    (role: string) => {
      return state.user?.roles?.includes(role) ?? false;
    },
    [state.user],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === LOGOUT_EVENT_KEY) {
        clearTimers();
        setState((prev) => ({
          ...prev,
          user: null,
          accessToken: null,
          sessionExpiresAt: null,
          loading: false,
        }));
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [clearTimers]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      loginWithEmail,
      loginWithWallet,
      loginWithSocial,
      signup,
      logout,
      logoutAll,
      refresh,
      hasRole,
    }),
    [
      state,
      loginWithEmail,
      loginWithWallet,
      loginWithSocial,
      signup,
      logout,
      logoutAll,
      refresh,
      hasRole,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}
