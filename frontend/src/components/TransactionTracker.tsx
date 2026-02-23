/**
 * TransactionTracker.tsx
 *
 * Component for tracking and displaying a single transaction's status.
 * Shows real-time updates with polling, confirmation count, and error handling.
 */

import React, { useState, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  LinearProgress,
  Button,
  Alert,
  Link,
  Grid,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import {
  CheckCircle,
  Error,
  Schedule,
  Help,
  Refresh,
  OpenInNew,
  ContentCopy,
  Replay,
} from "@mui/icons-material";
import { useTransaction, useTransactions } from "../contexts/TransactionContext";
import { BlockchainTransaction, TransactionStatus } from "../interfaces/domain";

// ─── Status Configuration ─────────────────────────────────────────────────────

interface StatusConfig {
  color: "default" | "primary" | "success" | "error" | "warning";
  icon: React.ReactNode;
  label: string;
  progress?: boolean;
}

const STATUS_CONFIG: Record<TransactionStatus, StatusConfig> = {
  pending: {
    color: "warning",
    icon: <Schedule />,
    label: "Pending",
    progress: true,
  },
  confirmed: {
    color: "success",
    icon: <CheckCircle />,
    label: "Confirmed",
  },
  failed: {
    color: "error",
    icon: <Error />,
    label: "Failed",
  },
  unknown: {
    color: "default",
    icon: <Help />,
    label: "Unknown",
  },
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

function formatDate(date: Date | undefined): string {
  if (!date) return "N/A";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDuration(seconds: number | undefined): string {
  if (!seconds) return "N/A";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function getConfirmationProgress(confirmations: number): number {
  // Assume 10 confirmations is "fully confirmed"
  return Math.min((confirmations / 10) * 100, 100);
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

interface TransactionDetailsProps {
  transaction: BlockchainTransaction;
  truncateAddress: (address: string, chars?: number) => string;
  getExplorerUrl: (txHash: string, network?: "stellar" | "ethereum") => string;
}

const TransactionDetails: React.FC<TransactionDetailsProps> = ({
  transaction,
  truncateAddress,
  getExplorerUrl,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  const detailItems = [
    { label: "Transaction Hash", value: transaction.txHash, copyable: true },
    { label: "From", value: transaction.from, displayValue: truncateAddress(transaction.from), copyable: true },
    { label: "To", value: transaction.to, displayValue: truncateAddress(transaction.to), copyable: true },
    { label: "Type", value: transaction.type },
    { label: "Amount", value: transaction.amount || "N/A" },
    { label: "Fee", value: transaction.fees.formattedTotal },
    { label: "Block Number", value: transaction.blockNumber?.toString() || "Pending" },
    { label: "Confirmations", value: transaction.confirmations.toString() },
    { label: "Submitted", value: formatDate(transaction.submittedAt) },
    { label: "Completed", value: formatDate(transaction.completedAt) },
    { label: "Memo", value: transaction.memo || "N/A" },
  ];

  return (
    <Grid container spacing={2}>
      {detailItems.map((item) => (
        <Grid item xs={12} sm={6} key={item.label}>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 100 }}>
              {item.label}:
            </Typography>
            <Typography variant="body2" fontWeight="medium">
              {item.displayValue || item.value}
            </Typography>
            {item.copyable && (
              <Tooltip title={copiedField === item.label ? "Copied!" : "Copy"}>
                <IconButton
                  size="small"
                  onClick={() => copyToClipboard(item.value, item.label)}
                >
                  <ContentCopy fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Grid>
      ))}
      {transaction.explorerUrl && (
        <Grid item xs={12}>
          <Link
            href={transaction.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            display="flex"
            alignItems="center"
            gap={0.5}
          >
            View on Explorer
            <OpenInNew fontSize="small" />
          </Link>
        </Grid>
      )}
    </Grid>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface TransactionTrackerProps {
  txHash: string;
  onClose?: () => void;
  onRetry?: () => void;
  showDetails?: boolean;
  compact?: boolean;
}

export const TransactionTracker: React.FC<TransactionTrackerProps> = ({
  txHash,
  onClose,
  onRetry,
  showDetails = true,
  compact = false,
}) => {
  const { transaction, isLoading, error, refresh } = useTransaction(txHash);
  const { retry, formatType, truncateAddress, getExplorerUrl } = useTransactions();
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    setRetryError(null);

    const result = await retry(txHash);

    if (!result.ok) {
      setRetryError(result.error.message);
    } else {
      onRetry?.();
    }

    setIsRetrying(false);
  }, [txHash, retry, onRetry]);

  // Loading state
  if (isLoading && !transaction) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" gap={2}>
            <CircularProgress size={24} />
            <Typography>Loading transaction...</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error && !transaction) {
    return (
      <Card>
        <CardContent>
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={refresh} startIcon={<Refresh />}>
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // No transaction found
  if (!transaction) {
    return (
      <Card>
        <CardContent>
          <Alert severity="warning">Transaction not found</Alert>
        </CardContent>
      </Card>
    );
  }

  const statusConfig = STATUS_CONFIG[transaction.status];
  const isFailed = transaction.status === "failed";
  const isPending = transaction.status === "pending";
  const isConfirmed = transaction.status === "confirmed";

  // Compact view
  if (compact) {
    return (
      <Card variant="outlined">
        <CardContent sx={{ py: 1, px: 2, "&:last-child": { pb: 1 } }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
            <Box display="flex" alignItems="center" gap={1}>
              {statusConfig.icon}
              <Typography variant="body2" fontWeight="medium">
                {truncateAddress(transaction.txHash, 8)}
              </Typography>
            </Box>
            <Chip
              size="small"
              color={statusConfig.color}
              icon={statusConfig.icon as React.ReactElement}
              label={statusConfig.label}
            />
          </Box>
          {isPending && (
            <LinearProgress
              variant="indeterminate"
              sx={{ mt: 1, height: 2 }}
            />
          )}
        </CardContent>
      </Card>
    );
  }

  // Full view
  return (
    <Card>
      <CardContent>
        {/* Header */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <Chip
              color={statusConfig.color}
              icon={statusConfig.icon as React.ReactElement}
              label={statusConfig.label}
              size="medium"
            />
            <Typography variant="h6" component="div">
              Transaction
            </Typography>
          </Box>
          <Box display="flex" gap={1}>
            <Tooltip title="Refresh">
              <IconButton onClick={refresh} disabled={isLoading}>
                <Refresh />
              </IconButton>
            </Tooltip>
            {onClose && (
              <Button size="small" onClick={onClose}>
                Close
              </Button>
            )}
          </Box>
        </Box>

        {/* Error Alert */}
        {transaction.error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              transaction.error.retryable && (
                <Button
                  color="inherit"
                  size="small"
                  onClick={handleRetry}
                  disabled={isRetrying}
                  startIcon={isRetrying ? <CircularProgress size={16} /> : <Replay />}
                >
                  Retry
                </Button>
              )
            }
          >
            <Typography variant="body2" fontWeight="medium">
              {transaction.error.code}
            </Typography>
            <Typography variant="body2">{transaction.error.message}</Typography>
          </Alert>
        )}

        {retryError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {retryError}
          </Alert>
        )}

        {/* Progress for pending */}
        {isPending && (
          <Box mb={2}>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography variant="body2" color="text.secondary">
                Waiting for confirmations...
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {transaction.confirmations} / 10
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={getConfirmationProgress(transaction.confirmations)}
              sx={{ height: 8, borderRadius: 4 }}
            />
            {transaction.estimatedCompletionTime && (
              <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                Estimated time: {formatDuration(transaction.estimatedCompletionTime)}
              </Typography>
            )}
          </Box>
        )}

        {/* Success message */}
        {isConfirmed && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Transaction confirmed with {transaction.confirmations} confirmation
            {transaction.confirmations !== 1 ? "s" : ""}
          </Alert>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Details */}
        {showDetails && (
          <TransactionDetails
            transaction={transaction}
            truncateAddress={truncateAddress}
            getExplorerUrl={getExplorerUrl}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default TransactionTracker;
