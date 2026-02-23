/**
 * Stepper.tsx
 *
 * Reusable Stepper component for multi-step flows with composition support.
 */

import React, { ReactNode, CSSProperties } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StepStatus = "pending" | "current" | "completed" | "error";

export interface Step {
  /** Step label */
  label: string;
  /** Step description */
  description?: string;
  /** Optional icon */
  icon?: ReactNode;
  /** Step status */
  status?: StepStatus;
  /** Disabled state */
  disabled?: boolean;
}

export interface StepperProps {
  /** Steps configuration */
  steps: Step[];
  /** Current active step (0-based) */
  activeStep: number;
  /** Step change handler */
  onStepClick?: (step: number) => void;
  /** Orientation */
  orientation?: "horizontal" | "vertical";
  /** Alternative label placement */
  alternativeLabel?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Inline styles */
  style?: CSSProperties;
  /** Test id */
  "data-testid"?: string;
}

export interface StepContentProps {
  /** Content for the step */
  children: ReactNode;
  /** Step index */
  step: number;
  /** Current active step */
  activeStep: number;
  /** Additional CSS class */
  className?: string;
  /** Inline styles */
  style?: CSSProperties;
}

// ─── Style Constants ──────────────────────────────────────────────────────────

const STATUS_COLORS: Record<StepStatus, { bg: string; color: string; border: string }> = {
  pending: { bg: "#f5f5f5", color: "#999", border: "#e0e0e0" },
  current: { bg: "#1976d2", color: "#fff", border: "#1976d2" },
  completed: { bg: "#4caf50", color: "#fff", border: "#4caf50" },
  error: { bg: "#d32f2f", color: "#fff", border: "#d32f2f" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export const Stepper: React.FC<StepperProps> = ({
  steps,
  activeStep,
  onStepClick,
  orientation = "horizontal",
  alternativeLabel = false,
  className = "",
  style = {},
  "data-testid": dataTestId,
}) => {
  const isVertical = orientation === "vertical";

  const getStepStatus = (index: number): StepStatus => {
    const step = steps[index];
    if (step.status) return step.status;
    if (index < activeStep) return "completed";
    if (index === activeStep) return "current";
    return "pending";
  };

  const containerStyles: CSSProperties = {
    display: "flex",
    flexDirection: isVertical ? "column" : "row",
    alignItems: isVertical ? "flex-start" : alternativeLabel ? "flex-start" : "center",
    justifyContent: "space-between",
    width: "100%",
    ...style,
  };

  const stepStyles = (index: number): CSSProperties => ({
    display: "flex",
    flexDirection: isVertical || !alternativeLabel ? "row" : "column",
    alignItems: "center",
    flex: isVertical ? undefined : 1,
    cursor: onStepClick && !steps[index].disabled ? "pointer" : "default",
    opacity: steps[index].disabled ? 0.5 : 1,
    position: "relative",
  });

  const connectorStyles = (index: number): CSSProperties => ({
    flex: 1,
    height: isVertical ? "40px" : "2px",
    width: isVertical ? "2px" : undefined,
    backgroundColor: index < activeStep ? "#4caf50" : "#e0e0e0",
    margin: isVertical ? "4px 0 4px 19px" : "0 8px",
    display: index === steps.length - 1 ? "none" : "block",
  });

  const renderStepIndicator = (step: Step, index: number) => {
    const status = getStepStatus(index);
    const colors = STATUS_COLORS[status];
    const size = 40;

    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: colors.bg,
          color: colors.color,
          border: `2px solid ${colors.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 600,
          fontSize: "16px",
          flexShrink: 0,
          transition: "all 0.3s ease",
        }}
      >
        {step.icon || (status === "completed" ? "✓" : index + 1)}
      </div>
    );
  };

  const renderStepLabel = (step: Step, index: number) => {
    const status = getStepStatus(index);
    const isActive = status === "current";

    return (
      <div
        style={{
          marginLeft: isVertical || !alternativeLabel ? "12px" : 0,
          marginTop: alternativeLabel && !isVertical ? "8px" : 0,
          textAlign: alternativeLabel && !isVertical ? "center" : "left",
        }}
      >
        <div
          style={{
            fontWeight: isActive ? 600 : 400,
            fontSize: "14px",
            color: isActive ? "#1976d2" : "#333",
          }}
        >
          {step.label}
        </div>
        {step.description && (
          <div
            style={{
              fontSize: "12px",
              color: "#666",
              marginTop: "2px",
            }}
          >
            {step.description}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`ui-stepper ui-stepper--${orientation} ${className}`}
      style={containerStyles}
      data-testid={dataTestId || "stepper"}
    >
      {steps.map((step, index) => (
        <React.Fragment key={index}>
          <div
            className={`ui-stepper__step ui-stepper__step--${getStepStatus(index)}`}
            style={stepStyles(index)}
            onClick={() => onStepClick?.(index)}
            role="button"
            tabIndex={onStepClick && !step.disabled ? 0 : -1}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onStepClick?.(index);
              }
            }}
          >
            {renderStepIndicator(step, index)}
            {renderStepLabel(step, index)}
          </div>
          {!isVertical && <div style={connectorStyles(index)} />}
        </React.Fragment>
      ))}
    </div>
  );
};

// ─── Step Content Component ───────────────────────────────────────────────────

export const StepContent: React.FC<StepContentProps> = ({
  children,
  step,
  activeStep,
  className = "",
  style = {},
}) => {
  const isActive = step === activeStep;

  if (!isActive) return null;

  return (
    <div
      className={`ui-step-content ${className}`}
      style={{
        padding: "20px 0",
        animation: "stepContentFadeIn 0.3s ease",
        ...style,
      }}
      data-testid={`step-content-${step}`}
    >
      <style>{`
        @keyframes stepContentFadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      {children}
    </div>
  );
};

// ─── Step Actions Component ───────────────────────────────────────────────────

export interface StepActionsProps {
  /** Current step */
  activeStep: number;
  /** Total steps */
  totalSteps: number;
  /** Back handler */
  onBack?: () => void;
  /** Next handler */
  onNext?: () => void;
  /** Finish handler */
  onFinish?: () => void;
  /** Whether next is loading */
  loading?: boolean;
  /** Back button text */
  backText?: string;
  /** Next button text */
  nextText?: string;
  /** Finish button text */
  finishText?: string;
  /** Additional CSS class */
  className?: string;
  /** Inline styles */
  style?: CSSProperties;
}

export const StepActions: React.FC<StepActionsProps> = ({
  activeStep,
  totalSteps,
  onBack,
  onNext,
  onFinish,
  loading = false,
  backText = "Back",
  nextText = "Next",
  finishText = "Finish",
  className = "",
  style = {},
}) => {
  const isLastStep = activeStep === totalSteps - 1;

  const buttonStyles = (variant: "primary" | "secondary"): CSSProperties => ({
    padding: "10px 24px",
    fontSize: "16px",
    borderRadius: "4px",
    cursor: loading ? "not-allowed" : "pointer",
    opacity: loading ? 0.6 : 1,
    border: variant === "primary" ? "none" : "1px solid #ccc",
    backgroundColor: variant === "primary" ? "#1976d2" : "transparent",
    color: variant === "primary" ? "#fff" : "#666",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  });

  return (
    <div
      className={`ui-step-actions ${className}`}
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginTop: "24px",
        ...style,
      }}
    >
      <button
        style={buttonStyles("secondary")}
        onClick={onBack}
        disabled={activeStep === 0 || loading}
      >
        {backText}
      </button>

      <button
        style={buttonStyles("primary")}
        onClick={isLastStep ? onFinish : onNext}
        disabled={loading}
      >
        {loading && (
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
        {isLastStep ? finishText : nextText}
      </button>
    </div>
  );
};

export default Stepper;
