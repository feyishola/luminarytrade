/**
 * transaction.test.tsx
 *
 * Comprehensive tests for the blockchain transaction tracking system.
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionProvider, useTransactions, useTransaction } from "../contexts/TransactionContext";
import { TransactionTracker } from "../components/TransactionTracker";
import { TransactionHistory } from "../components/TransactionHistory";
import { TransactionSubmitForm } from "../components/TransactionSubmitForm";
import {
  fetchTransaction,
  fetchTransactionHistory,
  submitTransaction,
  transactionCache,
  transactionPoller,
  formatStatus,
  formatType,
  truncateAddress,
  truncateHash,
  getExplorerUrl,
} from "../services/transactionService";
import {
  transactionMapper,
  transactionHistoryMapper,
  transactionSubmissionMapper,
} from "../TransactionMapper";
import { BlockchainTransaction, TransactionStatus, TransactionType } from "../interfaces/domain";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("../services/transactionService", () => ({
  ...jest.requireActual("../services/transactionService"),
  fetchTransaction: jest.fn(),
  fetchTransactionHistory: jest.fn(),
  submitTransaction: jest.fn(),
  estimateGasFees: jest.fn(),
  retryTransaction: jest.fn(),
}));

global.fetch = jest.fn();

// ─── Test Data ────────────────────────────────────────────────────────────────

const mockTransaction: BlockchainTransaction = {
  txHash: "abc123def456789",
  status: "pending",
  type: "payment",
  from: "GABC123456789",
  to: "GXYZ987654321",
  amount: "100.50",
  fees: {
    baseFee: "0.00001",
    totalFee: "0.00001",
    formattedTotal: "0.00001 XLM",
  },
  confirmations: 0,
  submittedAt: new Date("2024-01-15T10:00:00Z"),
  lastUpdatedAt: new Date("2024-01-15T10:00:00Z"),
  explorerUrl: "https://stellar.expert/explorer/testnet/tx/abc123",
};

const mockConfirmedTransaction: BlockchainTransaction = {
  ...mockTransaction,
  status: "confirmed",
  confirmations: 10,
  blockNumber: 123456,
  completedAt: new Date("2024-01-15T10:01:00Z"),
};

const mockFailedTransaction: BlockchainTransaction = {
  ...mockTransaction,
  status: "failed",
  error: {
    code: "INSUFFICIENT_FUNDS",
    message: "Insufficient funds for transaction",
    retryable: true,
  },
};

// ─── Helper Components ────────────────────────────────────────────────────────

const TestComponent: React.FC = () => {
  const {
    trackTransaction,
    untrackTransaction,
    getTransaction,
    loadHistory,
    history,
    isLoadingHistory,
    submit,
    formatStatus,
    formatType,
    truncateAddress,
    truncateHash,
    getExplorerUrl,
  } = useTransactions();

  return (
    <div>
      <button onClick={() => trackTransaction("abc123")}>Track</button>
      <button onClick={() => untrackTransaction("abc123")}>Untrack</button>
      <button onClick={() => loadHistory()}>Load History</button>
      <div data-testid="transaction">{getTransaction("abc123")?.txHash || "none"}</div>
      <div data-testid="history-count">{history?.transactions.length || 0}</div>
      <div data-testid="loading">{isLoadingHistory ? "loading" : "idle"}</div>
      <div data-testid="formatted-status">{formatStatus("confirmed")}</div>
      <div data-testid="formatted-type">{formatType("payment")}</div>
      <div data-testid="truncated-address">{truncateAddress("GABC123456789", 4)}</div>
      <div data-testid="truncated-hash">{truncateHash("abc123def456789", 6)}</div>
      <div data-testid="explorer-url">{getExplorerUrl("abc123", "stellar")}</div>
    </div>
  );
};

// ─── Tests: Service Functions ─────────────────────────────────────────────────

describe("Transaction Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    transactionCache.clear();
    transactionPoller.stopAll();
  });

  describe("formatStatus", () => {
    it("formats status correctly", () => {
      expect(formatStatus("pending")).toBe("Pending");
      expect(formatStatus("confirmed")).toBe("Confirmed");
      expect(formatStatus("failed")).toBe("Failed");
      expect(formatStatus("unknown")).toBe("Unknown");
    });
  });

  describe("formatType", () => {
    it("formats type correctly", () => {
      expect(formatType("payment")).toBe("Payment");
      expect(formatType("contract_call")).toBe("Contract Call");
      expect(formatType("token_transfer")).toBe("Token Transfer");
      expect(formatType("other")).toBe("Other");
    });
  });

  describe("truncateAddress", () => {
    it("truncates address correctly", () => {
      expect(truncateAddress("GABC123456789", 4)).toBe("GABC...6789");
    });

    it("returns short addresses unchanged", () => {
      expect(truncateAddress("short", 4)).toBe("short");
    });
  });

  describe("truncateHash", () => {
    it("truncates hash correctly", () => {
      expect(truncateHash("abc123def456789", 6)).toBe("abc123...56789");
    });
  });

  describe("getExplorerUrl", () => {
    it("returns Stellar explorer URL", () => {
      const url = getExplorerUrl("abc123", "stellar");
      expect(url).toContain("stellar.expert");
      expect(url).toContain("abc123");
    });

    it("returns Ethereum explorer URL", () => {
      const url = getExplorerUrl("abc123", "ethereum");
      expect(url).toContain("etherscan.io");
    });
  });
});

// ─── Tests: Mappers ───────────────────────────────────────────────────────────

describe("Transaction Mappers", () => {
  describe("transactionMapper", () => {
    it("maps valid raw transaction correctly", () => {
      const raw = {
        tx_hash: "abc123",
        status: "confirmed",
        type: "payment",
        from_address: "GABC",
        to_address: "GXYZ",
        amount: "100",
        fees: {
          base_fee: "0.00001",
          total_fee: "0.00001",
          formatted_total: "0.00001 XLM",
        },
        confirmations: 10,
        submitted_at: "2024-01-15T10:00:00Z",
        last_updated_at: "2024-01-15T10:01:00Z",
      };

      const result = transactionMapper.tryMap(raw);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.txHash).toBe("abc123");
        expect(result.value.status).toBe("confirmed");
        expect(result.value.confirmations).toBe(10);
      }
    });

    it("fails on missing required fields", () => {
      const raw = {
        tx_hash: "",
        status: "pending",
        type: "payment",
        from_address: "GABC",
        to_address: "GXYZ",
        fees: {
          base_fee: "0.00001",
          total_fee: "0.00001",
          formatted_total: "0.00001 XLM",
        },
        submitted_at: "2024-01-15T10:00:00Z",
        last_updated_at: "2024-01-15T10:00:00Z",
      };

      const result = transactionMapper.tryMap(raw);
      expect(result.ok).toBe(false);
    });

    it("validates unknown status", () => {
      const raw = {
        tx_hash: "abc123",
        status: "invalid_status",
        type: "payment",
        from_address: "GABC",
        to_address: "GXYZ",
        fees: {
          base_fee: "0.00001",
          total_fee: "0.00001",
          formatted_total: "0.00001 XLM",
        },
        submitted_at: "2024-01-15T10:00:00Z",
        last_updated_at: "2024-01-15T10:00:00Z",
      };

      const result = transactionMapper.tryMap(raw);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe("unknown");
      }
    });
  });
});

// ─── Tests: Context ───────────────────────────────────────────────────────────

describe("TransactionContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    transactionCache.clear();
    transactionPoller.stopAll();
  });

  it("provides utility functions", () => {
    render(
      <TransactionProvider>
        <TestComponent />
      </TransactionProvider>
    );

    expect(screen.getByTestId("formatted-status")).toHaveTextContent("Confirmed");
    expect(screen.getByTestId("formatted-type")).toHaveTextContent("Payment");
    expect(screen.getByTestId("truncated-address")).toHaveTextContent("GABC...6789");
    expect(screen.getByTestId("truncated-hash")).toHaveTextContent("abc123...56789");
    expect(screen.getByTestId("explorer-url")).toContain("stellar.expert");
  });

  it("loads history on request", async () => {
    const mockHistory = {
      ok: true,
      data: {
        transactions: [mockTransaction],
        totalCount: 1,
        page: 1,
        pageSize: 20,
        hasMore: false,
      },
    };

    (fetchTransactionHistory as jest.Mock).mockResolvedValue(mockHistory);

    render(
      <TransactionProvider>
        <TestComponent />
      </TransactionProvider>
    );

    fireEvent.click(screen.getByText("Load History"));

    await waitFor(() => {
      expect(screen.getByTestId("history-count")).toHaveTextContent("1");
    });
  });
});

// ─── Tests: TransactionTracker Component ──────────────────────────────────────

describe("TransactionTracker Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    transactionPoller.stopAll();
  });

  it("displays loading state initially", () => {
    (fetchTransaction as jest.Mock).mockImplementation(() => new Promise(() => {}));

    render(
      <TransactionProvider>
        <TransactionTracker txHash="abc123" />
      </TransactionProvider>
    );

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("displays transaction details when loaded", async () => {
    (fetchTransaction as jest.Mock).mockResolvedValue({
      ok: true,
      data: mockConfirmedTransaction,
    });

    render(
      <TransactionProvider>
        <TransactionTracker txHash="abc123" />
      </TransactionProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/confirmed/i)).toBeInTheDocument();
    });
  });

  it("displays error state on failure", async () => {
    (fetchTransaction as jest.Mock).mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "Transaction not found" },
    });

    render(
      <TransactionProvider>
        <TransactionTracker txHash="abc123" />
      </TransactionProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/transaction not found/i)).toBeInTheDocument();
    });
  });

  it("displays pending transaction with progress", async () => {
    (fetchTransaction as jest.Mock).mockResolvedValue({
      ok: true,
      data: mockTransaction,
    });

    render(
      <TransactionProvider>
        <TransactionTracker txHash="abc123" />
      </TransactionProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/pending/i)).toBeInTheDocument();
    });
  });

  it("displays failed transaction with retry option", async () => {
    (fetchTransaction as jest.Mock).mockResolvedValue({
      ok: true,
      data: mockFailedTransaction,
    });

    render(
      <TransactionProvider>
        <TransactionTracker txHash="abc123" />
      </TransactionProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/failed/i)).toBeInTheDocument();
      expect(screen.getByText(/insufficient funds/i)).toBeInTheDocument();
    });
  });
});

// ─── Tests: TransactionHistory Component ──────────────────────────────────────

describe("TransactionHistory Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("displays loading state", () => {
    (fetchTransactionHistory as jest.Mock).mockImplementation(() => new Promise(() => {}));

    render(
      <TransactionProvider>
        <TransactionHistory />
      </TransactionProvider>
    );

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("displays transaction list", async () => {
    (fetchTransactionHistory as jest.Mock).mockResolvedValue({
      ok: true,
      data: {
        transactions: [mockTransaction, mockConfirmedTransaction],
        totalCount: 2,
        page: 1,
        pageSize: 20,
        hasMore: false,
      },
    });

    render(
      <TransactionProvider>
        <TransactionHistory />
      </TransactionProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/transaction history/i)).toBeInTheDocument();
    });
  });

  it("displays empty state when no transactions", async () => {
    (fetchTransactionHistory as jest.Mock).mockResolvedValue({
      ok: true,
      data: {
        transactions: [],
        totalCount: 0,
        page: 1,
        pageSize: 20,
        hasMore: false,
      },
    });

    render(
      <TransactionProvider>
        <TransactionHistory />
      </TransactionProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/no transactions found/i)).toBeInTheDocument();
    });
  });
});

// ─── Tests: TransactionSubmitForm Component ───────────────────────────────────

describe("TransactionSubmitForm Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders form fields", () => {
    render(
      <TransactionProvider>
        <TransactionSubmitForm />
      </TransactionProvider>
    );

    expect(screen.getByLabelText(/recipient address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/transaction type/i)).toBeInTheDocument();
  });

  it("validates address format", async () => {
    render(
      <TransactionProvider>
        <TransactionSubmitForm />
      </TransactionProvider>
    );

    const addressInput = screen.getByLabelText(/recipient address/i);
    await userEvent.type(addressInput, "invalid");
    
    // Click next to trigger validation
    fireEvent.click(screen.getByText(/next/i));

    await waitFor(() => {
      expect(screen.getByText(/invalid address format/i)).toBeInTheDocument();
    });
  });

  it("validates amount", async () => {
    render(
      <TransactionProvider>
        <TransactionSubmitForm />
      </TransactionProvider>
    );

    const amountInput = screen.getByLabelText(/amount/i);
    await userEvent.type(amountInput, "-1");
    
    fireEvent.click(screen.getByText(/next/i));

    await waitFor(() => {
      expect(screen.getByText(/amount must be greater than 0/i)).toBeInTheDocument();
    });
  });
});

// ─── Tests: Cache ─────────────────────────────────────────────────────────────

describe("Transaction Cache", () => {
  beforeEach(() => {
    transactionCache.clear();
  });

  it("stores and retrieves transactions", () => {
    transactionCache.set("abc123", mockTransaction);
    const cached = transactionCache.get("abc123");
    expect(cached).toEqual(mockTransaction);
  });

  it("returns undefined for expired cache entries", () => {
    transactionCache.set("abc123", mockTransaction);
    // Manually expire the cache entry
    const entry = (transactionCache as any).cache.get("abc123");
    entry.timestamp = Date.now() - 120000; // 2 minutes ago

    const cached = transactionCache.get("abc123");
    expect(cached).toBeUndefined();
  });

  it("invalidates specific entries", () => {
    transactionCache.set("abc123", mockTransaction);
    transactionCache.invalidate("abc123");
    expect(transactionCache.get("abc123")).toBeUndefined();
  });

  it("clears all entries", () => {
    transactionCache.set("abc123", mockTransaction);
    transactionCache.setHistory("key", {
      transactions: [mockTransaction],
      totalCount: 1,
      page: 1,
      pageSize: 20,
      hasMore: false,
    });

    transactionCache.clear();
    expect(transactionCache.get("abc123")).toBeUndefined();
    expect(transactionCache.getHistory("key")).toBeUndefined();
  });
});

// ─── Tests: Poller ────────────────────────────────────────────────────────────

describe("Transaction Poller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    transactionPoller.stopAll();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("starts polling when track is called", () => {
    const callback = jest.fn();
    (fetchTransaction as jest.Mock).mockResolvedValue({
      ok: true,
      data: mockTransaction,
    });

    const unsubscribe = transactionPoller.startPolling("abc123", callback);
    
    expect(fetchTransaction).toHaveBeenCalledWith("abc123", true);
    
    unsubscribe();
  });

  it("stops polling when unsubscribe is called", () => {
    const callback = jest.fn();
    (fetchTransaction as jest.Mock).mockResolvedValue({
      ok: true,
      data: mockConfirmedTransaction,
    });

    const unsubscribe = transactionPoller.startPolling("abc123", callback);
    unsubscribe();

    // Should not poll after unsubscribe
    jest.advanceTimersByTime(10000);
    expect(fetchTransaction).toHaveBeenCalledTimes(1);
  });

  it("stops polling when transaction is confirmed", async () => {
    const callback = jest.fn();
    (fetchTransaction as jest.Mock).mockResolvedValue({
      ok: true,
      data: mockConfirmedTransaction,
    });

    transactionPoller.startPolling("abc123", callback);

    // Wait for initial poll
    await waitFor(() => {
      expect(callback).toHaveBeenCalled();
    });

    // Advance timers - should not poll again since confirmed
    jest.advanceTimersByTime(10000);
    expect(fetchTransaction).toHaveBeenCalledTimes(1);
  });
});

// ─── Integration Tests ────────────────────────────────────────────────────────

describe("Transaction System Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    transactionCache.clear();
    transactionPoller.stopAll();
  });

  it("full transaction lifecycle: submit -> track -> confirm", async () => {
    const submittedTx = { ...mockTransaction, status: "pending" as TransactionStatus };
    const confirmedTx = { ...mockTransaction, status: "confirmed" as TransactionStatus, confirmations: 10 };

    (submitTransaction as jest.Mock).mockResolvedValue({
      ok: true,
      data: {
        success: true,
        txHash: "abc123",
        requiresSigning: false,
      },
    });

    (fetchTransaction as jest.Mock)
      .mockResolvedValueOnce({ ok: true, data: submittedTx })
      .mockResolvedValueOnce({ ok: true, data: confirmedTx });

    const TestFlow: React.FC = () => {
      const { submit, trackTransaction, getTransaction } = useTransactions();
      const [step, setStep] = React.useState("initial");

      const handleSubmit = async () => {
        const result = await submit({
          to: "GXYZ",
          amount: "100",
          type: "payment",
        });
        if (result.ok && result.data.success) {
          trackTransaction(result.data.txHash!);
          setStep("tracking");
        }
      };

      return (
        <div>
          <button onClick={handleSubmit}>Submit</button>
          <div data-testid="step">{step}</div>
          <div data-testid="tx-status">{getTransaction("abc123")?.status || "none"}</div>
        </div>
      );
    };

    render(
      <TransactionProvider>
        <TestFlow />
      </TransactionProvider>
    );

    fireEvent.click(screen.getByText("Submit"));

    await waitFor(() => {
      expect(screen.getByTestId("step")).toHaveTextContent("tracking");
    });

    expect(submitTransaction).toHaveBeenCalled();
  });
});
