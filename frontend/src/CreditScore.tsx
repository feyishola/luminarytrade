/**
 * CreditScoring.tsx
 *
 * Fully type-safe component. Uses fetchCreditScore() which returns
 * ApiResult<CreditScore> — no `any`, no undefined property access.
 */

import React, { useEffect, useState } from "react";
import { fetchCreditScore } from "./hooks/apiClient";
import { CreditScore } from "./interfaces/domain";
import { useAuth } from "./context/AuthContext";

// ─── Sub-components ───────────────────────────────────────────────────────────

const RISK_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  low: { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" },
  medium: { bg: "#fefce8", text: "#ca8a04", border: "#fde68a" },
  high: { bg: "#fff7ed", text: "#ea580c", border: "#fed7aa" },
  critical: { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
};

const TREND_ICONS: Record<string, string> = {
  improving: "↑",
  declining: "↓",
  stable: "→",
};

const TREND_COLORS: Record<string, string> = {
  improving: "#16a34a",
  declining: "#dc2626",
  stable: "#64748b",
};

interface ScoreMeterProps {
  score: number;
}

const ScoreMeter: React.FC<ScoreMeterProps> = ({ score }) => {
  // Map 300–850 to 0–100%
  const pct = ((score - 300) / 550) * 100;
  const color =
    score >= 750
      ? "#16a34a"
      : score >= 650
        ? "#ca8a04"
        : score >= 550
          ? "#ea580c"
          : "#dc2626";

  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          height: 10,
          borderRadius: 5,
          backgroundColor: "#e2e8f0",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            backgroundColor: color,
            borderRadius: 5,
            transition: "width 0.6s ease",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 4,
          fontSize: 11,
          color: "#94a3b8",
        }}
      >
        <span>300</span>
        <span>Poor</span>
        <span>Fair</span>
        <span>Good</span>
        <span>850</span>
      </div>
    </div>
  );
};

interface FactorRowProps {
  name: string;
  impact: number;
  description: string;
}

const FactorRow: React.FC<FactorRowProps> = ({ name, impact, description }) => {
  const isPositive = impact >= 0;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid #f1f5f9",
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: isPositive ? "#16a34a" : "#dc2626",
          minWidth: 44,
          textAlign: "right",
        }}
      >
        {isPositive ? "+" : ""}
        {impact}
      </span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
          {name}
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
          {description}
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface CreditScoringProps {
  userId: string;
}

const CreditScoring: React.FC<CreditScoringProps> = ({ userId }) => {
  const [score, setScore] = useState<CreditScore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { accessToken } = useAuth();

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetchCreditScore(userId, accessToken ?? undefined).then((result) => {
      if (cancelled) return;

      if (result.ok) {
        setScore(result.data); // ✅ fully typed CreditScore
      } else {
        setError(result.error.message); // ✅ always a string
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>
        Loading credit score…
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: 20,
          backgroundColor: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: 10,
          color: "#dc2626",
          fontSize: 14,
        }}
      >
        {error}
      </div>
    );
  }

  if (!score) return null;

  const riskColors = RISK_COLORS[score.riskLevel];

  return (
    <div
      style={{
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        maxWidth: 520,
        border: "1px solid #e2e8f0",
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: riskColors.bg,
          borderBottom: `1px solid ${riskColors.border}`,
          padding: "24px 28px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#64748b",
                marginBottom: 4,
              }}
            >
              Credit Score
            </div>
            <div
              style={{
                fontSize: 52,
                fontWeight: 800,
                color: "#0f172a",
                lineHeight: 1,
              }}
            >
              {score.score}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <span
              style={{
                display: "inline-block",
                padding: "4px 12px",
                borderRadius: 20,
                backgroundColor: riskColors.text,
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {score.riskLevel} risk
            </span>

            <div
              style={{
                marginTop: 8,
                fontSize: 14,
                fontWeight: 600,
                color: TREND_COLORS[score.trend],
              }}
            >
              {TREND_ICONS[score.trend]} {score.trend}
            </div>
          </div>
        </div>

        <ScoreMeter score={score.score} />
      </div>

      {/* Factors */}
      <div style={{ padding: "20px 28px" }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#64748b",
            marginBottom: 4,
          }}
        >
          SCORE FACTORS
        </div>

        {score.factors.map((f) => (
          <FactorRow
            key={f.name}
            name={f.name}
            impact={f.impact}
            description={f.description}
          />
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "14px 28px",
          backgroundColor: "#f8fafc",
          borderTop: "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "#94a3b8",
        }}
      >
        <span>Last updated: {score.lastUpdated.toLocaleDateString()}</span>
        {score.nextUpdateAt && (
          <span>Next update: {score.nextUpdateAt.toLocaleDateString()}</span>
        )}
      </div>
    </div>
  );
};

export default CreditScoring;
