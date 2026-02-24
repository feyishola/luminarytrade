/**
 * Card.tsx
 *
 * Reusable Card component with consistent styling and composition support.
 * Supports headers, footers, padding variants, and elevation levels.
 */

import React, { ReactNode, CSSProperties } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CardVariant = "default" | "outlined" | "elevated" | "flat";
export type CardPadding = "none" | "small" | "medium" | "large";
export type CardBorderRadius = "none" | "small" | "medium" | "large";

export interface CardProps {
  /** Card content */
  children: ReactNode;
  /** Visual variant */
  variant?: CardVariant;
  /** Padding size */
  padding?: CardPadding;
  /** Border radius */
  borderRadius?: CardBorderRadius;
  /** Optional header content */
  header?: ReactNode;
  /** Optional footer content */
  footer?: ReactNode;
  /** Optional title (renders in header) */
  title?: string;
  /** Optional subtitle (renders in header) */
  subtitle?: string;
  /** Additional CSS class */
  className?: string;
  /** Inline styles */
  style?: CSSProperties;
  /** Click handler */
  onClick?: () => void;
  /** Hover effect */
  hoverable?: boolean;
  /** Full width */
  fullWidth?: boolean;
  /** Maximum width */
  maxWidth?: string | number;
  /** Test id */
  "data-testid"?: string;
}

// ─── Style Constants ──────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<CardVariant, CSSProperties> = {
  default: {
    backgroundColor: "#ffffff",
    border: "1px solid #e0e0e0",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  },
  outlined: {
    backgroundColor: "#ffffff",
    border: "1px solid #e0e0e0",
    boxShadow: "none",
  },
  elevated: {
    backgroundColor: "#ffffff",
    border: "none",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  },
  flat: {
    backgroundColor: "#f5f5f5",
    border: "none",
    boxShadow: "none",
  },
};

const PADDING_STYLES: Record<CardPadding, string> = {
  none: "0",
  small: "12px",
  medium: "20px",
  large: "32px",
};

const BORDER_RADIUS_STYLES: Record<CardBorderRadius, string> = {
  none: "0",
  small: "4px",
  medium: "8px",
  large: "16px",
};

// ─── Component ────────────────────────────────────────────────────────────────

export const Card: React.FC<CardProps> = ({
  children,
  variant = "default",
  padding = "medium",
  borderRadius = "medium",
  header,
  footer,
  title,
  subtitle,
  className = "",
  style = {},
  onClick,
  hoverable = false,
  fullWidth = false,
  maxWidth,
  "data-testid": dataTestId,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const baseStyles: CSSProperties = {
    ...VARIANT_STYLES[variant],
    borderRadius: BORDER_RADIUS_STYLES[borderRadius],
    transition: hoverable ? "box-shadow 0.2s ease, transform 0.2s ease" : undefined,
    cursor: onClick ? "pointer" : "default",
    width: fullWidth ? "100%" : undefined,
    maxWidth: maxWidth,
    boxSizing: "border-box",
    ...style,
  };
  const hoverStyles: CSSProperties =
    hoverable && isHovered
      ? {
          boxShadow: "0 6px 16px rgba(0,0,0,0.2)",
          transform: "translateY(-2px)",
        }
      : {};

  const renderHeader = () => {
    if (header) return header;
    if (title || subtitle) {
      return (
        <div
          style={{
            padding: PADDING_STYLES[padding],
            paddingBottom: subtitle ? "8px" : PADDING_STYLES[padding],
            borderBottom: variant !== "flat" ? "1px solid #e0e0e0" : undefined,
          }}
        >
          {title && (
            <h3
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: 600,
                color: "#333",
              }}
            >
              {title}
            </h3>
          )}
          {subtitle && (
            <p
              style={{
                margin: title ? "4px 0 0 0" : 0,
                fontSize: "14px",
                color: "#666",
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const cardHeader = renderHeader();

  return (
    <div
      className={`ui-card ui-card--${variant} ${className}`}
      style={{ ...baseStyles, ...hoverStyles }}
      onClick={onClick}
      onMouseEnter={hoverable ? () => setIsHovered(true) : undefined}
      onMouseLeave={hoverable ? () => setIsHovered(false) : undefined}
      data-testid={dataTestId || "card"}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {cardHeader}
      <div
        className="ui-card__content"
        style={{
          padding: PADDING_STYLES[padding],
          paddingTop: cardHeader ? (title || subtitle ? PADDING_STYLES[padding] : undefined) : undefined,
        }}
      >
        {children}
      </div>
      {footer && (
        <div
          className="ui-card__footer"
          style={{
            padding: PADDING_STYLES[padding],
            paddingTop: "12px",
            borderTop: variant !== "flat" ? "1px solid #e0e0e0" : undefined,
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
};

// ─── Card Composition Components ──────────────────────────────────────────────

export interface CardHeaderProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  children,
  className = "",
  style = {},
}) => (
  <div
    className={`ui-card__header ${className}`}
    style={{
      padding: "20px",
      borderBottom: "1px solid #e0e0e0",
      ...style,
    }}
  >
    {children}
  </div>
);

export interface CardContentProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  padding?: CardPadding;
}

export const CardContent: React.FC<CardContentProps> = ({
  children,
  className = "",
  style = {},
  padding = "medium",
}) => (
  <div
    className={`ui-card__content ${className}`}
    style={{
      padding: PADDING_STYLES[padding],
      ...style,
    }}
  >
    {children}
  </div>
);

export interface CardFooterProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  align?: "left" | "center" | "right";
}

export const CardFooter: React.FC<CardFooterProps> = ({
  children,
  className = "",
  style = {},
  align = "right",
}) => {
  const alignMap = {
    left: "flex-start",
    center: "center",
    right: "flex-end",
  };

  return (
    <div
      className={`ui-card__footer ${className}`}
      style={{
        padding: "12px 20px",
        borderTop: "1px solid #e0e0e0",
        display: "flex",
        justifyContent: alignMap[align],
        gap: "8px",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export default Card;
