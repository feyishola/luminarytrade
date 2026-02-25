/**
 * TransactionContext.tsx
 *
 * React context for managing transaction state across the application.
 * Provides centralized transaction tracking, history management, and submission.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import {
  BlockchainTransaction,
  TransactionHistoryFilter,
  TransactionHistoryResult,
  TransactionSubmissionRequest,
  TransactionSubmissionResult,
  TransactionStatus,
} from "../interfaces/domain";
import {
  fetchTransaction,
  fetchTransactionHistory,
  submitTransaction,
  retryTransaction,
  estimateGasFees,
  transactionPoller,
  transactionCache,
  fetchTransactionsBatch,
  exportToCSV,
  getExplorerUrl,
  formatStatus,
  formatType,
  truncateAddress,
  truncateHash,
} from "../services/transactionService";
import { ApiResult } from "../interfaces/Mapper.interface";

// ─── Context Types ────────────────────────────────────────────────────────────

interface TransactionContextState {
  // Current transactions being tracked
  trackedTransactions: Map<string, BlockchainTransaction>;
  // Transaction history
  history: TransactionHistoryResult | null;
  // Loading states
  isLoadingHistory: boolean;
  isSubmitting: boolean;
  isEstimatingFees: boolean;
  // Error states
  historyError: string | null;
  submissionError: string | null;
  // Gas estimates
  gasEstimate: {
    baseFee: string;
    priorityFee: string;
    estimatedTime: number;
  } | null;
}

interface TransactionContextActions {
  // Tracking
  trackTransaction: (txHash: string) => void;
  untrackTransaction: (txHash: string) => void;
  getTransaction: (txHash: string) => BlockchainTransaction | undefined;
  
  // History
  loadHistory: (filter?: TransactionHistoryFilter, page?: number, pageSize?: number) => Promise<void>;
  refreshHistory: () => Promise<void>;
  exportHistory: (filename?: string) => void;
  
  // Submission
  submit: (request: TransactionSubmissionRequest) => Promise<ApiResult<TransactionSubmissionResult>>;
  retry: (txHash: string) => Promise<ApiResult<TransactionSubmissionResult>>;
  
  // Gas estimation
  estimateFees: (priority?: "low" | "medium" | "high") => Promise<void>;
  
  // Batch operations
  refreshMultiple: (txHashes: string[]) => Promise<void>;
  
  // Utilities
  getExplorerUrl: (txHash: string, network?: "stellar" | "ethereum") => string;
  formatStatus: (status: TransactionStatus) => string;
  formatType: (type: string) => string;
  truncateAddress: (address: string, chars?: number) => string;
  truncateHash: (hash: string, chars?: number) => string;
  
  // Clear errors
  clearErrors: () => void;
}

interface TransactionContextType extends TransactionContextState, TransactionContextActions {}

// ─── Context Creation ─────────────────────────────────────────────────────────

const TransactionContext = createContext<TransactionContextType | undefined>(undefined);

// ─── Provider Props ───────────────────────────────────────────────────────────

interface TransactionProviderProps {
  children: ReactNode;
  autoPoll?: boolean;
}

// ─── Provider Component ───────────────────────────────────────────────────────

export const TransactionProvider: React.FC<TransactionProviderProps> = ({
  children,
  autoPoll = true,
}) => {
  // State
  const [trackedTransactions, setTrackedTransactions] = useState<Map<string, BlockchainTransaction>>(new Map());
  const [history, setHistory] = useState<TransactionHistoryResult | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEstimatingFees, setIsEstimatingFees] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [gasEstimate, setGasEstimate] = useState<{
    baseFee: string;
    priorityFee: string;
    estimatedTime: number;
  } | null>(null);

  // Refs for current filter/pagination
  const currentFilterRef = useRef<TransactionHistoryFilter>({});
  const currentPageRef = useRef(1);
  const currentPageSizeRef = useRef(20);

  // ─── Tracking Actions ───────────────────────────────────────────────────────

  const handleStatusUpdate = useCallback((txHash: string, tx: BlockchainTransaction) => {
    setTrackedTransactions((prev) => {
      const next = new Map(prev);
      next.set(txHash, tx);
      return next;
    });
  }, []);

  const handlePollError = useCallback((txHash: string, error: Error) => {
    console.error(`[TransactionContext] Polling error for ${txHash}:`, error);
  }, []);

  const trackTransaction = useCallback((txHash: string) => {
    // Start polling
    if (autoPoll) {
      transactionPoller.startPolling(
        txHash,
        (tx) => handleStatusUpdate(txHash, tx),
        (error) => handlePollError(txHash, error)
      );
    }

    // Initial fetch
    fetchTransaction(txHash).then((result) => {
      if (result.ok) {
        handleStatusUpdate(txHash, result.data);
      }
    });
  }, [autoPoll, handleStatusUpdate, handlePollError]);

  const untrackTransaction = useCallback((txHash: string) => {
    transactionPoller.stopPolling(txHash);
    setTrackedTransactions((prev) => {
      const next = new Map(prev);
      next.delete(txHash);
      return next;
    });
  }, []);

  const getTransaction = useCallback((txHash: string): BlockchainTransaction | undefined => {
    return trackedTransactions.get(txHash);
  }, [trackedTransactions]);

  // ─── History Actions ────────────────────────────────────────────────────────

  const loadHistory = useCallback(async (
    filter: TransactionHistoryFilter = {},
    page = 1,
    pageSize = 20
  ) => {
    setIsLoadingHistory(true);
    setHistoryError(null);

    // Update refs
    currentFilterRef.current = filter;
    currentPageRef.current = page;
    currentPageSizeRef.current = pageSize;

    const result = await fetchTransactionHistory(filter, page, pageSize);

    if (result.ok) {
      setHistory(result.data);
      // Auto-track pending transactions
      result.data.transactions
        .filter((tx) => tx.status === "pending")
        .forEach((tx) => trackTransaction(tx.txHash));
    } else {
      setHistoryError(result.error.message);
    }

    setIsLoadingHistory(false);
  }, [trackTransaction]);

  const refreshHistory = useCallback(async () => {
    await loadHistory(
      currentFilterRef.current,
      currentPageRef.current,
      currentPageSizeRef.current
    );
  }, [loadHistory]);

  const exportHistory = useCallback((filename = "transaction-history.csv") => {
    if (history?.transactions) {
      exportToCSV(history.transactions, filename);
    }
  }, [history]);

  // ─── Submission Actions ─────────────────────────────────────────────────────

  const submit = useCallback(async (
    request: TransactionSubmissionRequest
  ): Promise<ApiResult<TransactionSubmissionResult>> => {
    setIsSubmitting(true);
    setSubmissionError(null);

    const result = await submitTransaction(request);

    if (!result.ok) {
      setSubmissionError(result.error.message);
    } else if (result.data.success && result.data.txHash) {
      // Auto-track the new transaction
      trackTransaction(result.data.txHash);
    }

    setIsSubmitting(false);
    return result;
  }, [trackTransaction]);

  const retry = useCallback(async (
    txHash: string
  ): Promise<ApiResult<TransactionSubmissionResult>> => {
    setIsSubmitting(true);
    setSubmissionError(null);

    const result = await retryTransaction(txHash);

    if (!result.ok) {
      setSubmissionError(result.error.message);
    } else if (result.data.success && result.data.txHash) {
      // Refresh the transaction
      trackTransaction(result.data.txHash);
    }

    setIsSubmitting(false);
    return result;
  }, [trackTransaction]);

  // ─── Gas Estimation ─────────────────────────────────────────────────────────

  const estimateFees = useCallback(async (priority: "low" | "medium" | "high" = "medium") => {
    setIsEstimatingFees(true);

    const result = await estimateGasFees(priority);

    if (result.ok) {
      setGasEstimate(result.data);
    }

    setIsEstimatingFees(false);
  }, []);

  // ─── Batch Operations ───────────────────────────────────────────────────────

  const refreshMultiple = useCallback(async (txHashes: string[]) => {
    const results = await fetchTransactionsBatch(txHashes);
    
    setTrackedTransactions((prev) => {
      const next = new Map(prev);
      results.forEach((tx, hash) => {
        next.set(hash, tx);
      });
      return next;
    });

    // Start polling for pending transactions
    results.forEach((tx, hash) => {
      if (tx.status === "pending") {
        trackTransaction(hash);
      }
    });
  }, [trackTransaction]);

  // ─── Utility Functions ──────────────────────────────────────────────────────

  const clearErrors = useCallback(() => {
    setHistoryError(null);
    setSubmissionError(null);
  }, []);

  // ─── Cleanup ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      // Stop all polling on unmount
      transactionPoller.stopAll();
    };
  }, []);

  // ─── Context Value ───────────────────────────────────────────────────────────

  const value: TransactionContextType = {
    // State
    trackedTransactions,
    history,
    isLoadingHistory,
    isSubmitting,
    isEstimatingFees,
    historyError,
    submissionError,
    gasEstimate,
    // Actions
    trackTransaction,
    untrackTransaction,
    getTransaction,
    loadHistory,
    refreshHistory,
    exportHistory,
    submit,
    retry,
    estimateFees,
    refreshMultiple,
    getExplorerUrl,
    formatStatus,
    formatType,
    truncateAddress,
    truncateHash,
    clearErrors,
  };

  return (
    <TransactionContext.Provider value={value}>
      {children}
    </TransactionContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useTransactions = (): TransactionContextType => {
  const context = useContext(TransactionContext);
  if (context === undefined) {
    throw new Error("useTransactions must be used within a TransactionProvider");
  }
  return context;
};

// ─── Utility Hook for Single Transaction ──────────────────────────────────────

interface UseTransactionOptions {
  autoTrack?: boolean;
  onStatusChange?: (tx: BlockchainTransaction) => void;
  onError?: (error: Error) => void;
}

export const useTransaction = (
  txHash: string | null,
  options: UseTransactionOptions = {}
) => {
  const { autoTrack = true, onStatusChange, onError } = options;
  const { trackTransaction, untrackTransaction, getTransaction } = useTransactions();
  const [transaction, setTransaction] = useState<BlockchainTransaction | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!txHash || !autoTrack) return;

    setIsLoading(true);
    setError(null);

    // Check if already tracked
    const existing = getTransaction(txHash);
    if (existing) {
      setTransaction(existing);
      setIsLoading(false);
    } else {
      // Fetch initial data
      fetchTransaction(txHash).then((result) => {
        if (result.ok) {
          setTransaction(result.data);
        } else {
          setError(result.error.message);
        }
        setIsLoading(false);
      });
    }

    // Start polling
    const unsubscribe = transactionPoller.startPolling(
      txHash,
      (tx) => {
        setTransaction(tx);
        onStatusChange?.(tx);
      },
      (err) => {
        setError(err.message);
        onError?.(err);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [txHash, autoTrack, getTransaction, onStatusChange, onError]);

  return {
    transaction,
    isLoading,
    error,
    refresh: useCallback(async () => {
      if (!txHash) return;
      setIsLoading(true);
      const result = await fetchTransaction(txHash, true);
      if (result.ok) {
        setTransaction(result.data);
        setError(null);
      } else {
        setError(result.error.message);
      }
      setIsLoading(false);
    }, [txHash]),
  };
};

export default TransactionContext;
