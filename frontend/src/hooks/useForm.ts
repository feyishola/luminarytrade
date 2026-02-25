/**
 * useForm.ts
 *
 * Custom hook for form state management and validation.
 */

import { useState, useCallback, useRef, FormEvent } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FormValues = Record<string, any>;

export type FormErrors<T extends FormValues = FormValues> = Partial<
  Record<keyof T, string>
>;

export type FormTouched<T extends FormValues = FormValues> = Partial<
  Record<keyof T, boolean>
>;

export type Validator<T extends FormValues = FormValues> = (
  values: T
) => FormErrors<T>;

export type FieldValidator = (value: any, allValues?: FormValues) => string | undefined;

export interface UseFormOptions<T extends FormValues = FormValues> {
  /** Initial form values */
  initialValues: T;
  /** Form validation function */
  validate?: Validator<T>;
  /** Field-level validators */
  fieldValidators?: Partial<Record<keyof T, FieldValidator>>;
  /** Submit handler */
  onSubmit?: (values: T) => void | Promise<void>;
  /** Validate on change */
  validateOnChange?: boolean;
  /** Validate on blur */
  validateOnBlur?: boolean;
}

export interface UseFormReturn<T extends FormValues = FormValues> {
  /** Current form values */
  values: T;
  /** Form errors */
  errors: FormErrors<T>;
  /** Touched fields */
  touched: FormTouched<T>;
  /** Whether form is submitting */
  isSubmitting: boolean;
  /** Whether form has been submitted */
  isSubmitted: boolean;
  /** Set a field value */
  setValue: <K extends keyof T>(field: K, value: T[K]) => void;
  /** Set multiple field values */
  setValues: (values: Partial<T>) => void;
  /** Get a field value */
  getValue: <K extends keyof T>(field: K) => T[K];
  /** Set a field error */
  setError: (field: keyof T, error: string) => void;
  /** Clear a field error */
  clearError: (field: keyof T) => void;
  /** Set field as touched */
  setTouched: (field: keyof T, isTouched?: boolean) => void;
  /** Handle field change */
  handleChange: (field: keyof T) => (value: any) => void;
  /** Handle field blur */
  handleBlur: (field: keyof T) => () => void;
  /** Handle form submit */
  handleSubmit: (e?: FormEvent) => Promise<void>;
  /** Reset form to initial values */
  reset: () => void;
  /** Validate entire form */
  validate: () => boolean;
  /** Validate a single field */
  validateField: (field: keyof T) => boolean;
  /** Check if form is valid */
  isValid: boolean;
  /** Check if form is dirty (values changed from initial) */
  isDirty: boolean;
  /** Get field props for binding */
  getFieldProps: <K extends keyof T>(
    field: K
  ) => {
    name: K;
    value: T[K];
    onChange: (value: any) => void;
    onBlur: () => void;
    error: string | undefined;
    touched: boolean;
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useForm<T extends FormValues = FormValues>(
  options: UseFormOptions<T>
): UseFormReturn<T> {
  const {
    initialValues,
    validate: validateFn,
    fieldValidators,
    onSubmit,
    validateOnChange = false,
    validateOnBlur = true,
  } = options;

  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<FormErrors<T>>({});
  const [touched, setTouchedState] = useState<FormTouched<T>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const initialValuesRef = useRef(initialValues);
  const validateFnRef = useRef(validateFn);
  validateFnRef.current = validateFn;

  // ─── Validation ─────────────────────────────────────────────────────────────

  const validateField = useCallback(
    (field: keyof T): boolean => {
      const fieldValidator = fieldValidators?.[field];
      if (!fieldValidator) return true;

      const error = fieldValidator(values[field]);
      setErrors((prev) => ({
        ...prev,
        [field]: error,
      }));
      return !error;
    },
    [fieldValidators, values]
  );

  const validateForm = useCallback((): boolean => {
    if (!validateFnRef.current) return true;

    const validationErrors = validateFnRef.current(values);
    setErrors(validationErrors);
    return Object.keys(validationErrors).length === 0;
  }, [values]);

  // ─── Field Handlers ─────────────────────────────────────────────────────────

  const setValue = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));

    if (validateOnChange && fieldValidators?.[field]) {
      const error = fieldValidators[field]!(value);
      setErrors((prev) => ({ ...prev, [field]: error }));
    }
  }, [fieldValidators, validateOnChange]);

  const setMultipleValues = useCallback((newValues: Partial<T>) => {
    setValues((prev) => ({ ...prev, ...newValues }));
  }, []);

  const getValue = useCallback(<K extends keyof T>(field: K): T[K] => {
    return values[field];
  }, [values]);

  const setError = useCallback((field: keyof T, error: string) => {
    setErrors((prev) => ({ ...prev, [field]: error }));
  }, []);

  const clearError = useCallback((field: keyof T) => {
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  const setTouched = useCallback((field: keyof T, isTouched = true) => {
    setTouchedState((prev) => ({ ...prev, [field]: isTouched }));
  }, []);

  const handleChange = useCallback(
    (field: keyof T) => (value: any) => {
      setValue(field, value);
    },
    [setValue]
  );

  const handleBlur = useCallback(
    (field: keyof T) => () => {
      setTouched(field, true);
      if (validateOnBlur) {
        validateField(field);
      }
    },
    [setTouched, validateOnBlur, validateField]
  );

  // ─── Form Handlers ──────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();

      setIsSubmitted(true);

      // Validate all fields
      let isValid = true;

      if (validateFnRef.current) {
        const validationErrors = validateFnRef.current(values);
        setErrors(validationErrors);
        isValid = Object.keys(validationErrors).length === 0;
      }

      // Validate individual fields
      if (fieldValidators) {
        Object.keys(fieldValidators).forEach((field) => {
          const fieldValid = validateField(field as keyof T);
          if (!fieldValid) isValid = false;
        });
      }

      if (!isValid) return;

      setIsSubmitting(true);
      try {
        await onSubmit?.(values);
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, fieldValidators, onSubmit, validateField]
  );

  const reset = useCallback(() => {
    setValues(initialValuesRef.current);
    setErrors({});
    setTouchedState({});
    setIsSubmitting(false);
    setIsSubmitted(false);
  }, []);

  // ─── Computed Values ────────────────────────────────────────────────────────

  const isValid = Object.keys(errors).length === 0;

  const isDirty = JSON.stringify(values) !== JSON.stringify(initialValuesRef.current);

  // ─── Field Props ────────────────────────────────────────────────────────────

  const getFieldProps = useCallback(
    <K extends keyof T>(field: K) => ({
      name: field,
      value: values[field],
      onChange: handleChange(field),
      onBlur: handleBlur(field),
      error: touched[field] ? errors[field] : undefined,
      touched: !!touched[field],
    }),
    [values, errors, touched, handleChange, handleBlur]
  );

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isSubmitted,
    setValue,
    setValues: setMultipleValues,
    getValue,
    setError,
    clearError,
    setTouched,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    validate: validateForm,
    validateField,
    isValid,
    isDirty,
    getFieldProps,
  };
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

export const validators = {
  required: (message = "This field is required") => (value: any): string | undefined => {
    if (value === undefined || value === null || value === "") {
      return message;
    }
    if (Array.isArray(value) && value.length === 0) {
      return message;
    }
    return undefined;
  },

  email: (message = "Invalid email address") => (value: string): string | undefined => {
    if (!value) return undefined;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? undefined : message;
  },

  minLength: (min: number, message?: string) => (value: string): string | undefined => {
    if (!value) return undefined;
    return value.length >= min
      ? undefined
      : message || `Must be at least ${min} characters`;
  },

  maxLength: (max: number, message?: string) => (value: string): string | undefined => {
    if (!value) return undefined;
    return value.length <= max
      ? undefined
      : message || `Must be at most ${max} characters`;
  },

  min: (min: number, message?: string) => (value: number): string | undefined => {
    if (value === undefined || value === null) return undefined;
    return value >= min ? undefined : message || `Must be at least ${min}`;
  },

  max: (max: number, message?: string) => (value: number): string | undefined => {
    if (value === undefined || value === null) return undefined;
    return value <= max ? undefined : message || `Must be at most ${max}`;
  },

  pattern: (regex: RegExp, message = "Invalid format") => (value: string): string | undefined => {
    if (!value) return undefined;
    return regex.test(value) ? undefined : message;
  },

  matches: (field: string, message = "Fields do not match") =>
    (value: string, allValues?: FormValues): string | undefined => {
      if (!allValues) return undefined;
      return value === allValues[field] ? undefined : message;
    },

  compose: (...validators: FieldValidator[]) => (value: any, allValues?: FormValues): string | undefined => {
    for (const validator of validators) {
      const error = validator(value, allValues);
      if (error) return error;
    }
    return undefined;
  },
};

export default useForm;
