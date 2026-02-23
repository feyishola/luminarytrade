/**
 * Skeleton.tsx
 *
 * Reusable Skeleton loading components for various UI patterns.
 */

import React, { CSSProperties } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SkeletonVariant = "text" | "circular" | "rectangular" | "rounded";

export interface SkeletonProps {
  /** Skeleton variant */
  variant?: SkeletonVariant;
  /** Width (px, %, or css value) */
  width?: string | number;
  /** Height (px, %, or css value) */
  height?: string | number;
  /** Animation enabled */
  animate?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Inline styles */
  style?: CSSProperties;
  /** Test id */
  "data-testid"?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = "text",
  width,
  height,
  animate = true,
  className = "",
  style = {},
  "data-testid": dataTestId,
}) => {
  const baseStyles: CSSProperties = {
    backgroundColor: "#e0e0e0",
    width: width,
    height: height,
    ...getVariantStyles(variant),
    ...style,
  };

  if (animate) {
    baseStyles.animation = "skeleton-pulse 1.5s ease-in-out infinite";
  }

  function getVariantStyles(v: SkeletonVariant): CSSProperties {
    switch (v) {
      case "text":
        return {
          height: height || "1em",
          borderRadius: "4px",
          marginBottom: "0.5em",
        };
      case "circular":
        return {
          width: width || "40px",
          height: height || "40px",
          borderRadius: "50%",
        };
      case "rectangular":
        return {
          borderRadius: "0",
        };
      case "rounded":
        return {
          borderRadius: "8px",
        };
      default:
        return {};
    }
  }

  return (
    <>
      <style>{`
        @keyframes skeleton-pulse {
          0% {
            opacity: 1;
          }
          50% {
            opacity: 0.4;
          }
          100% {
            opacity: 1;
          }
        }
      `}</style>
      <span
        className={`ui-skeleton ui-skeleton--${variant} ${className}`}
        style={baseStyles}
        data-testid={dataTestId || "skeleton"}
      />
    </>
  );
};

// ─── Skeleton Text Component ──────────────────────────────────────────────────

export interface SkeletonTextProps {
  /** Number of lines */
  lines?: number;
  /** Width of last line (%) */
  lastLineWidth?: string;
  /** Line height */
  lineHeight?: string | number;
  /** Spacing between lines */
  spacing?: string | number;
  /** Additional CSS class */
  className?: string;
  /** Inline styles */
  style?: CSSProperties;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 3,
  lastLineWidth = "60%",
  lineHeight = "1em",
  spacing = "0.5em",
  className = "",
  style = {},
}) => {
  const baseStyles: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: spacing,
    ...style,
  };

  return (
    <div className={`ui-skeleton-text ${className}`} style={baseStyles}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          variant="text"
          height={lineHeight}
          width={index === lines - 1 ? lastLineWidth : "100%"}
          animate
        />
      ))}
    </div>
  );
};

// ─── Skeleton Card Component ──────────────────────────────────────────────────

export interface SkeletonCardProps {
  /** Show header skeleton */
  hasHeader?: boolean;
  /** Show footer skeleton */
  hasFooter?: boolean;
  /** Number of content lines */
  contentLines?: number;
  /** Additional CSS class */
  className?: string;
  /** Inline styles */
  style?: CSSProperties;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  hasHeader = true,
  hasFooter = true,
  contentLines = 3,
  className = "",
  style = {},
}) => {
  const baseStyles: CSSProperties = {
    backgroundColor: "#ffffff",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    padding: "20px",
    ...style,
  };

  return (
    <div className={`ui-skeleton-card ${className}`} style={baseStyles}>
      {hasHeader && (
        <div style={{ marginBottom: "16px" }}>
          <Skeleton variant="text" width="60%" height="24px" />
          <Skeleton variant="text" width="40%" height="16px" />
        </div>
      )}

      <div style={{ marginBottom: hasFooter ? "16px" : 0 }}>
        <SkeletonText lines={contentLines} />
      </div>

      {hasFooter && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            paddingTop: "16px",
            borderTop: "1px solid #e0e0e0",
          }}
        >
          <Skeleton variant="rounded" width="80px" height="36px" />
          <Skeleton variant="rounded" width="80px" height="36px" />
        </div>
      )}
    </div>
  );
};

// ─── Skeleton Table Component ─────────────────────────────────────────────────

export interface SkeletonTableProps {
  /** Number of rows */
  rows?: number;
  /** Number of columns */
  columns?: number;
  /** Show header */
  hasHeader?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Inline styles */
  style?: CSSProperties;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({
  rows = 5,
  columns = 4,
  hasHeader = true,
  className = "",
  style = {},
}) => {
  const baseStyles: CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
    ...style,
  };

  const cellStyles: CSSProperties = {
    padding: "12px",
    borderBottom: "1px solid #e0e0e0",
  };

  return (
    <table className={`ui-skeleton-table ${className}`} style={baseStyles}>
      {hasHeader && (
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, index) => (
              <th key={index} style={{ ...cellStyles, textAlign: "left" }}>
                <Skeleton variant="text" width={`${60 + (index % 3) * 20}%`} />
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <tr key={rowIndex}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <td key={colIndex} style={cellStyles}>
                <Skeleton variant="text" width={`${50 + (colIndex % 4) * 15}%`} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// ─── Skeleton Avatar Component ────────────────────────────────────────────────

export interface SkeletonAvatarProps {
  /** Avatar size */
  size?: "small" | "medium" | "large" | number;
  /** Additional CSS class */
  className?: string;
  /** Inline styles */
  style?: CSSProperties;
}

export const SkeletonAvatar: React.FC<SkeletonAvatarProps> = ({
  size = "medium",
  className = "",
  style = {},
}) => {
  const sizeMap = {
    small: 32,
    medium: 48,
    large: 64,
  };

  const actualSize = typeof size === "number" ? size : sizeMap[size];

  return (
    <Skeleton
      variant="circular"
      width={actualSize}
      height={actualSize}
      className={className}
      style={style}
    />
  );
};

// ─── Skeleton List Component ──────────────────────────────────────────────────

export interface SkeletonListProps {
  /** Number of items */
  items?: number;
  /** Show avatar */
  showAvatar?: boolean;
  /** Number of text lines per item */
  lines?: number;
  /** Additional CSS class */
  className?: string;
  /** Inline styles */
  style?: CSSProperties;
}

export const SkeletonList: React.FC<SkeletonListProps> = ({
  items = 5,
  showAvatar = true,
  lines = 2,
  className = "",
  style = {},
}) => {
  const baseStyles: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    ...style,
  };

  const itemStyles: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  };

  return (
    <div className={`ui-skeleton-list ${className}`} style={baseStyles}>
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} style={itemStyles}>
          {showAvatar && <SkeletonAvatar size="medium" />}
          <div style={{ flex: 1 }}>
            <SkeletonText lines={lines} lastLineWidth={lines > 1 ? "40%" : "70%"} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default Skeleton;
