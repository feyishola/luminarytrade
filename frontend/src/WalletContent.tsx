/**
 * WalletContext
 *
 * React Context providing wallet state and actions to the entire app.
 * Supports:
 *  - Connecting / disconnecting any registered wallet
 *  - Switching wallets without a page reload
 *  - Reacting to wallet lifecycle events (account changed, disconnected)
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  IWalletProvider,
  WalletAccount,
  WalletType,
} from "./providers/IWalletProvider";
import { WalletFactory } from "./providers/WalletFactory";

// ─── Context shape ────────────────────────────────────────────────────────────

export interface WalletContextValue {
  /** Currently active provider, or null if none selected */
  activeProvider: IWalletProvider | null;

  /** Current connected wallet type */
  walletType: WalletType | null;

  /** Whether a wallet is connected */
  isConnected: boolean;

  /** The connected account */
  account: WalletAccount | null;

  /** Whether a connection is in progress */
  isConnecting: boolean;

  /** Last connection error message */
  error: string | null;

  /** All registered wallet types */
  availableWallets: WalletType[];

  /** Connect to a specific wallet type */
  connect: (type: WalletType) => Promise<void>;

  /** Disconnect current wallet */
  disconnect: () => Promise<void>;

  /** Switch to a different wallet without full page reload */
  switchWallet: (type: WalletType) => Promise<void>;

  /** Clear error state */
  clearError: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const WalletContext = createContext<WalletContextValue | null>(null);

// ─── Provider Component ───────────────────────────────────────────────────────

export interface WalletProviderProps {
  children: React.ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [activeProvider, setActiveProvider] = useState<IWalletProvider | null>(
    null,
  );
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep a ref to the current provider so event handlers always have the latest
  const providerRef = useRef<IWalletProvider | null>(null);

  const availableWallets = WalletFactory.getRegisteredTypes();

  // ─── Register event handlers on active provider ───────────────────────────

  const attachEvents = useCallback((provider: IWalletProvider) => {
    provider.on("connected", (event) => {
      setIsConnected(true);
      setAccount(event.payload as WalletAccount);
      setError(null);
    });

    provider.on("disconnected", () => {
      setIsConnected(false);
      setAccount(null);
    });

    provider.on("accountChanged", (event) => {
      setAccount(event.payload as WalletAccount);
    });

    provider.on("networkChanged", () => {
      // Refresh account info on network switch
      provider.getAccount().then((acc) => setAccount(acc));
    });

    provider.on("error", (event) => {
      setError(event.payload as string);
    });
  }, []);

  const detachProvider = useCallback(async () => {
    if (providerRef.current?.isConnected) {
      await providerRef.current.disconnect();
    }
    providerRef.current = null;
  }, []);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const connect = useCallback(
    async (type: WalletType) => {
      setIsConnecting(true);
      setError(null);

      try {
        const provider = WalletFactory.create(type);
        attachEvents(provider);

        const result = await provider.connect();

        if (!result.success) {
          setError(result.error ?? "Connection failed");
          setIsConnecting(false);
          return;
        }

        providerRef.current = provider;
        setActiveProvider(provider);
        setWalletType(type);
        setIsConnected(true);
        setAccount(result.account ?? null);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unexpected error";
        setError(msg);
      } finally {
        setIsConnecting(false);
      }
    },
    [attachEvents],
  );

  const disconnect = useCallback(async () => {
    await detachProvider();
    setActiveProvider(null);
    setWalletType(null);
    setIsConnected(false);
    setAccount(null);
  }, [detachProvider]);

  const switchWallet = useCallback(
    async (type: WalletType) => {
      // Disconnect current provider first, then connect new one
      await detachProvider();
      setActiveProvider(null);
      setWalletType(null);
      setIsConnected(false);
      setAccount(null);

      await connect(type);
    },
    [connect, detachProvider],
  );

  const clearError = useCallback(() => setError(null), []);

  // ─── Cleanup on unmount ───────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      detachProvider();
    };
  }, [detachProvider]);

  // ─── Context value ────────────────────────────────────────────────────────

  const value: WalletContextValue = {
    activeProvider,
    walletType,
    isConnected,
    account,
    isConnecting,
    error,
    availableWallets,
    connect,
    disconnect,
    switchWallet,
    clearError,
  };

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within a <WalletProvider>");
  }
  return ctx;
}
