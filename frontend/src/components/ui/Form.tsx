/**
 * Form.tsx
 *
 * Reusable Form component with field management, validation, and composition support.
 */

import React, { ReactNode, CSSProperties, FormHTMLAttributes, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FormFieldType = "text" | "email" | "password" | "number" | "textarea" | "select";

export interface FormField {
  name: string;
  label: string;
  type?: FormFieldType;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  validate?: (value: string) => string | undefined;
  options?: { value: string; label: string }[];
  helperText?: string;
}

export interface FormProps extends Omit<FormHTMLAttributes<HTMLFormElement>, "onSubmit"> {
  /** Form content (fields or children) */
  children?: ReactNode;
  /** Form fields configuration */
  fields?: FormField[];
  /** Submit handler */
  onSubmit: (values: Record<string, string>) => void | Promise<void>;
  /** Form validation handler */
  onValidate?: (values: Record<string, string>) => Record<string, string>;
  /** Initial values */
  initialValues?: Record<string, string>;
  /** Loading state */
  loading?: boolean;
  /** Submit button text */
  submitText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Cancel handler */
  onCancel?: () => void;
  /** Additional CSS class */
  className?: string;
  /** Inline styles */
  style?: CSSProperties;
  /** Layout: vertical or horizontal */
  layout?: "vertical" | "horizontal";
  /** Test id */
  "data-testid"?: string;
}

export interface FormFieldProps {
  /** Field name */
  name: string;
  /** Field label */
  label: string;
  /** Input type */
  type?: FormFieldType;
  /** Placeholder text */
  placeholder?: string;
  /** Field value */
  value?: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Blur handler */
  onBlur?: () => void;
  /** Error message */
  error?: string;
  /** Whether field is required */
  required?: boolean;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Helper text */
  helperText?: string;
  /** Options for select */
  options?: { value: string; label: string }[];
  /** Test id */
  "data-testid"?: string;
}

// ─── Form Field Component ─────────────────────────────────────────────────────

export const FormFieldComponent: React.FC<FormFieldProps> = ({
  name,
  label,
  type = "text",
  placeholder,
  value = "",
  onChange,
  onBlur,
  error,
  required = false,
  disabled = false,
  helperText,
  options = [],
  "data-testid": dataTestId,
}) => {
  const fieldId = `field-${name}`;
  const hasError = !!error;

  const labelStyles: CSSProperties = {
    display: "block",
    fontSize: "14px",
    fontWeight: 500,
    color: hasError ? "#d32f2f" : "#333",
    marginBottom: "6px",
  };

  const inputBaseStyles: CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    fontSize: "16px",
    border: `1px solid ${hasError ? "#d32f2f" : "#ccc"}`,
    borderRadius: "4px",
    backgroundColor: disabled ? "#f5f5f5" : "#fff",
    color: disabled ? "#999" : "#333",
    boxSizing: "border-box",
    transition: "border-color 0.2s ease",
    outline: "none",
  };

  const focusStyles: CSSProperties = {
    borderColor: hasError ? "#d32f2f" : "#1976d2",
    boxShadow: `0 0 0 2px ${hasError ? "rgba(211, 47, 47, 0.2)" : "rgba(25, 118, 210, 0.2)"}`,
  };

  const [isFocused, setIsFocused] = useState(false);

  const renderInput = () => {
    const inputProps = {
      id: fieldId,
      name,
      value,
      placeholder,
      disabled,
      required,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        onChange(e.target.value),
      onBlur: () => {
        setIsFocused(false);
        onBlur?.();
      },
      onFocus: () => setIsFocused(true),
      style: { ...inputBaseStyles, ...(isFocused ? focusStyles : {}) },
      "data-testid": dataTestId || `field-${name}`,
      "aria-invalid": hasError,
      "aria-describedby": hasError ? `${fieldId}-error` : undefined,
    };

    switch (type) {
      case "textarea":
        return <textarea {...inputProps} rows={4} />;
      case "select":
        return (
          <select {...inputProps}>
            <option value="">Select...</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      default:
        return <input {...inputProps} type={type} />;
    }
  };

  return (
    <div style={{ marginBottom: "16px" }}>
      <label htmlFor={fieldId} style={labelStyles}>
        {label}
        {required && <span style={{ color: "#d32f2f", marginLeft: "4px" }}>*</span>}
      </label>
      {renderInput()}
      {helperText && !hasError && (
        <span style={{ fontSize: "12px", color: "#666", marginTop: "4px", display: "block" }}>
          {helperText}
        </span>
      )}
      {hasError && (
        <span
          id={`${fieldId}-error`}
          style={{ fontSize: "12px", color: "#d32f2f", marginTop: "4px", display: "block" }}
          role="alert"
        >
          {error}
        </span>
      )}
    </div>
  );
};

// ─── Main Form Component ──────────────────────────────────────────────────────

export const Form: React.FC<FormProps> = ({
  children,
  fields = [],
  onSubmit,
  onValidate,
  initialValues = {},
  loading = false,
  submitText = "Submit",
  cancelText = "Cancel",
  onCancel,
  className = "",
  style = {},
  layout = "vertical",
  "data-testid": dataTestId,
  ...rest
}) => {
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = useCallback(
    (field: FormField, value: string): string | undefined => {
      if (field.required && !value.trim()) {
        return `${field.label} is required`;
      }
      if (field.validate) {
        return field.validate(value);
      }
      return undefined;
    },
    []
  );

  const validateAll = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    fields.forEach((field) => {
      const error = validateField(field, values[field.name] || "");
      if (error) {
        newErrors[field.name] = error;
      }
    });

    if (onValidate) {
      const customErrors = onValidate(values);
      Object.assign(newErrors, customErrors);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [fields, values, onValidate, validateField]);

  const handleChange = useCallback((name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const handleBlur = useCallback(
    (field: FormField) => {
      setTouched((prev) => ({ ...prev, [field.name]: true }));
      const error = validateField(field, values[field.name] || "");
      if (error) {
        setErrors((prev) => ({ ...prev, [field.name]: error }));
      }
    },
    [values, validateField]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateAll()) {
      return;
    }

    await onSubmit(values);
  };

  const handleReset = () => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  };

  const formStyles: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: layout === "horizontal" ? "16px" : "0",
    ...style,
  };

  return (
    <form
      className={`ui-form ui-form--${layout} ${className}`}
      style={formStyles}
      onSubmit={handleSubmit}
      onReset={handleReset}
      data-testid={dataTestId || "form"}
      noValidate
      {...rest}
    >
      {fields.map((field) => (
        <FormFieldComponent
          key={field.name}
          name={field.name}
          label={field.label}
          type={field.type}
          placeholder={field.placeholder}
          value={values[field.name] || ""}
          onChange={(value) => handleChange(field.name, value)}
          onBlur={() => handleBlur(field)}
          error={touched[field.name] ? errors[field.name] : undefined}
          required={field.required}
          disabled={field.disabled || loading}
          helperText={field.helperText}
          options={field.options}
        />
      ))}

      {children}

      <div
        style={{
          display: "flex",
          gap: "12px",
          marginTop: "24px",
          justifyContent: onCancel ? "space-between" : "flex-end",
        }}
      >
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: "10px 20px",
              fontSize: "16px",
              backgroundColor: "transparent",
              color: "#666",
              border: "1px solid #ccc",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {cancelText}
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            backgroundColor: "#1976d2",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
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
          {submitText}
        </button>
      </div>
    </form>
  );
};

// ─── Form Section Component ───────────────────────────────────────────────────

export interface FormSectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  description,
  children,
  className = "",
  style = {},
}) => (
  <div
    className={`ui-form-section ${className}`}
    style={{
      marginBottom: "24px",
      ...style,
    }}
  >
    {title && (
      <h4
        style={{
          margin: "0 0 8px 0",
          fontSize: "16px",
          fontWeight: 600,
          color: "#333",
        }}
      >
        {title}
      </h4>
    )}
    {description && (
      <p
        style={{
          margin: "0 0 16px 0",
          fontSize: "14px",
          color: "#666",
        }}
      >
        {description}
      </p>
    )}
    {children}
  </div>
);

export default Form;
