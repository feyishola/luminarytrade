/**
 * TransactionPage.tsx
 *
 * Main page for blockchain transaction management.
 * Combines transaction submission, tracking, and history in one view.
 */

import React, { useState } from "react";
import {
  Box,
  Grid,
  Typography,
  Tabs,
  Tab,
  Paper,
  Alert,
} from "@mui/material";
import {
  Send,
  History,
  TrackChanges,
} from "@mui/icons-material";
import { TransactionProvider } from "../contexts/TransactionContext";
import { TransactionSubmitForm } from "./TransactionSubmitForm";
import { TransactionHistory } from "./TransactionHistory";
import { TransactionTracker } from "./TransactionTracker";

// ─── Tab Panel Component ──────────────────────────────────────────────────────

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`transaction-tabpanel-${index}`}
      aria-labelledby={`transaction-tab-${index}`}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

// ─── Send Tab ─────────────────────────────────────────────────────────────────

const SendTab: React.FC = () => {
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <TransactionSubmitForm
          onSuccess={(txHash) => setLastTxHash(txHash)}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        {lastTxHash ? (
          <TransactionTracker txHash={lastTxHash} />
        ) : (
          <Paper sx={{ p: 3, textAlign: "center" }}>
            <Typography variant="body1" color="text.secondary">
              Submit a transaction to see real-time tracking
            </Typography>
          </Paper>
        )}
      </Grid>
    </Grid>
  );
};

// ─── History Tab ──────────────────────────────────────────────────────────────

const HistoryTab: React.FC = () => {
  const [selectedTx, setSelectedTx] = useState<string | null>(null);

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <TransactionHistory onTransactionSelect={setSelectedTx} />
      </Grid>
      {selectedTx && (
        <Grid item xs={12}>
          <TransactionTracker
            txHash={selectedTx}
            onClose={() => setSelectedTx(null)}
          />
        </Grid>
      )}
    </Grid>
  );
};

// ─── Track Tab ────────────────────────────────────────────────────────────────

const TrackTab: React.FC = () => {
  const [txHash, setTxHash] = useState("");
  const [trackedHash, setTrackedHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTrack = () => {
    setError(null);
    if (!txHash.trim()) {
      setError("Please enter a transaction hash");
      return;
    }
    // Basic validation for transaction hash format
    if (txHash.length < 10) {
      setError("Invalid transaction hash format");
      return;
    }
    setTrackedHash(txHash.trim());
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Track Transaction
          </Typography>
          <Box component="form" noValidate autoComplete="off">
            <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
              <Box sx={{ flex: 1 }}>
                <input
                  type="text"
                  placeholder="Enter transaction hash..."
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    fontSize: "16px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    boxSizing: "border-box",
                  }}
                />
              </Box>
              <button
                type="button"
                onClick={handleTrack}
                style={{
                  padding: "12px 24px",
                  fontSize: "16px",
                  backgroundColor: "#1976d2",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Track
              </button>
            </Box>
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </Box>
        </Paper>
      </Grid>
      <Grid item xs={12} md={6}>
        {trackedHash ? (
          <TransactionTracker txHash={trackedHash} />
        ) : (
          <Paper sx={{ p: 3, textAlign: "center" }}>
            <Typography variant="body1" color="text.secondary">
              Enter a transaction hash to track its status
            </Typography>
          </Paper>
        )}
      </Grid>
    </Grid>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const TransactionPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <TransactionProvider>
      <Box sx={{ width: "100%" }}>
        <Typography variant="h4" gutterBottom>
          Transaction Manager
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Submit, track, and manage your blockchain transactions
        </Typography>

        <Paper sx={{ width: "100%", mb: 2 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
            variant="fullWidth"
          >
            <Tab icon={<Send />} label="Send" iconPosition="start" />
            <Tab icon={<History />} label="History" iconPosition="start" />
            <Tab icon={<TrackChanges />} label="Track" iconPosition="start" />
          </Tabs>

          <TabPanel value={activeTab} index={0}>
            <SendTab />
          </TabPanel>
          <TabPanel value={activeTab} index={1}>
            <HistoryTab />
          </TabPanel>
          <TabPanel value={activeTab} index={2}>
            <TrackTab />
          </TabPanel>
        </Paper>
      </Box>
    </TransactionProvider>
  );
};

export default TransactionPage;
