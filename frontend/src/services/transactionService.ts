/**
 * transactionService.ts
 *
 * Service for blockchain transaction operations including:
 * - Transaction submission
 * - Status polling with caching
 * - Gas estimation
 * - History retrieval
 * - Batch queries
 */

import {
  RawTransactionResponse,
  RawTransactionHistoryResponse,
  RawTransactionSubmissionResponse,
  RawGasEstimateResponse,
  RawApiEnvelope,
} from "../interfaces/api-response";
import {
  BlockchainTransaction,
  TransactionHistoryFilter,
  TransactionHistoryResult,
  TransactionSubmissionRequest,
  TransactionSubmissionResult,
  TransactionStatus,
} from "../interfaces/domain";
import { ApiResult, mapEnvelope } from "../interfaces/Mapper.interface";
import {
  transactionMapper,
  transactionHistoryMapper,
  transactionSubmissionMapper,
} from "../TransactionMapper";

// ─── Configuration ────────────────────────────────────────────────────────────

const BASE_URL =
  (window as any).__ENV__?.REACT_APP_API_BASE_URL ??
  "http://localhost:3001/api";

const DEFAULT_POLL_INTERVAL = 3000; // 3 seconds
const MAX_POLL_INTERVAL = 30000; // 30 seconds
const MAX_RETRIES = 5;
const CACHE_TTL = 60000; // 1 minute

// ─── Cache Implementation ─────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class TransactionCache {
  private cache = new Map<string, CacheEntry<BlockchainTransaction>>();
  private historyCache = new Map<string, CacheEntry<TransactionHistoryResult>>();

  get(txHash: string): BlockchainTransaction | undefined {
    const entry = this.cache.get(txHash);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
      return entry.data;
    }
    if (entry) {
      this.cache.delete(txHash);
    }
    return undefined;
  }

  set(txHash: string, data: BlockchainTransaction): void {
    this.cache.set(txHash, { data, timestamp: Date.now() });
  }

  getHistory(key: string): TransactionHistoryResult | undefined {
    const entry = this.historyCache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
      return entry.data;
    }
    if (entry) {
      this.historyCache.delete(key);
    }
    return undefined;
  }

  setHistory(key: string, data: TransactionHistoryResult): void {
    this.historyCache.set(key, { data, timestamp: Date.now() });
  }

  invalidate(txHash: string): void {
    this.cache.delete(txHash);
  }

  invalidateHistory(): void {
    this.historyCache.clear();
  }

  clear(): void {
    this.cache.clear();
    this.historyCache.clear();
  }
}

export const transactionCache = new TransactionCache();

// ─── HTTP Helpers ─────────────────────────────────────────────────────────────

async function get<T>(path: string): Promise<RawApiEnvelope<T>> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    return {
      success: false,
      error: {
        error_code: `HTTP_${response.status}`,
        error_message: `Request failed with status ${response.status}`,
      },
    };
  }

  return response.json() as Promise<RawApiEnvelope<T>>;
}

async function post<T>(path: string, body: unknown): Promise<RawApiEnvelope<T>> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return {
      success: false,
      error: {
        error_code: `HTTP_${response.status}`,
        error_message: `Request failed with status ${response.status}`,
      },
    };
  }

  return response.json() as Promise<RawApiEnvelope<T>>;
}

// ─── Transaction Service ──────────────────────────────────────────────────────

/**
 * Fetch a single transaction by hash with caching
 */
export async function fetchTransaction(
  txHash: string,
  skipCache = false
): Promise<ApiResult<BlockchainTransaction>> {
  // Check cache first
  if (!skipCache) {
    const cached = transactionCache.get(txHash);
    if (cached) {
      return { ok: true, data: cached };
    }
  }

  try {
    const raw = await get<RawTransactionResponse>(`/transactions/${txHash}`);
    const result = mapEnvelope(raw, transactionMapper);

    if (result.ok) {
      transactionCache.set(txHash, result.data);
    }

    return result;
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "NETWORK_ERROR",
        message: err instanceof Error ? err.message : "Network request failed",
      },
    };
  }
}

/**
 * Fetch transaction history with filtering and caching
 */
export async function fetchTransactionHistory(
  filter: TransactionHistoryFilter = {},
  page = 1,
  pageSize = 20,
  skipCache = false
): Promise<ApiResult<TransactionHistoryResult>> {
  // Build cache key from filter and pagination
  const cacheKey = JSON.stringify({ filter, page, pageSize });

  if (!skipCache) {
    const cached = transactionCache.getHistory(cacheKey);
    if (cached) {
      return { ok: true, data: cached };
    }
  }

  // Build query parameters
  const params = new URLSearchParams();
  params.set("page", page.toString());
  params.set("page_size", pageSize.toString());

  if (filter.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
    statuses.forEach((s) => params.append("status", s));
  }

  if (filter.type) {
    const types = Array.isArray(filter.type) ? filter.type : [filter.type];
    types.forEach((t) => params.append("type", t));
  }

  if (filter.address) {
    params.set("address", filter.address);
  }

  if (filter.startDate) {
    params.set("start_date", filter.startDate.toISOString());
  }

  if (filter.endDate) {
    params.set("end_date", filter.endDate.toISOString());
  }

  if (filter.searchQuery) {
    params.set("search", filter.searchQuery);
  }

  try {
    const raw = await get<RawTransactionHistoryResponse>(
      `/transactions?${params.toString()}`
    );
    const result = mapEnvelope(raw, transactionHistoryMapper);

    if (result.ok) {
      transactionCache.setHistory(cacheKey, result.data);
    }

    return result;
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "NETWORK_ERROR",
        message: err instanceof Error ? err.message : "Network request failed",
      },
    };
  }
}

/**
 * Submit a new transaction
 */
export async function submitTransaction(
  request: TransactionSubmissionRequest
): Promise<ApiResult<TransactionSubmissionResult>> {
  try {
    const raw = await post<RawTransactionSubmissionResponse>("/transactions", {
      to_address: request.to,
      amount: request.amount,
      type: request.type,
      memo: request.memo,
      raw_data: request.rawData,
      priority: request.priority || "medium",
    });

    const result = mapEnvelope(raw, transactionSubmissionMapper);

    // Invalidate history cache on new submission
    if (result.ok && result.data.success) {
      transactionCache.invalidateHistory();
    }

    return result;
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "NETWORK_ERROR",
        message: err instanceof Error ? err.message : "Network request failed",
      },
    };
  }
}

/**
 * Estimate gas fees for a transaction
 */
export async function estimateGasFees(
  priority: "low" | "medium" | "high" = "medium"
): Promise<
  ApiResult<{
    baseFee: string;
    priorityFee: string;
    estimatedTime: number;
  }>
> {
  try {
    const raw = await get<RawGasEstimateResponse>("/transactions/gas-estimate");

    if (!raw.success || !raw.data) {
      return {
        ok: false,
        error: {
          code: raw.error?.error_code ?? "ESTIMATE_FAILED",
          message: raw.error?.error_message ?? "Failed to estimate gas fees",
        },
      };
    }

    const priorityFeeKey = `priority_fee_${priority}` as const;
    const timeKey = `estimated_time_${priority}` as const;

    return {
      ok: true,
      data: {
        baseFee: raw.data.base_fee,
        priorityFee: raw.data[priorityFeeKey],
        estimatedTime: raw.data[timeKey],
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "NETWORK_ERROR",
        message: err instanceof Error ? err.message : "Network request failed",
      },
    };
  }
}

/**
 * Retry a failed transaction
 */
export async function retryTransaction(
  txHash: string
): Promise<ApiResult<TransactionSubmissionResult>> {
  try {
    const raw = await post<RawTransactionSubmissionResponse>(
      `/transactions/${txHash}/retry`,
      {}
    );

    const result = mapEnvelope(raw, transactionSubmissionMapper);

    if (result.ok && result.data.success) {
      transactionCache.invalidate(txHash);
      transactionCache.invalidateHistory();
    }

    return result;
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "NETWORK_ERROR",
        message: err instanceof Error ? err.message : "Network request failed",
      },
    };
  }
}

// ─── Polling Manager ──────────────────────────────────────────────────────────

type StatusCallback = (tx: BlockchainTransaction) => void;
type ErrorCallback = (error: Error) => void;

interface PollEntry {
  txHash: string;
  intervalId: ReturnType<typeof setInterval>;
  callbacks: Set<StatusCallback>;
  errorCallbacks: Set<ErrorCallback>;
  retryCount: number;
  currentInterval: number;
}

class TransactionPoller {
  private polls = new Map<string, PollEntry>();

  /**
   * Start polling for a transaction's status
   */
  startPolling(
    txHash: string,
    onStatusChange: StatusCallback,
    onError?: ErrorCallback,
    initialInterval = DEFAULT_POLL_INTERVAL
  ): () => void {
    // If already polling this transaction, just add the callback
    const existing = this.polls.get(txHash);
    if (existing) {
      existing.callbacks.add(onStatusChange);
      if (onError) {
        existing.errorCallbacks.add(onError);
      }
      return () => this.stopPolling(txHash, onStatusChange, onError);
    }

    // Create new poll entry
    const entry: PollEntry = {
      txHash,
      callbacks: new Set([onStatusChange]),
      errorCallbacks: onError ? new Set([onError]) : new Set(),
      retryCount: 0,
      currentInterval: initialInterval,
      intervalId: setInterval(async () => {
        await this.pollTransaction(txHash);
      }, initialInterval),
    };

    this.polls.set(txHash, entry);

    // Initial poll
    this.pollTransaction(txHash);

    // Return unsubscribe function
    return () => this.stopPolling(txHash, onStatusChange, onError);
  }

  /**
   * Stop polling for a transaction
   */
  stopPolling(
    txHash: string,
    callback?: StatusCallback,
    errorCallback?: ErrorCallback
  ): void {
    const entry = this.polls.get(txHash);
    if (!entry) return;

    if (callback) {
      entry.callbacks.delete(callback);
    }
    if (errorCallback) {
      entry.errorCallbacks.delete(errorCallback);
    }

    // Only stop if no more callbacks
    if (entry.callbacks.size === 0) {
      clearInterval(entry.intervalId);
      this.polls.delete(txHash);
    }
  }

  /**
   * Poll a single transaction and notify callbacks
   */
  private async pollTransaction(txHash: string): Promise<void> {
    const entry = this.polls.get(txHash);
    if (!entry) return;

    try {
      const result = await fetchTransaction(txHash, true); // Skip cache for polling

      if (result.ok) {
        // Reset retry count on success
        entry.retryCount = 0;

        // Notify all callbacks
        entry.callbacks.forEach((cb) => cb(result.data));

        // Stop polling if transaction is finalized
        if (result.data.status === "confirmed" || result.data.status === "failed") {
          this.stopAllPolling(txHash);
        } else {
          // Adjust polling interval based on time elapsed
          this.adjustPollingInterval(entry);
        }
      } else {
        throw new Error(result.error.message);
      }
    } catch (err) {
      entry.retryCount++;

      if (entry.retryCount >= MAX_RETRIES) {
        // Stop polling after max retries
        this.stopAllPolling(txHash);
        const error = err instanceof Error ? err : new Error("Polling failed");
        entry.errorCallbacks.forEach((cb) => cb(error));
      }
    }
  }

  /**
   * Adjust polling interval based on transaction age
   */
  private adjustPollingInterval(entry: PollEntry): void {
    // Increase interval over time (exponential backoff)
    const newInterval = Math.min(
      entry.currentInterval * 1.5,
      MAX_POLL_INTERVAL
    );

    if (newInterval !== entry.currentInterval) {
      clearInterval(entry.intervalId);
      entry.currentInterval = newInterval;
      entry.intervalId = setInterval(async () => {
        await this.pollTransaction(entry.txHash);
      }, newInterval);
    }
  }

  /**
   * Stop all polling for a transaction
   */
  private stopAllPolling(txHash: string): void {
    const entry = this.polls.get(txHash);
    if (entry) {
      clearInterval(entry.intervalId);
      this.polls.delete(txHash);
    }
  }

  /**
   * Stop all polling
   */
  stopAll(): void {
    this.polls.forEach((entry) => {
      clearInterval(entry.intervalId);
    });
    this.polls.clear();
  }
}

export const transactionPoller = new TransactionPoller();

// ─── Batch Operations ─────────────────────────────────────────────────────────

/**
 * Fetch multiple transactions in parallel with rate limiting
 */
export async function fetchTransactionsBatch(
  txHashes: string[],
  batchSize = 5
): Promise<Map<string, BlockchainTransaction>> {
  const results = new Map<string, BlockchainTransaction>();
  const pending = [...txHashes];

  while (pending.length > 0) {
    const batch = pending.splice(0, batchSize);
    const promises = batch.map(async (hash) => {
      const result = await fetchTransaction(hash);
      return { hash, result };
    });

    const batchResults = await Promise.all(promises);

    for (const { hash, result } of batchResults) {
      if (result.ok) {
        results.set(hash, result.data);
      }
    }

    // Small delay between batches to avoid rate limiting
    if (pending.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Export transaction history to CSV
 */
export function exportToCSV(
  transactions: BlockchainTransaction[],
  filename = "transaction-history.csv"
): void {
  const headers = [
    "Transaction Hash",
    "Status",
    "Type",
    "From",
    "To",
    "Amount",
    "Fee",
    "Confirmations",
    "Submitted At",
    "Completed At",
    "Memo",
  ];

  const rows = transactions.map((tx) => [
    tx.txHash,
    tx.status,
    tx.type,
    tx.from,
    tx.to,
    tx.amount || "",
    tx.fees.formattedTotal,
    tx.confirmations,
    tx.submittedAt.toISOString(),
    tx.completedAt?.toISOString() || "",
    tx.memo || "",
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

/**
 * Get explorer URL for a transaction
 */
export function getExplorerUrl(
  txHash: string,
  network: "stellar" | "ethereum" = "stellar"
): string {
  if (network === "stellar") {
    return `https://stellar.expert/explorer/testnet/tx/${txHash}`;
  }
  return `https://etherscan.io/tx/${txHash}`;
}

/**
 * Format transaction status for display
 */
export function formatStatus(status: TransactionStatus): string {
  const statusMap: Record<TransactionStatus, string> = {
    pending: "Pending",
    confirmed: "Confirmed",
    failed: "Failed",
    unknown: "Unknown",
  };
  return statusMap[status] || status;
}

/**
 * Format transaction type for display
 */
export function formatType(type: string): string {
  const typeMap: Record<string, string> = {
    payment: "Payment",
    contract_call: "Contract Call",
    token_transfer: "Token Transfer",
    other: "Other",
  };
  return typeMap[type] || type;
}

/**
 * Truncate address for display
 */
export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Truncate transaction hash for display
 */
export function truncateHash(hash: string, chars = 6): string {
  if (hash.length <= chars * 2 + 3) return hash;
  return `${hash.slice(0, chars)}...${hash.slice(-chars)}`;
}
