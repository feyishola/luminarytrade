/**
 * Modal.tsx
 *
 * Reusable Modal component with customizable content, animations, and accessibility.
 */

import React, { ReactNode, CSSProperties, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ModalSize = "small" | "medium" | "large" | "fullscreen";

export interface ModalProps {
  /** Whether modal is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Modal content */
  children: ReactNode;
  /** Modal title */
  title?: string;
  /** Modal size */
  size?: ModalSize;
  /** Show close button */
  showCloseButton?: boolean;
  /** Close on overlay click */
  closeOnOverlayClick?: boolean;
  /** Close on escape key */
  closeOnEscape?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Inline styles for content */
  style?: CSSProperties;
  /** Footer content */
  footer?: ReactNode;
  /** Test id */
  "data-testid"?: string;
}

// ─── Style Constants ──────────────────────────────────────────────────────────

const SIZE_STYLES: Record<ModalSize, CSSProperties> = {
  small: { maxWidth: "400px" },
  medium: { maxWidth: "600px" },
  large: { maxWidth: "900px" },
  fullscreen: { maxWidth: "100vw", height: "100vh", borderRadius: 0 },
};

// ─── Component ────────────────────────────────────────────────────────────────

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  size = "medium",
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className = "",
  style = {},
  footer,
  "data-testid": dataTestId,
}) => {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeOnEscape) {
        onClose();
      }
    },
    [closeOnEscape, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleEscape]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const overlayStyles: CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px",
  };

  const contentStyles: CSSProperties = {
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
    width: "100%",
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    animation: "modalFadeIn 0.2s ease",
    ...SIZE_STYLES[size],
    ...style,
  };

  const headerStyles: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px",
    borderBottom: "1px solid #e0e0e0",
  };

  const bodyStyles: CSSProperties = {
    padding: "20px",
    overflow: "auto",
    flex: 1,
  };

  const footerStyles: CSSProperties = {
    padding: "16px 20px",
    borderTop: "1px solid #e0e0e0",
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
  };

  return (
    <div
      className={`ui-modal-overlay ${className}`}
      style={overlayStyles}
      onClick={handleOverlayClick}
      data-testid={dataTestId || "modal-overlay"}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      <style>{`
        @keyframes modalFadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
      <div
        className={`ui-modal ui-modal--${size}`}
        style={contentStyles}
        onClick={(e) => e.stopPropagation()}
        data-testid="modal-content"
      >
        {(title || showCloseButton) && (
          <div className="ui-modal__header" style={headerStyles}>
            {title && (
              <h3
                id="modal-title"
                style={{
                  margin: 0,
                  fontSize: "20px",
                  fontWeight: 600,
                  color: "#333",
                }}
              >
                {title}
              </h3>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "#666",
                  padding: "4px",
                  lineHeight: 1,
                  borderRadius: "4px",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f5f5f5";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
                aria-label="Close modal"
                data-testid="modal-close-button"
              >
                ×
              </button>
            )}
          </div>
        )}
        <div className="ui-modal__body" style={bodyStyles}>
          {children}
        </div>
        {footer && (
          <div className="ui-modal__footer" style={footerStyles}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Modal Composition Components ─────────────────────────────────────────────

export interface ModalHeaderProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({
  children,
  className = "",
  style = {},
}) => (
  <div
    className={`ui-modal__header ${className}`}
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "20px",
      borderBottom: "1px solid #e0e0e0",
      ...style,
    }}
  >
    {children}
  </div>
);

export interface ModalBodyProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export const ModalBody: React.FC<ModalBodyProps> = ({
  children,
  className = "",
  style = {},
}) => (
  <div
    className={`ui-modal__body ${className}`}
    style={{
      padding: "20px",
      overflow: "auto",
      flex: 1,
      ...style,
    }}
  >
    {children}
  </div>
);

export interface ModalFooterProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  align?: "left" | "center" | "right";
}

export const ModalFooter: React.FC<ModalFooterProps> = ({
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
      className={`ui-modal__footer ${className}`}
      style={{
        padding: "16px 20px",
        borderTop: "1px solid #e0e0e0",
        display: "flex",
        justifyContent: alignMap[align],
        gap: "12px",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ─── Confirm Modal Component ──────────────────────────────────────────────────

export interface ConfirmModalProps extends Omit<ModalProps, "children" | "footer"> {
  /** Confirm message */
  message: string;
  /** Confirm button text */
  confirmText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Confirm handler */
  onConfirm: () => void;
  /** Confirm button variant */
  confirmVariant?: "primary" | "danger";
  /** Whether confirm is loading */
  confirmLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onClose,
  confirmVariant = "primary",
  confirmLoading = false,
  ...modalProps
}) => {
  const confirmStyles: CSSProperties = {
    padding: "10px 20px",
    fontSize: "16px",
    borderRadius: "4px",
    cursor: confirmLoading ? "not-allowed" : "pointer",
    opacity: confirmLoading ? 0.6 : 1,
    border: "none",
    backgroundColor: confirmVariant === "danger" ? "#d32f2f" : "#1976d2",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  };

  const cancelStyles: CSSProperties = {
    padding: "10px 20px",
    fontSize: "16px",
    borderRadius: "4px",
    cursor: "pointer",
    backgroundColor: "transparent",
    color: "#666",
    border: "1px solid #ccc",
  };

  return (
    <Modal
      {...modalProps}
      onClose={onClose}
      size="small"
      footer={
        <>
          <button onClick={onClose} style={cancelStyles} disabled={confirmLoading}>
            {cancelText}
          </button>
          <button onClick={onConfirm} style={confirmStyles} disabled={confirmLoading}>
            {confirmLoading && (
              <span
                style={{
                  display: "inline-block",
                  width: 16,
                  height: 16,
                  border: "2px solid currentColor",
                  borderRightColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 0.75s linear infinite",
                }}
              />
            )}
            {confirmText}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: "16px", color: "#333" }}>{message}</p>
    </Modal>
  );
};

export default Modal;
