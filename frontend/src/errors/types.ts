export type AppErrorType =
  | "NETWORK"
  | "AUTH"
  | "VALIDATION"
  | "NOT_FOUND"
  | "SERVER"
  | "UNKNOWN";

export interface AppError {
  message: string;
  type: AppErrorType;
  originalError?: unknown;
  retryable?: boolean;
}