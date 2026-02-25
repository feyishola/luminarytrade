import { FederationContext, AuthPayload } from "./types";

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

// Decode JWT without verification (verification happens at gateway)
export function decodeToken(token: string): AuthPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], "base64").toString("utf8");
    return JSON.parse(payload) as AuthPayload;
  } catch {
    return null;
  }
}

export function buildContext(
  headers: Record<string, string | string[] | undefined>,
): FederationContext {
  const token = extractBearerToken(headers["authorization"] as string);
  if (!token) return {};

  const payload = decodeToken(token);
  if (!payload) return {};

  return {
    userId: payload.userId,
    roles: payload.roles,
    token,
    requestId: headers["x-request-id"] as string,
    traceId: headers["x-trace-id"] as string,
  };
}

function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

// Authorization directives
export function requireAuth(context: FederationContext): void {
  if (!context.userId) {
    throw new AuthenticationError("Authentication required");
  }
}

export function requireRole(
  context: FederationContext,
  ...roles: string[]
): void {
  requireAuth(context);
  const hasRole = roles.some((role) => context.roles?.includes(role));
  if (!hasRole) {
    throw new AuthorizationError(`Required role(s): ${roles.join(", ")}`);
  }
}

export function requireOwnerOrAdmin(
  context: FederationContext,
  ownerId: string,
): void {
  requireAuth(context);
  if (context.userId !== ownerId && !context.roles?.includes("admin")) {
    throw new AuthorizationError("Access denied: insufficient permissions");
  }
}

// Field-level authorization
export type FieldAuthRule<T> = {
  field: keyof T;
  roles?: string[];
  condition?: (ctx: FederationContext, obj: T) => boolean;
};

export function applyFieldAuth<T extends Record<string, unknown>>(
  obj: T,
  context: FederationContext,
  rules: FieldAuthRule<T>[],
): T {
  const result = { ...obj };
  for (const rule of rules) {
    const allowed =
      (!rule.roles || rule.roles.some((r) => context.roles?.includes(r))) &&
      (!rule.condition || rule.condition(context, obj));
    if (!allowed) {
      result[rule.field] = null as T[keyof T];
    }
  }
  return result;
}
