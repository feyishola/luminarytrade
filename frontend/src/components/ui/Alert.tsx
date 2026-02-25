/**
 * Alert.tsx
 *
 * Reusable Alert component for notifications with variants and composition support.
 */

import React, { ReactNode, CSSProperties } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertVariant = "info" | "success" | "warning" | "error";
export type AlertSize = "small" | "medium" | "large";

export interface AlertProps {
  /** Alert content */
  children: ReactNode;
  /** Visual variant */
  variant?: AlertVariant;
  /** Alert size */
  size?: AlertSize;
  /** Alert title */
  title?: string;
  /** Show icon */
  showIcon?: boolean;
  /** Custom icon */
  icon?: ReactNode;
  /** Dismissible */
  dismissible?: boolean;
  /** Dismiss handler */
  onDismiss?: () => void;
  /** Additional CSS class */
  className?: string;
  /** Inline styles */
  style?: CSSProperties;
  /** Test id */
  "data-testid"?: string;
}

// ─── Style Constants ──────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<AlertVariant, { bg: string; border: string; color: string; icon: string }> = {
  info: {
    bg: "#e3f2fd",
    border: "#90caf9",
    color: "#1565c0",
    icon: "ℹ",
  },
  success: {
    bg: "#e8f5e9",
    border: "#a5d6a7",
    color: "#2e7d32",
    icon: "✓",
  },
  warning: {
    bg: "#fff3e0",
    border: "#ffcc80",
    color: "#ef6c00",
    icon: "⚠",
  },
  error: {
    bg: "#ffebee",
    border: "#ef9a9a",
    color: "#c62828",
    icon: "✕",
  },
};

const SIZE_STYLES: Record<AlertSize, { padding: string; fontSize: string; iconSize: string }> = {
  small: { padding: "8px 12px", fontSize: "14px", iconSize: "16px" },
  medium: { padding: "12px 16px", fontSize: "16px", iconSize: "20px" },
  large: { padding: "16px 20px", fontSize: "18px", iconSize: "24px" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export const Alert: React.FC<AlertProps> = ({
  children,
  variant = "info",
  size = "medium",
  title,
  showIcon = true,
  icon,
  dismissible = false,
  onDismiss,
  className = "",
  style = {},
  "data-testid": dataTestId,
}) => {
  const variantStyle = VARIANT_STYLES[variant];
  const sizeStyle = SIZE_STYLES[size];

  const baseStyles: CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    padding: sizeStyle.padding,
    backgroundColor: variantStyle.bg,
    border: `1px solid ${variantStyle.border}`,
    borderRadius: "4px",
    fontSize: sizeStyle.fontSize,
    color: variantStyle.color,
    ...style,
  };

  const iconStyles: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: sizeStyle.iconSize,
    height: sizeStyle.iconSize,
    fontSize: sizeStyle.iconSize,
    fontWeight: "bold",
    flexShrink: 0,
  };

  const contentStyles: CSSProperties = {
    flex: 1,
    minWidth: 0,
  };

  const titleStyles: CSSProperties = {
    margin: "0 0 4px 0",
    fontWeight: 600,
    fontSize: size === "small" ? "14px" : size === "large" ? "18px" : "16px",
  };

  const dismissStyles: CSSProperties = {
    background: "none",
    border: "none",
    fontSize: "18px",
    cursor: "pointer",
    color: variantStyle.color,
    opacity: 0.6,
    padding: "0 4px",
    lineHeight: 1,
    transition: "opacity 0.2s",
    flexShrink: 0,
  };

  const displayIcon = icon || (showIcon ? variantStyle.icon : null);

  return (
    <div
      className={`ui-alert ui-alert--${variant} ui-alert--${size} ${className}`}
      style={baseStyles}
      role="alert"
      data-testid={dataTestId || "alert"}
      data-variant={variant}
    >
      {displayIcon && (
        <span className="ui-alert__icon" style={iconStyles}>
          {displayIcon}
        </span>
      )}
      <div className="ui-alert__content" style={contentStyles}>
        {title && <h4 style={titleStyles}>{title}</h4>}
        <div>{children}</div>
      </div>
      {dismissible && (
        <button
          className="ui-alert__dismiss"
          style={dismissStyles}
          onClick={onDismiss}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
          aria-label="Dismiss alert"
          data-testid="alert-dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
};

// ─── Alert Group Component ────────────────────────────────────────────────────

export interface AlertGroupProps {
  /** Alert items */
  children: ReactNode;
  /** Spacing between alerts */
  spacing?: number;
  /** Additional CSS class */
  className?: string;
  /** Inline styles */
  style?: CSSProperties;
}

export const AlertGroup: React.FC<AlertGroupProps> = ({
  children,
  spacing = 8,
  className = "",
  style = {},
}) => {
  const baseStyles: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: `${spacing}px`,
    ...style,
  };

  return (
    <div className={`ui-alert-group ${className}`} style={baseStyles} role="list">
      {children}
    </div>
  );
};

// ─── Toast Alert Component ────────────────────────────────────────────────────

export interface ToastAlertProps extends AlertProps {
  /** Duration in milliseconds (0 for persistent) */
  duration?: number;
  /** Auto dismiss handler */
  onAutoDismiss?: () => void;
  /** Position */
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center" | "bottom-center";
}

export const ToastAlert: React.FC<ToastAlertProps> = ({
  duration = 5000,
  onAutoDismiss,
  position = "top-right",
  dismissible = true,
  ...alertProps
}) => {
  React.useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onAutoDismiss?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onAutoDismiss]);

  const positionStyles: CSSProperties = {
    position: "fixed",
    zIndex: 9999,
    maxWidth: "400px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    ...getPositionStyles(position),
  };

  function getPositionStyles(pos: string): CSSProperties {
    switch (pos) {
      case "top-right":
        return { top: "20px", right: "20px" };
      case "top-left":
        return { top: "20px", left: "20px" };
      case "bottom-right":
        return { bottom: "20px", right: "20px" };
      case "bottom-left":
        return { bottom: "20px", left: "20px" };
      case "top-center":
        return { top: "20px", left: "50%", transform: "translateX(-50%)" };
      case "bottom-center":
        return { bottom: "20px", left: "50%", transform: "translateX(-50%)" };
      default:
        return { top: "20px", right: "20px" };
    }
  }

  return (
    <div style={positionStyles}>
      <Alert dismissible={dismissible} {...alertProps} />
    </div>
  );
};

export default Alert;
