export interface AuthUser {
  id: string;
  email: string | null;
  publicKey: string | null;
  roles: string[];
  tier: string;
  emailVerified: boolean;
}

export interface AuthSession {
  id: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  revokedAt: string | null;
}

export interface AuthResponse {
  accessToken: string;
  csrfToken: string;
  session: AuthSession;
  sessionExpiresAt: string;
  user: AuthUser;
}

export interface SignupResponse {
  user: AuthUser;
  emailVerificationRequired: boolean;
  verificationToken?: string;
}

export interface AuthError extends Error {
  status?: number;
}

const BASE_URL =
  (window as any).__ENV__?.REACT_APP_API_BASE_URL ??
  "http://localhost:3001/api";

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as T) : ({} as T);

  if (!response.ok) {
    const error: AuthError = new Error(
      (data as any)?.message || `Request failed with status ${response.status}`,
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

export async function getCsrfToken(): Promise<string> {
  const data = await request<{ csrfToken: string }>("/auth/csrf", {
    method: "GET",
  });
  return data.csrfToken;
}

export async function signup(
  email: string,
  password: string,
  publicKey?: string,
): Promise<SignupResponse> {
  return request<SignupResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, publicKey }),
  });
}

export async function loginWithEmail(
  email: string,
  password: string,
): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function loginWithWallet(params: {
  publicKey: string;
  message: string;
  signature: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/wallet/login", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function loginWithSocial(params: {
  provider: string;
  token: string;
  email?: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/social/login", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function refresh(csrfToken: string): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/refresh", {
    method: "POST",
    headers: { "X-CSRF-Token": csrfToken },
  });
}

export async function logout(csrfToken: string): Promise<void> {
  await request<{ ok: boolean }>("/auth/logout", {
    method: "POST",
    headers: { "X-CSRF-Token": csrfToken },
  });
}

export async function logoutAll(csrfToken: string): Promise<void> {
  await request<{ ok: boolean }>("/auth/logout-all", {
    method: "POST",
    headers: { "X-CSRF-Token": csrfToken },
  });
}

export async function verifyEmail(token: string): Promise<void> {
  await request<{ ok: boolean }>("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function getSessions(accessToken: string): Promise<AuthSession[]> {
  return request<AuthSession[]>("/auth/sessions", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function getProfile(accessToken: string): Promise<AuthUser> {
  return request<AuthUser>("/auth/profile", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
