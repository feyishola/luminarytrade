/**
 * apiClient.ts
 *
 * HTTP layer. Each function fetches raw data, runs it through the mapper,
 * and returns a typed ApiResult<T>. Components never see raw API shapes.
 *
 * Usage:
 *   const result = await fetchCreditScore('user-123');
 *   if (result.ok) {
 *     console.log(result.data.score); // fully typed CreditScore
 *   } else {
 *     console.error(result.error.message);
 *   }
 */

import { creditScoreMapper } from "../CreditScoreMapper";
import { fraudReportMapper } from "../FraudReportMapper";
import {
  RawApiEnvelope,
  RawCreditScoreResponse,
  RawFraudReportResponse,
} from "../interfaces/api-response";
import { CreditScore, FraudReport } from "../interfaces/domain";
import { ApiResult, mapEnvelope } from "../interfaces/Mapper.interface";

// ─── Config ───────────────────────────────────────────────────────────────────

// After — no process.env needed, CRA inlines REACT_APP_ vars at build time
const BASE_URL =
  (window as any).__ENV__?.REACT_APP_API_BASE_URL ??
  "http://localhost:3001/api";

// ─── HTTP primitive ───────────────────────────────────────────────────────────

async function get<T>(path: string, accessToken?: string): Promise<RawApiEnvelope<T>> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    credentials: "include",
  });

  if (!response.ok) {
    // Translate HTTP errors into the standard envelope shape
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

// ─── Domain fetch functions ───────────────────────────────────────────────────

/**
 * Fetch and map a user's credit score.
 */
export async function fetchCreditScore(
  userId: string,
  accessToken?: string,
): Promise<ApiResult<CreditScore>> {
  try {
    const raw = await get<RawCreditScoreResponse>(`/scores/${userId}`, accessToken);
    return mapEnvelope(raw, creditScoreMapper);
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
 * Fetch and map a user's fraud report.
 */
export async function fetchFraudReport(
  userId: string,
  accessToken?: string,
): Promise<ApiResult<FraudReport>> {
  try {
    const raw = await get<RawFraudReportResponse>(`/fraud/${userId}`, accessToken);
    return mapEnvelope(raw, fraudReportMapper);
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
