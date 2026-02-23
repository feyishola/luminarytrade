/**
 * Button.tsx
 *
 * Reusable Button component with variants, sizes, loading state, and composition support.
 */

import React, { ReactNode, CSSProperties, ButtonHTMLAttributes } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "small" | "medium" | "large";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button content */
  children: ReactNode;
  /** Visual variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Loading state */
  loading?: boolean;
  /** Loading text (defaults to children) */
  loadingText?: string;
  /** Full width button */
  fullWidth?: boolean;
  /** Icon before text */
  leftIcon?: ReactNode;
  /** Icon after text */
  rightIcon?: ReactNode;
  /** Additional CSS class */
  className?: string;
  /** Inline styles */
  style?: CSSProperties;
  /** Test id */
  "data-testid"?: string;
}

// ─── Style Constants ──────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<ButtonVariant, CSSProperties> = {
  primary: {
    backgroundColor: "#1976d2",
    color: "#ffffff",
    border: "1px solid #1976d2",
  },
  secondary: {
    backgroundColor: "#f5f5f5",
    color: "#333333",
    border: "1px solid #e0e0e0",
  },
  outline: {
    backgroundColor: "transparent",
    color: "#1976d2",
    border: "1px solid #1976d2",
  },
  ghost: {
    backgroundColor: "transparent",
    color: "#1976d2",
    border: "1px solid transparent",
  },
  danger: {
    backgroundColor: "#d32f2f",
    color: "#ffffff",
    border: "1px solid #d32f2f",
  },
};

const SIZE_STYLES: Record<ButtonSize, CSSProperties> = {
  small: {
    padding: "6px 12px",
    fontSize: "14px",
    height: "32px",
  },
  medium: {
    padding: "10px 20px",
    fontSize: "16px",
    height: "40px",
  },
  large: {
    padding: "14px 28px",
    fontSize: "18px",
    height: "48px",
  },
};

const HOVER_STYLES: Record<ButtonVariant, CSSProperties> = {
  primary: { backgroundColor: "#1565c0" },
  secondary: { backgroundColor: "#e0e0e0" },
  outline: { backgroundColor: "rgba(25, 118, 210, 0.08)" },
  ghost: { backgroundColor: "rgba(25, 118, 210, 0.08)" },
  danger: { backgroundColor: "#b71c1c" },
};

// ─── Loading Spinner Component ────────────────────────────────────────────────

const LoadingSpinner: React.FC<{ size: ButtonSize }> = ({ size }) => {
  const spinnerSize = size === "small" ? 14 : size === "large" ? 22 : 18;

  return (
    <span
      style={{
        display: "inline-block",
        width: spinnerSize,
        height: spinnerSize,
        border: "2px solid currentColor",
        borderRightColor: "transparent",
        borderRadius: "50%",
        animation: "spin 0.75s linear infinite",
        marginRight: "8px",
      }}
    >
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </span>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "medium",
  loading = false,
  loadingText,
  fullWidth = false,
  leftIcon,
  rightIcon,
  className = "",
  style = {},
  disabled,
  onClick,
  type = "button",
  "data-testid": dataTestId,
  ...rest
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  const baseStyles: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 500,
    borderRadius: "4px",
    cursor: disabled || loading ? "not-allowed" : "pointer",
    opacity: disabled || loading ? 0.6 : 1,
    transition: "all 0.2s ease",
    whiteSpace: "nowrap",
    width: fullWidth ? "100%" : undefined,
    ...VARIANT_STYLES[variant],
    ...SIZE_STYLES[size],
    ...(isHovered && !disabled && !loading ? HOVER_STYLES[variant] : {}),
    ...style,
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (loading || disabled) return;
    onClick?.(e);
  };

  const content = loading ? (
    <>
      <LoadingSpinner size={size} />
      {loadingText || children}
    </>
  ) : (
    <>
      {leftIcon && <span style={{ marginRight: "8px", display: "flex" }}>{leftIcon}</span>}
      {children}
      {rightIcon && <span style={{ marginLeft: "8px", display: "flex" }}>{rightIcon}</span>}
    </>
  );

  return (
    <button
      type={type}
      className={`ui-button ui-button--${variant} ui-button--${size} ${className}`}
      style={baseStyles}
      onClick={handleClick}
      disabled={disabled || loading}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid={dataTestId || "button"}
      data-loading={loading}
      data-variant={variant}
      {...rest}
    >
      {content}
    </button>
  );
};

// ─── Button Group Component ───────────────────────────────────────────────────

export interface ButtonGroupProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  attached?: boolean;
  spacing?: number;
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({
  children,
  className = "",
  style = {},
  attached = false,
  spacing = 8,
}) => {
  const baseStyles: CSSProperties = {
    display: "inline-flex",
    gap: attached ? 0 : spacing,
    ...style,
  };

  return (
    <div
      className={`ui-button-group ${attached ? "ui-button-group--attached" : ""} ${className}`}
      style={baseStyles}
      role="group"
    >
      {children}
    </div>
  );
};

// ─── Icon Button Component ────────────────────────────────────────────────────

export interface IconButtonProps extends Omit<ButtonProps, "leftIcon" | "rightIcon" | "children"> {
  /** Icon to display */
  icon: ReactNode;
  /** Accessible label */
  "aria-label": string;
  /** Button size */
  size?: ButtonSize;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  size = "medium",
  variant = "ghost",
  className = "",
  style = {},
  ...rest
}) => {
  const sizeMap: Record<ButtonSize, number> = {
    small: 32,
    medium: 40,
    large: 48,
  };

  const iconSizeMap: Record<ButtonSize, number> = {
    small: 16,
    medium: 20,
    large: 24,
  };

  const baseStyles: CSSProperties = {
    width: sizeMap[size],
    height: sizeMap[size],
    padding: 0,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    ...style,
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={`ui-icon-button ${className}`}
      style={baseStyles}
      {...rest}
    >
      <span style={{ fontSize: iconSizeMap[size], display: "flex" }}>{icon}</span>
    </Button>
  );
};

export default Button;
