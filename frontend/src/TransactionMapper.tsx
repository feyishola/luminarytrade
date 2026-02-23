/**
 * TransactionMapper.ts
 *
 * Maps raw transaction API responses to domain types.
 * Handles all field name transformations and type conversions.
 */

import { BaseMapper, MappingError } from "./interfaces/Mapper.interface";
import {
  RawTransactionResponse,
  RawTransactionFee,
  RawTransactionError,
  RawTransactionHistoryResponse,
  RawTransactionSubmissionResponse,
} from "./interfaces/api-response";
import {
  BlockchainTransaction,
  TransactionFee,
  TransactionError,
  TransactionHistoryResult,
  TransactionSubmissionResult,
  TransactionStatus,
  TransactionType,
} from "./interfaces/domain";

// ─── Transaction Fee Mapper ───────────────────────────────────────────────────

class TransactionFeeMapper extends BaseMapper<RawTransactionFee, TransactionFee> {
  map(input: RawTransactionFee): TransactionFee {
    if (!input.base_fee) {
      throw new MappingError("base_fee", "Base fee is required");
    }
    if (!input.total_fee) {
      throw new MappingError("total_fee", "Total fee is required");
    }
    if (!input.formatted_total) {
      throw new MappingError("formatted_total", "Formatted total is required");
    }

    return {
      baseFee: input.base_fee,
      priorityFee: input.priority_fee,
      totalFee: input.total_fee,
      formattedTotal: input.formatted_total,
    };
  }
}

export const transactionFeeMapper = new TransactionFeeMapper();

// ─── Transaction Error Mapper ─────────────────────────────────────────────────

class TransactionErrorMapper extends BaseMapper<RawTransactionError, TransactionError> {
  map(input: RawTransactionError): TransactionError {
    if (!input.error_code) {
      throw new MappingError("error_code", "Error code is required");
    }
    if (!input.error_message) {
      throw new MappingError("error_message", "Error message is required");
    }

    return {
      code: input.error_code,
      message: input.error_message,
      details: input.error_details,
      retryable: input.retryable ?? false,
    };
  }
}

export const transactionErrorMapper = new TransactionErrorMapper();

// ─── Transaction Status Validator ─────────────────────────────────────────────

const VALID_STATUSES: TransactionStatus[] = ["pending", "confirmed", "failed", "unknown"];

function validateStatus(status: string): TransactionStatus {
  if (VALID_STATUSES.includes(status as TransactionStatus)) {
    return status as TransactionStatus;
  }
  return "unknown";
}

// ─── Transaction Type Validator ───────────────────────────────────────────────

const VALID_TYPES: TransactionType[] = ["payment", "contract_call", "token_transfer", "other"];

function validateType(type: string): TransactionType {
  if (VALID_TYPES.includes(type as TransactionType)) {
    return type as TransactionType;
  }
  return "other";
}

// ─── Transaction Mapper ───────────────────────────────────────────────────────

class TransactionMapper extends BaseMapper<RawTransactionResponse, BlockchainTransaction> {
  map(input: RawTransactionResponse): BlockchainTransaction {
    // Validate required fields
    if (!input.tx_hash) {
      throw new MappingError("tx_hash", "Transaction hash is required");
    }
    if (!input.from_address) {
      throw new MappingError("from_address", "From address is required");
    }
    if (!input.to_address) {
      throw new MappingError("to_address", "To address is required");
    }
    if (!input.submitted_at) {
      throw new MappingError("submitted_at", "Submitted timestamp is required");
    }
    if (!input.last_updated_at) {
      throw new MappingError("last_updated_at", "Last updated timestamp is required");
    }
    if (!input.fees) {
      throw new MappingError("fees", "Transaction fees are required");
    }

    // Map fees
    const feeResult = transactionFeeMapper.tryMap(input.fees);
    if (!feeResult.ok) {
      throw new MappingError("fees", feeResult.error.message);
    }

    // Map error if present
    let error: TransactionError | undefined;
    if (input.error) {
      const errorResult = transactionErrorMapper.tryMap(input.error);
      if (errorResult.ok) {
        error = errorResult.value;
      }
    }

    return {
      txHash: input.tx_hash,
      status: validateStatus(input.status),
      type: validateType(input.type),
      from: input.from_address,
      to: input.to_address,
      amount: input.amount,
      fees: feeResult.value,
      confirmations: input.confirmations ?? 0,
      estimatedCompletionTime: input.estimated_completion_time,
      completedAt: input.completed_at ? new Date(input.completed_at) : undefined,
      blockNumber: input.block_number,
      submittedAt: new Date(input.submitted_at),
      lastUpdatedAt: new Date(input.last_updated_at),
      error,
      rawData: input.raw_data,
      explorerUrl: input.explorer_url,
      memo: input.memo,
    };
  }
}

export const transactionMapper = new TransactionMapper();

// ─── Transaction History Mapper ───────────────────────────────────────────────

class TransactionHistoryMapper extends BaseMapper<RawTransactionHistoryResponse, TransactionHistoryResult> {
  map(input: RawTransactionHistoryResponse): TransactionHistoryResult {
    if (!Array.isArray(input.transactions)) {
      throw new MappingError("transactions", "Transactions array is required");
    }

    const transactions: BlockchainTransaction[] = [];
    for (const rawTx of input.transactions) {
      const result = transactionMapper.tryMap(rawTx);
      if (result.ok) {
        transactions.push(result.value);
      }
      // Skip invalid transactions but continue processing others
    }

    return {
      transactions,
      totalCount: input.total_count ?? transactions.length,
      page: input.page ?? 1,
      pageSize: input.page_size ?? 20,
      hasMore: input.has_more ?? false,
    };
  }
}

export const transactionHistoryMapper = new TransactionHistoryMapper();

// ─── Transaction Submission Mapper ────────────────────────────────────────────

class TransactionSubmissionMapper extends BaseMapper<RawTransactionSubmissionResponse, TransactionSubmissionResult> {
  map(input: RawTransactionSubmissionResponse): TransactionSubmissionResult {
    let estimatedFees: TransactionFee | undefined;
    let error: TransactionError | undefined;

    if (input.estimated_fees) {
      const feeResult = transactionFeeMapper.tryMap(input.estimated_fees);
      if (feeResult.ok) {
        estimatedFees = feeResult.value;
      }
    }

    if (input.error) {
      const errorResult = transactionErrorMapper.tryMap(input.error);
      if (errorResult.ok) {
        error = errorResult.value;
      }
    }

    return {
      success: input.success ?? false,
      txHash: input.tx_hash,
      estimatedFees,
      error,
      requiresSigning: input.requires_signing ?? true,
    };
  }
}

export const transactionSubmissionMapper = new TransactionSubmissionMapper();
