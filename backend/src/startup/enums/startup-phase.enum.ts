export enum StartupPhase {
  INFRASTRUCTURE = 'INFRASTRUCTURE',
  CORE = 'CORE',
  DOMAIN = 'DOMAIN',
  API = 'API',
  EXTERNAL = 'EXTERNAL',
}

export enum StartupStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum DependencyType {
  DATABASE = 'DATABASE',
  CACHE = 'CACHE',
  CONFIG = 'CONFIG',
  LOGGING = 'LOGGING',
  AGENT = 'AGENT',
  ORACLE = 'ORACLE',
  WEBHOOK = 'WEBHOOK',
  EXTERNAL_API = 'EXTERNAL_API',
}

// Re-export types for convenience
export type { 
  StartupPhase as TStartupPhase,
  StartupStatus as TStartupStatus,
  DependencyType as TDependencyType,
};
