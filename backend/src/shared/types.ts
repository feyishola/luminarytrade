// shared/types.ts - Common types across all services

export interface ServiceConfig {
  name: string;
  port: number;
  url: string;
}

export interface FederationContext {
  userId?: string;
  roles?: string[];
  token?: string;
  requestId?: string;
  traceId?: string;
}

export interface AuthPayload {
  userId: string;
  roles: string[];
  email: string;
  exp: number;
}

export interface PaginationArgs {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
}

export interface PaginatedResult<T> {
  edges: Array<{ node: T; cursor: string }>;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor?: string;
    endCursor?: string;
  };
  totalCount: number;
}

export const SERVICE_PORTS = {
  GATEWAY: 4000,
  AGENT: 4001,
  ORACLE: 4002,
  AUDIT: 4003,
  AUTH: 4004,
} as const;

export const SERVICE_URLS = {
  GATEWAY: `http://localhost:${SERVICE_PORTS.GATEWAY}/graphql`,
  AGENT: `http://localhost:${SERVICE_PORTS.AGENT}/graphql`,
  ORACLE: `http://localhost:${SERVICE_PORTS.ORACLE}/graphql`,
  AUDIT: `http://localhost:${SERVICE_PORTS.AUDIT}/graphql`,
  AUTH: `http://localhost:${SERVICE_PORTS.AUTH}/graphql`,
} as const;
