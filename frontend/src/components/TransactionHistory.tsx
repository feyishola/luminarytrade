/**
 * TransactionHistory.tsx
 *
 * Component for displaying and filtering transaction history.
 * Includes search, status/type filters, pagination, and export functionality.
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Button,
  Alert,
  Skeleton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  InputAdornment,
} from "@mui/material";
import {
  Refresh,
  Download,
  Search,
  Visibility,
  CheckCircle,
  Error,
  Schedule,
  Help,
  Clear,
} from "@mui/icons-material";
import { useTransactions } from "../contexts/TransactionContext";
import { TransactionStatus, TransactionType, TransactionHistoryFilter } from "../interfaces/domain";
import { TransactionTracker } from "./TransactionTracker";

// ─── Status Configuration ─────────────────────────────────────────────────────

interface StatusConfig {
  color: "default" | "primary" | "success" | "error" | "warning";
  icon: React.ReactNode;
  label: string;
}

const STATUS_CONFIG: Record<TransactionStatus, StatusConfig> = {
  pending: {
    color: "warning",
    icon: <Schedule fontSize="small" />,
    label: "Pending",
  },
  confirmed: {
    color: "success",
    icon: <CheckCircle fontSize="small" />,
    label: "Confirmed",
  },
  failed: {
    color: "error",
    icon: <Error fontSize="small" />,
    label: "Failed",
  },
  unknown: {
    color: "default",
    icon: <Help fontSize="small" />,
    label: "Unknown",
  },
};

const TRANSACTION_TYPES: { value: TransactionType; label: string }[] = [
  { value: "payment", label: "Payment" },
  { value: "contract_call", label: "Contract Call" },
  { value: "token_transfer", label: "Token Transfer" },
  { value: "other", label: "Other" },
];

// ─── Helper Functions ─────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

interface FilterPanelProps {
  filter: TransactionHistoryFilter;
  onFilterChange: (filter: TransactionHistoryFilter) => void;
  onClearFilters: () => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  filter,
  onFilterChange,
  onClearFilters,
}) => {
  const hasFilters =
    filter.status || filter.type || filter.searchQuery || filter.startDate || filter.endDate;

  return (
    <Box mb={3}>
      <Grid container spacing={2} alignItems="center">
        {/* Search */}
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search by hash, address, or memo..."
            value={filter.searchQuery || ""}
            onChange={(e) =>
              onFilterChange({ ...filter, searchQuery: e.target.value || undefined })
            }
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </Grid>

        {/* Status Filter */}
        <Grid item xs={6} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select
              value={filter.status || ""}
              label="Status"
              onChange={(e) =>
                onFilterChange({
                  ...filter,
                  status: (e.target.value as TransactionStatus) || undefined,
                })
              }
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="confirmed">Confirmed</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        {/* Type Filter */}
        <Grid item xs={6} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Type</InputLabel>
            <Select
              value={filter.type || ""}
              label="Type"
              onChange={(e) =>
                onFilterChange({
                  ...filter,
                  type: (e.target.value as TransactionType) || undefined,
                })
              }
            >
              <MenuItem value="">All</MenuItem>
              {TRANSACTION_TYPES.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Clear Filters */}
        <Grid item xs={12} md={2}>
          {hasFilters && (
            <Button
              fullWidth
              size="small"
              startIcon={<Clear />}
              onClick={onClearFilters}
            >
              Clear Filters
            </Button>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

interface TransactionTableProps {
  transactions: import("../interfaces/domain").BlockchainTransaction[];
  onViewDetails: (txHash: string) => void;
  truncateHash: (hash: string, chars?: number) => string;
  truncateAddress: (address: string, chars?: number) => string;
  formatType: (type: string) => string;
}

const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  onViewDetails,
  truncateHash,
  truncateAddress,
  formatType,
}) => {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Hash</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>From</TableCell>
            <TableCell>To</TableCell>
            <TableCell align="right">Amount</TableCell>
            <TableCell align="right">Fee</TableCell>
            <TableCell>Submitted</TableCell>
            <TableCell align="center">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions.map((tx) => {
            const statusConfig = STATUS_CONFIG[tx.status];
            return (
              <TableRow key={tx.txHash} hover>
                <TableCell>
                  <Tooltip title={tx.txHash}>
                    <span>{truncateHash(tx.txHash, 8)}</span>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={statusConfig.color}
                    icon={statusConfig.icon as React.ReactElement}
                    label={statusConfig.label}
                  />
                </TableCell>
                <TableCell>{formatType(tx.type)}</TableCell>
                <TableCell>{truncateAddress(tx.from)}</TableCell>
                <TableCell>{truncateAddress(tx.to)}</TableCell>
                <TableCell align="right">{tx.amount || "-"}</TableCell>
                <TableCell align="right">{tx.fees.formattedTotal}</TableCell>
                <TableCell>{formatDate(tx.submittedAt)}</TableCell>
                <TableCell align="center">
                  <Tooltip title="View Details">
                    <IconButton
                      size="small"
                      onClick={() => onViewDetails(tx.txHash)}
                    >
                      <Visibility fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface TransactionHistoryProps {
  onTransactionSelect?: (txHash: string) => void;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  onTransactionSelect,
}) => {
  const {
    history,
    isLoadingHistory,
    historyError,
    loadHistory,
    refreshHistory,
    exportHistory,
    truncateHash,
    truncateAddress,
    formatType,
  } = useTransactions();

  const [filter, setFilter] = useState<TransactionHistoryFilter>({});
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedTx, setSelectedTx] = useState<string | null>(null);

  // Load history on mount and when filter/page changes
  useEffect(() => {
    loadHistory(filter, page + 1, rowsPerPage);
  }, [filter, page, rowsPerPage, loadHistory]);

  const handleClearFilters = useCallback(() => {
    setFilter({});
    setPage(0);
  }, []);

  const handleChangePage = useCallback((_: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handleChangeRowsPerPage = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setRowsPerPage(parseInt(event.target.value, 10));
      setPage(0);
    },
    []
  );

  const handleViewDetails = useCallback(
    (txHash: string) => {
      setSelectedTx(txHash);
      onTransactionSelect?.(txHash);
    },
    [onTransactionSelect]
  );

  const handleCloseDetails = useCallback(() => {
    setSelectedTx(null);
  }, []);

  const handleExport = useCallback(() => {
    const timestamp = new Date().toISOString().split("T")[0];
    exportHistory(`transaction-history-${timestamp}.csv`);
  }, [exportHistory]);

  return (
    <Card>
      <CardContent>
        {/* Header */}
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          mb={3}
        >
          <Typography variant="h6">Transaction History</Typography>
          <Box display="flex" gap={1}>
            <Tooltip title="Refresh">
              <IconButton onClick={refreshHistory} disabled={isLoadingHistory}>
                <Refresh />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Download />}
              onClick={handleExport}
              disabled={!history?.transactions.length}
            >
              Export
            </Button>
          </Box>
        </Box>

        {/* Error Alert */}
        {historyError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {historyError}
          </Alert>
        )}

        {/* Filters */}
        <FilterPanel
          filter={filter}
          onFilterChange={setFilter}
          onClearFilters={handleClearFilters}
        />

        {/* Loading State */}
        {isLoadingHistory && !history && (
          <Box>
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} height={50} sx={{ mb: 1 }} />
            ))}
          </Box>
        )}

        {/* Empty State */}
        {!isLoadingHistory && history?.transactions.length === 0 && (
          <Alert severity="info">No transactions found</Alert>
        )}

        {/* Transaction Table */}
        {history && history.transactions.length > 0 && (
          <>
            <TransactionTable
              transactions={history.transactions}
              onViewDetails={handleViewDetails}
              truncateHash={truncateHash}
              truncateAddress={truncateAddress}
              formatType={formatType}
            />
            <TablePagination
              component="div"
              count={history.totalCount}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[5, 10, 20, 50]}
            />
          </>
        )}
      </CardContent>

      {/* Details Dialog */}
      <Dialog
        open={!!selectedTx}
        onClose={handleCloseDetails}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Transaction Details</DialogTitle>
        <DialogContent>
          {selectedTx && (
            <TransactionTracker txHash={selectedTx} showDetails />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDetails}>Close</Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default TransactionHistory;
