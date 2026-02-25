/**
 * domain.ts — Frontend domain types
 *
 * These are the canonical shapes components work with.
 * They are deliberately separate from raw API shapes so that
 * API contract changes only require updating the mapper layer.
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type FraudStatus = "clear" | "flagged" | "under_review" | "confirmed";

export type ScoreTrend = "improving" | "declining" | "stable";

// ─── Transaction Status ───────────────────────────────────────────────────────

export type TransactionStatus = "pending" | "confirmed" | "failed" | "unknown";

export type TransactionType = "payment" | "contract_call" | "token_transfer" | "other";

// ─── Credit Score ─────────────────────────────────────────────────────────────

export interface CreditScoreFactor {
  /** Human-readable factor name, e.g. "Payment History" */
  name: string;
  /** Positive or negative impact score (-100 to +100) */
  impact: number;
  /** Short explanation shown in UI */
  description: string;
}

export interface CreditScore {
  userId: string;
  score: number; // 300–850
  riskLevel: RiskLevel;
  trend: ScoreTrend;
  factors: CreditScoreFactor[];
  lastUpdated: Date;
  nextUpdateAt: Date | null;
}

// ─── Fraud Report ─────────────────────────────────────────────────────────────

export interface FraudIndicator {
  code: string;
  label: string;
  severity: RiskLevel;
  detectedAt: Date;
}

export interface FraudReport {
  reportId: string;
  userId: string;
  status: FraudStatus;
  riskScore: number; // 0–100
  indicators: FraudIndicator[];
  reviewedBy: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

// ─── Blockchain Transaction ───────────────────────────────────────────────────

export interface TransactionFee {
  /** Base fee in stroops/lumens or wei */
  baseFee: string;
  /** Priority fee if applicable */
  priorityFee?: string;
  /** Total fee charged */
  totalFee: string;
  /** Fee in human-readable format */
  formattedTotal: string;
}

export interface TransactionError {
  /** Error code */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Detailed error information */
  details?: Record<string, unknown>;
  /** Whether the transaction can be retried */
  retryable: boolean;
}

export interface BlockchainTransaction {
  /** Unique transaction identifier (hash) */
  txHash: string;
  /** Current status of the transaction */
  status: TransactionStatus;
  /** Type of transaction */
  type: TransactionType;
  /** Sender address */
  from: string;
  /** Receiver address */
  to: string;
  /** Amount being transferred (if applicable) */
  amount?: string;
  /** Transaction fees */
  fees: TransactionFee;
  /** Number of confirmations received */
  confirmations: number;
  /** Estimated time to completion in seconds */
  estimatedCompletionTime?: number;
  /** Actual completion time */
  completedAt?: Date;
  /** Block number/ledger sequence (if confirmed) */
  blockNumber?: number;
  /** Timestamp when transaction was submitted */
  submittedAt: Date;
  /** Timestamp of last status update */
  lastUpdatedAt: Date;
  /** Error information if transaction failed */
  error?: TransactionError;
  /** Raw transaction data (XDR for Stellar) */
  rawData?: string;
  /** Link to block explorer */
  explorerUrl?: string;
  /** Memo or note attached to transaction */
  memo?: string;
}

// ─── Transaction History Filter ───────────────────────────────────────────────

export interface TransactionHistoryFilter {
  /** Filter by status */
  status?: TransactionStatus | TransactionStatus[];
  /** Filter by transaction type */
  type?: TransactionType | TransactionType[];
  /** Filter by sender/receiver address */
  address?: string;
  /** Date range start */
  startDate?: Date;
  /** Date range end */
  endDate?: Date;
  /** Search query (matches hash, addresses, memo) */
  searchQuery?: string;
}

export interface TransactionHistoryResult {
  /** List of transactions matching the filter */
  transactions: BlockchainTransaction[];
  /** Total count for pagination */
  totalCount: number;
  /** Current page */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Whether more results are available */
  hasMore: boolean;
}

// ─── Transaction Submission ───────────────────────────────────────────────────

export interface TransactionSubmissionRequest {
  /** Receiver address */
  to: string;
  /** Amount to send */
  amount: string;
  /** Transaction type */
  type: TransactionType;
  /** Optional memo/note */
  memo?: string;
  /** Optional raw transaction data (for advanced use) */
  rawData?: string;
  /** Priority level for fee estimation */
  priority?: "low" | "medium" | "high";
}

export interface TransactionSubmissionResult {
  /** Whether submission was successful */
  success: boolean;
  /** Transaction hash if successful */
  txHash?: string;
  /** Estimated fees */
  estimatedFees?: TransactionFee;
  /** Error if submission failed */
  error?: TransactionError;
  /** Whether the transaction requires signing */
  requiresSigning: boolean;
}
