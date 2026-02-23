/**
 * TransactionSubmitForm.tsx
 *
 * Component for submitting new blockchain transactions.
 * Includes form validation, gas estimation, and signature handling.
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Grid,
  Chip,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
} from "@mui/material";
import {
  Send,
  Info,
  CheckCircle,
  Error,
  Help,
  ContentCopy,
  OpenInNew,
} from "@mui/icons-material";
import { useTransactions } from "../contexts/TransactionContext";
import { TransactionSubmissionRequest, TransactionType } from "../interfaces/domain";
import { TransactionTracker } from "./TransactionTracker";

// ─── Validation ───────────────────────────────────────────────────────────────

interface ValidationErrors {
  to?: string;
  amount?: string;
  memo?: string;
}

function validateAddress(address: string): boolean {
  // Basic validation for Stellar addresses (56 characters, starts with G)
  // or Ethereum addresses (42 characters, starts with 0x)
  if (!address) return false;
  if (address.startsWith("G") && address.length === 56) return true;
  if (address.startsWith("0x") && address.length === 42) return true;
  return false;
}

function validateAmount(amount: string): boolean {
  if (!amount) return false;
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0;
}

function validateForm(values: TransactionSubmissionRequest): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!validateAddress(values.to)) {
    errors.to = "Invalid address format";
  }

  if (!validateAmount(values.amount)) {
    errors.amount = "Amount must be greater than 0";
  }

  if (values.memo && values.memo.length > 100) {
    errors.memo = "Memo must be less than 100 characters";
  }

  return errors;
}

// ─── Step Definitions ─────────────────────────────────────────────────────────

const STEPS = ["Enter Details", "Review & Sign", "Confirmation"];

// ─── Sub-Components ───────────────────────────────────────────────────────────

interface GasEstimateDisplayProps {
  gasEstimate: {
    baseFee: string;
    priorityFee: string;
    estimatedTime: number;
  } | null;
  isLoading: boolean;
  priority: "low" | "medium" | "high";
  onPriorityChange: (priority: "low" | "medium" | "high") => void;
}

const GasEstimateDisplay: React.FC<GasEstimateDisplayProps> = ({
  gasEstimate,
  isLoading,
  priority,
  onPriorityChange,
}) => {
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  return (
    <Box mt={2} p={2} bgcolor="background.paper" borderRadius={1}>
      <Typography variant="subtitle2" gutterBottom>
        Gas Estimate
      </Typography>

      <Box mb={2}>
        <Typography variant="caption" color="text.secondary">
          Transaction Speed
        </Typography>
        <Box display="flex" gap={1} mt={0.5}>
          {(["low", "medium", "high"] as const).map((p) => (
            <Chip
              key={p}
              label={p.charAt(0).toUpperCase() + p.slice(1)}
              color={priority === p ? "primary" : "default"}
              onClick={() => onPriorityChange(p)}
              size="small"
              clickable
            />
          ))}
        </Box>
      </Box>

      {isLoading ? (
        <Box display="flex" alignItems="center" gap={1}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            Estimating fees...
          </Typography>
        </Box>
      ) : gasEstimate ? (
        <Grid container spacing={2}>
          <Grid item xs={4}>
            <Typography variant="caption" color="text.secondary">
              Base Fee
            </Typography>
            <Typography variant="body2">{gasEstimate.baseFee}</Typography>
          </Grid>
          <Grid item xs={4}>
            <Typography variant="caption" color="text.secondary">
              Priority Fee
            </Typography>
            <Typography variant="body2">{gasEstimate.priorityFee}</Typography>
          </Grid>
          <Grid item xs={4}>
            <Typography variant="caption" color="text.secondary">
              Est. Time
            </Typography>
            <Typography variant="body2">
              {formatTime(gasEstimate.estimatedTime)}
            </Typography>
          </Grid>
        </Grid>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Unable to estimate fees
        </Typography>
      )}
    </Box>
  );
};

interface ReviewStepProps {
  values: TransactionSubmissionRequest;
  gasEstimate: {
    baseFee: string;
    priorityFee: string;
    estimatedTime: number;
  } | null;
  truncateAddress: (address: string, chars?: number) => string;
}

const ReviewStep: React.FC<ReviewStepProps> = ({
  values,
  gasEstimate,
  truncateAddress,
}) => {
  const totalFee = gasEstimate
    ? (
        parseFloat(gasEstimate.baseFee) + parseFloat(gasEstimate.priorityFee)
      ).toFixed(7)
    : "-";

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Review Transaction
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <Typography variant="caption" color="text.secondary">
            To
          </Typography>
          <Typography variant="body1">{truncateAddress(values.to)}</Typography>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Typography variant="caption" color="text.secondary">
            Amount
          </Typography>
          <Typography variant="body1">{values.amount}</Typography>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Typography variant="caption" color="text.secondary">
            Type
          </Typography>
          <Typography variant="body1">
            {values.type.charAt(0).toUpperCase() + values.type.slice(1)}
          </Typography>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Typography variant="caption" color="text.secondary">
            Memo
          </Typography>
          <Typography variant="body1">{values.memo || "-"}</Typography>
        </Grid>

        <Grid item xs={12}>
          <Box mt={2} p={2} bgcolor="background.paper" borderRadius={1}>
            <Typography variant="subtitle2" gutterBottom>
              Fee Breakdown
            </Typography>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                Base Fee
              </Typography>
              <Typography variant="body2">
                {gasEstimate?.baseFee || "-"}
              </Typography>
            </Box>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                Priority Fee
              </Typography>
              <Typography variant="body2">
                {gasEstimate?.priorityFee || "-"}
              </Typography>
            </Box>
            <Box display="flex" justifyContent="space-between" mt={1}>
              <Typography variant="body1" fontWeight="medium">
                Total Fee
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {totalFee}
              </Typography>
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface TransactionSubmitFormProps {
  onSuccess?: (txHash: string) => void;
  defaultValues?: Partial<TransactionSubmissionRequest>;
}

export const TransactionSubmitForm: React.FC<TransactionSubmitFormProps> = ({
  onSuccess,
  defaultValues,
}) => {
  const { submit, estimateFees, gasEstimate, isEstimatingFees, truncateAddress, getExplorerUrl } =
    useTransactions();

  const [activeStep, setActiveStep] = useState(0);
  const [values, setValues] = useState<TransactionSubmissionRequest>({
    to: defaultValues?.to || "",
    amount: defaultValues?.amount || "",
    type: defaultValues?.type || "payment",
    memo: defaultValues?.memo || "",
    priority: defaultValues?.priority || "medium",
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    txHash?: string;
    error?: string;
  } | null>(null);
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");

  // Load gas estimate on mount and when priority changes
  useEffect(() => {
    estimateFees(priority);
  }, [priority, estimateFees]);

  const handleChange = useCallback(
    (field: keyof TransactionSubmissionRequest) =>
      (event: React.ChangeEvent<HTMLInputElement>) => {
        setValues((prev) => ({ ...prev, [field]: event.target.value }));
        // Clear error when field changes
        if (errors[field as keyof ValidationErrors]) {
          setErrors((prev) => ({ ...prev, [field]: undefined }));
        }
      },
    [errors]
  );

  const handleTypeChange = useCallback(
    (event: any) => {
      setValues((prev) => ({ ...prev, type: event.target.value as TransactionType }));
    },
    []
  );

  const handleNext = useCallback(() => {
    if (activeStep === 0) {
      // Validate form
      const validationErrors = validateForm(values);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }
    }

    setActiveStep((prev) => prev + 1);
  }, [activeStep, values]);

  const handleBack = useCallback(() => {
    setActiveStep((prev) => prev - 1);
    setSubmitError(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    const result = await submit({
      ...values,
      priority,
    });

    if (result.ok && result.data.success) {
      setSubmitResult({
        success: true,
        txHash: result.data.txHash,
      });
      if (result.data.txHash) {
        onSuccess?.(result.data.txHash);
      }
    } else {
      const errorMessage = result.ok
        ? result.data.error?.message || "Submission failed"
        : result.error.message;
      setSubmitResult({
        success: false,
        error: errorMessage,
      });
      setSubmitError(errorMessage);
    }

    setIsSubmitting(false);
    setActiveStep(2); // Move to confirmation step
  }, [values, priority, submit, onSuccess]);

  const handleReset = useCallback(() => {
    setActiveStep(0);
    setValues({
      to: "",
      amount: "",
      type: "payment",
      memo: "",
      priority: "medium",
    });
    setSubmitResult(null);
    setSubmitError(null);
    setErrors({});
  }, []);

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Recipient Address"
                value={values.to}
                onChange={handleChange("to")}
                error={!!errors.to}
                helperText={errors.to || "Stellar (G...) or Ethereum (0x...) address"}
                placeholder="G... or 0x..."
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Amount"
                value={values.amount}
                onChange={handleChange("amount")}
                error={!!errors.amount}
                helperText={errors.amount}
                type="number"
                InputProps={{
                  endAdornment: <InputAdornment position="end">XLM</InputAdornment>,
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Transaction Type</InputLabel>
                <Select
                  value={values.type}
                  label="Transaction Type"
                  onChange={handleTypeChange}
                >
                  <MenuItem value="payment">Payment</MenuItem>
                  <MenuItem value="contract_call">Contract Call</MenuItem>
                  <MenuItem value="token_transfer">Token Transfer</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Memo (Optional)"
                value={values.memo}
                onChange={handleChange("memo")}
                error={!!errors.memo}
                helperText={errors.memo || "Add a note to this transaction"}
                multiline
                rows={2}
              />
            </Grid>

            <Grid item xs={12}>
              <GasEstimateDisplay
                gasEstimate={gasEstimate}
                isLoading={isEstimatingFees}
                priority={priority}
                onPriorityChange={setPriority}
              />
            </Grid>
          </Grid>
        );

      case 1:
        return (
          <ReviewStep
            values={values}
            gasEstimate={gasEstimate}
            truncateAddress={truncateAddress}
          />
        );

      case 2:
        if (submitResult?.success && submitResult.txHash) {
          return (
            <Box textAlign="center" py={3}>
              <CheckCircle color="success" sx={{ fontSize: 64, mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Transaction Submitted!
              </Typography>
              <Typography variant="body1" color="text.secondary" gutterBottom>
                Your transaction has been submitted to the network.
              </Typography>
              <Box mt={2} display="flex" justifyContent="center" gap={1}>
                <Chip
                  label={truncateAddress(submitResult.txHash, 10)}
                  onDelete={() => {
                    navigator.clipboard.writeText(submitResult.txHash!);
                  }}
                  deleteIcon={<ContentCopy />}
                />
                <Tooltip title="View on Explorer">
                  <IconButton
                    href={getExplorerUrl(submitResult.txHash, "stellar")}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <OpenInNew />
                  </IconButton>
                </Tooltip>
              </Box>
              <Box mt={3}>
                <TransactionTracker txHash={submitResult.txHash} compact />
              </Box>
            </Box>
          );
        }

        return (
          <Box textAlign="center" py={3}>
            <Error color="error" sx={{ fontSize: 64, mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Transaction Failed
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {submitResult?.error || submitError || "An unknown error occurred"}
            </Typography>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Send Transaction
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {submitError && activeStep === 1 && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {submitError}
          </Alert>
        )}

        {renderStepContent()}

        <Box display="flex" justifyContent="space-between" mt={4}>
          <Button
            disabled={activeStep === 0 || isSubmitting}
            onClick={handleBack}
          >
            Back
          </Button>

          {activeStep === 0 && (
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={isEstimatingFees}
            >
              Next
            </Button>
          )}

          {activeStep === 1 && (
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={20} /> : <Send />}
            >
              {isSubmitting ? "Submitting..." : "Submit Transaction"}
            </Button>
          )}

          {activeStep === 2 && (
            <Button variant="contained" onClick={handleReset}>
              Send Another
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default TransactionSubmitForm;
