/**
 * WalletConnectButton.tsx
 *
 * Specialized component for blockchain wallet connection with multiple wallet support.
 */

import React, { useState, CSSProperties } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WalletType = "metamask" | "stellar" | "walletconnect" | "coinbase";

export interface Wallet {
  type: WalletType;
  name: string;
  icon: string;
  description?: string;
  installed?: boolean;
  popular?: boolean;
}

export interface WalletConnectButtonProps {
  /** Connected wallet address */
  address?: string | null;
  /** Connection status */
  isConnected?: boolean;
  /** Loading state */
  isConnecting?: boolean;
  /** Connect handler */
  onConnect?: (walletType: WalletType) => void;
  /** Disconnect handler */
  onDisconnect?: () => void;
  /** Supported wallets */
  wallets?: Wallet[];
  /** Additional CSS class */
  className?: string;
  /** Inline styles */
  style?: CSSProperties;
  /** Button size */
  size?: "small" | "medium" | "large";
  /** Show wallet icon */
  showIcon?: boolean;
  /** Test id */
  "data-testid"?: string;
}

// ─── Default Wallets ──────────────────────────────────────────────────────────

const DEFAULT_WALLETS: Wallet[] = [
  {
    type: "metamask",
    name: "MetaMask",
    icon: "🦊",
    description: "Connect to your MetaMask wallet",
    popular: true,
  },
  {
    type: "stellar",
    name: "Freighter",
    icon: "⭐",
    description: "Connect to your Freighter wallet",
    popular: true,
  },
  {
    type: "walletconnect",
    name: "WalletConnect",
    icon: "🔗",
    description: "Scan with WalletConnect",
  },
  {
    type: "coinbase",
    name: "Coinbase Wallet",
    icon: "🅒",
    description: "Connect to Coinbase Wallet",
  },
];

// ─── Helper Functions ─────────────────────────────────────────────────────────

function truncateAddress(address: string, chars = 4): string {
  if (!address) return "";
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const WalletConnectButton: React.FC<WalletConnectButtonProps> = ({
  address,
  isConnected = false,
  isConnecting = false,
  onConnect,
  onDisconnect,
  wallets = DEFAULT_WALLETS,
  className = "",
  style = {},
  size = "medium",
  showIcon = true,
  "data-testid": dataTestId,
}) => {
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletType | null>(null);

  const sizeStyles: Record<string, CSSProperties> = {
    small: { padding: "8px 16px", fontSize: "14px", height: "36px" },
    medium: { padding: "12px 24px", fontSize: "16px", height: "44px" },
    large: { padding: "16px 32px", fontSize: "18px", height: "56px" },
  };

  const handleConnect = (walletType: WalletType) => {
    setSelectedWallet(walletType);
    onConnect?.(walletType);
    setShowWalletModal(false);
  };

  const handleDisconnect = () => {
    setSelectedWallet(null);
    onDisconnect?.();
  };

  const buttonStyles: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    fontWeight: 600,
    borderRadius: "8px",
    cursor: isConnecting ? "not-allowed" : "pointer",
    opacity: isConnecting ? 0.7 : 1,
    transition: "all 0.2s ease",
    border: isConnected ? "1px solid #4caf50" : "1px solid #1976d2",
    backgroundColor: isConnected ? "#e8f5e9" : "#1976d2",
    color: isConnected ? "#2e7d32" : "#fff",
    ...sizeStyles[size],
    ...style,
  };

  const renderConnectedState = () => (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      {showIcon && (
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: "#4caf50",
            display: "inline-block",
          }}
        />
      )}
      <span>{truncateAddress(address || "")}</span>
    </div>
  );

  const renderDisconnectedState = () => (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      {isConnecting ? (
        <>
          <span
            style={{
              display: "inline-block",
              width: size === "small" ? 14 : size === "large" ? 22 : 18,
              height: size === "small" ? 14 : size === "large" ? 22 : 18,
              border: "2px solid currentColor",
              borderRightColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.75s linear infinite",
            }}
          />
          <span>Connecting...</span>
        </>
      ) : (
        <>
          {showIcon && <span>👛</span>}
          <span>Connect Wallet</span>
        </>
      )}
    </div>
  );

  return (
    <>
      <button
        className={`ui-wallet-button ${isConnected ? "connected" : ""} ${className}`}
        style={buttonStyles}
        onClick={() => {
          if (isConnected) {
            handleDisconnect();
          } else {
            setShowWalletModal(true);
          }
        }}
        disabled={isConnecting}
        data-testid={dataTestId || "wallet-button"}
        data-connected={isConnected}
      >
        {isConnected ? renderConnectedState() : renderDisconnectedState()}
      </button>

      {/* Wallet Selection Modal */}
      {showWalletModal && (
        <div
          style={{
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
          }}
          onClick={() => setShowWalletModal(false)}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "400px",
              width: "100%",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 600 }}>
                Connect Wallet
              </h3>
              <button
                onClick={() => setShowWalletModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "#666",
                }}
              >
                ×
              </button>
            </div>

            <p style={{ margin: "0 0 20px 0", color: "#666", fontSize: "14px" }}>
              Choose a wallet to connect to the application
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {wallets.map((wallet) => (
                <button
                  key={wallet.type}
                  onClick={() => handleConnect(wallet.type)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    padding: "16px",
                    border: "1px solid #e0e0e0",
                    borderRadius: "12px",
                    backgroundColor: selectedWallet === wallet.type ? "#e3f2fd" : "#fff",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    textAlign: "left",
                    width: "100%",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#1976d2";
                    e.currentTarget.style.backgroundColor = "#f5f5f5";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#e0e0e0";
                    e.currentTarget.style.backgroundColor =
                      selectedWallet === wallet.type ? "#e3f2fd" : "#fff";
                  }}
                >
                  <span style={{ fontSize: "32px" }}>{wallet.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: "16px",
                          color: "#333",
                        }}
                      >
                        {wallet.name}
                      </span>
                      {wallet.popular && (
                        <span
                          style={{
                            backgroundColor: "#1976d2",
                            color: "#fff",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            fontWeight: 500,
                          }}
                        >
                          Popular
                        </span>
                      )}
                    </div>
                    {wallet.description && (
                      <p
                        style={{
                          margin: "4px 0 0 0",
                          fontSize: "14px",
                          color: "#666",
                        }}
                      >
                        {wallet.description}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <p
              style={{
                margin: "20px 0 0 0",
                fontSize: "12px",
                color: "#999",
                textAlign: "center",
              }}
            >
              By connecting, you agree to the Terms of Service
            </p>
          </div>
        </div>
      )}
    </>
  );
};

// ─── Wallet Status Badge Component ────────────────────────────────────────────

export interface WalletStatusBadgeProps {
  /** Connection status */
  isConnected: boolean;
  /** Network name */
  network?: string;
  /** Additional CSS class */
  className?: string;
  /** Inline styles */
  style?: CSSProperties;
}

export const WalletStatusBadge: React.FC<WalletStatusBadgeProps> = ({
  isConnected,
  network,
  className = "",
  style = {},
}) => {
  const baseStyles: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 12px",
    borderRadius: "16px",
    fontSize: "12px",
    fontWeight: 500,
    backgroundColor: isConnected ? "#e8f5e9" : "#f5f5f5",
    color: isConnected ? "#2e7d32" : "#666",
    border: `1px solid ${isConnected ? "#a5d6a7" : "#e0e0e0"}`,
    ...style,
  };

  return (
    <span className={`ui-wallet-badge ${className}`} style={baseStyles}>
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          backgroundColor: isConnected ? "#4caf50" : "#999",
        }}
      />
      {isConnected ? (network ? `Connected • ${network}` : "Connected") : "Disconnected"}
    </span>
  );
};

export default WalletConnectButton;
