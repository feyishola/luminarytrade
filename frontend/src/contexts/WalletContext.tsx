import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api';
import { 
  WalletState, 
  WalletContextType, 
  Transaction, 
  Token,
  ContextProviderProps 
} from './types';

// Action Types
type WalletAction =
  | { type: 'WALLET_CONNECT_START' }
  | { type: 'WALLET_CONNECT_SUCCESS'; payload: { address: string; provider: WalletState['provider']; chainId: number } }
  | { type: 'WALLET_CONNECT_FAILURE'; payload: string }
  | { type: 'WALLET_DISCONNECT' }
  | { type: 'WALLET_UPDATE_BALANCE'; payload: string }
  | { type: 'WALLET_UPDATE_NETWORK'; payload: WalletState['network'] }
  | { type: 'WALLET_UPDATE_CHAIN_ID'; payload: number }
  | { type: 'WALLET_ADD_TRANSACTION'; payload: Transaction }
  | { type: 'WALLET_UPDATE_TRANSACTION'; payload: { id: string; updates: Partial<Transaction> } }
  | { type: 'WALLET_ADD_TOKEN'; payload: Token }
  | { type: 'WALLET_REMOVE_TOKEN'; payload: string }
  | { type: 'WALLET_SET_LOADING'; payload: boolean }
  | { type: 'WALLET_CLEAR_ERROR' }
  | { type: 'WALLET_SET_ERROR'; payload: string };

// Initial State
const initialState: WalletState = {
  isConnected: false,
  address: null,
  balance: '0',
  network: 'mainnet',
  provider: null,
  chainId: null,
  isLoading: false,
  error: null,
  transactionHistory: [],
  tokens: [],
};

// Reducer
const walletReducer = (state: WalletState, action: WalletAction): WalletState => {
  switch (action.type) {
    case 'WALLET_CONNECT_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case 'WALLET_CONNECT_SUCCESS':
      return {
        ...state,
        isConnected: true,
        address: action.payload.address,
        provider: action.payload.provider,
        chainId: action.payload.chainId,
        isLoading: false,
        error: null,
      };

    case 'WALLET_CONNECT_FAILURE':
      return {
        ...state,
        isConnected: false,
        address: null,
        provider: null,
        chainId: null,
        isLoading: false,
        error: action.payload,
      };

    case 'WALLET_DISCONNECT':
      return {
        ...state,
        isConnected: false,
        address: null,
        balance: '0',
        provider: null,
        chainId: null,
        error: null,
      };

    case 'WALLET_UPDATE_BALANCE':
      return {
        ...state,
        balance: action.payload,
      };

    case 'WALLET_UPDATE_NETWORK':
      return {
        ...state,
        network: action.payload,
      };

    case 'WALLET_UPDATE_CHAIN_ID':
      return {
        ...state,
        chainId: action.payload,
      };

    case 'WALLET_ADD_TRANSACTION':
      return {
        ...state,
        transactionHistory: [action.payload, ...state.transactionHistory],
      };

    case 'WALLET_UPDATE_TRANSACTION':
      return {
        ...state,
        transactionHistory: state.transactionHistory.map(tx =>
          tx.id === action.payload.id ? { ...tx, ...action.payload.updates } : tx
        ),
      };

    case 'WALLET_ADD_TOKEN':
      return {
        ...state,
        tokens: [...state.tokens, action.payload],
      };

    case 'WALLET_REMOVE_TOKEN':
      return {
        ...state,
        tokens: state.tokens.filter(token => token.address !== action.payload),
      };

    case 'WALLET_SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'WALLET_CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    case 'WALLET_SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };

    default:
      return state;
  }
};

// Create Context
const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Provider Component
export const WalletProvider: React.FC<ContextProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(walletReducer, initialState);

  // Initialize wallet from localStorage
  useEffect(() => {
    const initializeWallet = () => {
      const savedProvider = localStorage.getItem('walletProvider') as WalletState['provider'];
      const savedAddress = localStorage.getItem('walletAddress');
      const savedNetwork = localStorage.getItem('walletNetwork') as WalletState['network'];

      if (savedProvider && savedAddress) {
        // In a real app, you'd verify the connection here
        dispatch({
          type: 'WALLET_CONNECT_SUCCESS',
          payload: {
            address: savedAddress,
            provider: savedProvider,
            chainId: 1, // Default to Ethereum mainnet
          },
        });
        
        if (savedNetwork) {
          dispatch({
            type: 'WALLET_UPDATE_NETWORK',
            payload: savedNetwork,
          });
        }
      }
    };

    initializeWallet();
  }, []);

  // Listen for wallet events
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          dispatch({ type: 'WALLET_DISCONNECT' });
          localStorage.removeItem('walletAddress');
          localStorage.removeItem('walletProvider');
        } else if (accounts[0] !== state.address) {
          // Account changed
          dispatch({
            type: 'WALLET_CONNECT_SUCCESS',
            payload: {
              address: accounts[0],
              provider: state.provider || 'metamask',
              chainId: window.ethereum.chainId ? parseInt(window.ethereum.chainId, 16) : null,
            },
          });
          localStorage.setItem('walletAddress', accounts[0]);
        }
      };

      const handleChainChanged = (chainId: string) => {
        const numericChainId = chainId ? parseInt(chainId, 16) : null;
        dispatch({ type: 'WALLET_UPDATE_CHAIN_ID', payload: numericChainId });
        
        // Update network based on chain ID
        let network: WalletState['network'] = 'mainnet';
        if (numericChainId === 1) network = 'mainnet';
        else if (numericChainId === 3) network = 'testnet';
        else if (numericChainId === 1337) network = 'devnet';
        
        dispatch({ type: 'WALLET_UPDATE_NETWORK', payload: network });
        localStorage.setItem('walletNetwork', network);
      };

      if (window.ethereum?.on && window.ethereum?.removeListener) {
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);
      }

      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, [state.address, state.provider]);

  // Connect wallet function
  const connect = useCallback(async (provider: WalletState['provider']) => {
    try {
      dispatch({ type: 'WALLET_CONNECT_START' });

      let accounts: string[] = [];
      let chainId: number | null = null;

      if (provider === 'metamask' && window.ethereum) {
        accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        chainId = await window.ethereum.request({ method: 'eth_chainId' });
        chainId = chainId ? parseInt(chainId, 16) : null;
      } else {
        // Handle other wallet providers (WalletConnect, Phantom, etc.)
        throw new Error(`${provider} is not yet supported`);
      }

      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const address = accounts[0];
      
      // Save to localStorage
      localStorage.setItem('walletAddress', address);
      localStorage.setItem('walletProvider', provider);

      // Determine network
      let network: WalletState['network'] = 'mainnet';
      if (chainId === 1) network = 'mainnet';
      else if (chainId === 3) network = 'testnet';
      else if (chainId === 1337) network = 'devnet';
      
      localStorage.setItem('walletNetwork', network);

      dispatch({
        type: 'WALLET_CONNECT_SUCCESS',
        payload: { address, provider, chainId },
      });

      // Get initial balance
      await getBalance();
    } catch (error: any) {
      const message = error.message || 'Failed to connect wallet';
      dispatch({ type: 'WALLET_CONNECT_FAILURE', payload: message });
      throw error;
    }
  }, []);

  // Disconnect wallet function
  const disconnect = useCallback(() => {
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('walletProvider');
    localStorage.removeItem('walletNetwork');
    dispatch({ type: 'WALLET_DISCONNECT' });
  }, []);

  // Switch network function
  const switchNetwork = useCallback(async (network: WalletState['network']) => {
    try {
      let chainId: number;
      switch (network) {
        case 'mainnet':
          chainId = 1;
          break;
        case 'testnet':
          chainId = 3;
          break;
        case 'devnet':
          chainId = 1337;
          break;
        default:
          throw new Error('Unsupported network');
      }

      if (window.ethereum) {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${chainId!.toString(16)}` }],
        });
      }
    } catch (error: any) {
      const message = error.message || 'Failed to switch network';
      dispatch({ type: 'WALLET_SET_ERROR', payload: message });
      throw error;
    }
  }, []);

  // Send transaction function
  const sendTransaction = useCallback(async (to: string, amount: string, data?: string): Promise<Transaction> => {
    try {
      if (!state.address || !window.ethereum) {
        throw new Error('Wallet not connected');
      }

      const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const transaction: Transaction = {
        id: transactionId,
        hash: '',
        from: state.address,
        to,
        amount,
        gasUsed: '0',
        gasPrice: '0',
        status: 'pending',
        timestamp: new Date().toISOString(),
        data,
      };

      dispatch({ type: 'WALLET_ADD_TRANSACTION', payload: transaction });

      const txParams = {
        from: state.address,
        to,
        value: `0x${parseInt(amount, 10).toString(16)}`,
        data: data || '0x',
      };

      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      });

      // Update transaction with hash
      dispatch({
        type: 'WALLET_UPDATE_TRANSACTION',
        payload: {
          id: transactionId,
          updates: { hash: txHash },
        },
      });

      // Wait for confirmation
      const receipt = await window.ethereum.request({
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      });

      dispatch({
        type: 'WALLET_UPDATE_TRANSACTION',
        payload: {
          id: transactionId,
          updates: {
            status: receipt.status === 1 ? 'confirmed' : 'failed',
            gasUsed: receipt.gasUsed,
            blockNumber: receipt.blockNumber,
          },
        },
      });

      return { ...transaction, hash: txHash };
    } catch (error: any) {
      const message = error.message || 'Transaction failed';
      dispatch({ type: 'WALLET_SET_ERROR', payload: message });
      throw error;
    }
  }, [state.address]);

  // Sign message function
  const signMessage = useCallback(async (message: string): Promise<string> => {
    try {
      if (!state.address || !window.ethereum) {
        throw new Error('Wallet not connected');
      }

      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, state.address],
      });

      return signature;
    } catch (error: any) {
      const message = error.message || 'Message signing failed';
      dispatch({ type: 'WALLET_SET_ERROR', payload: message });
      throw error;
    }
  }, [state.address]);

  // Get balance function
  const getBalance = useCallback(async () => {
    try {
      if (!state.address || !window.ethereum) {
        return;
      }

      const balance = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [state.address, 'latest'],
      });

      const balanceInEth = parseInt(balance, 16) / Math.pow(10, 18);
      dispatch({
        type: 'WALLET_UPDATE_BALANCE',
        payload: balanceInEth.toString(),
      });
    } catch (error: any) {
      const message = error.message || 'Failed to get balance';
      dispatch({ type: 'WALLET_SET_ERROR', payload: message });
    }
  }, [state.address]);

  // Refresh balance function
  const refreshBalance = useCallback(async () => {
    await getBalance();
  }, [getBalance]);

  // Add token function
  const addToken = useCallback((token: Token) => {
    dispatch({ type: 'WALLET_ADD_TOKEN', payload: token });
  }, []);

  // Remove token function
  const removeToken = useCallback((address: string) => {
    dispatch({ type: 'WALLET_REMOVE_TOKEN', payload: address });
  }, []);

  // Clear error function
  const clearError = useCallback(() => {
    dispatch({ type: 'WALLET_CLEAR_ERROR' });
  }, []);

  // Set loading function
  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'WALLET_SET_LOADING', payload: loading });
  }, []);

  const contextValue: WalletContextType = {
    ...state,
    connect,
    disconnect,
    switchNetwork,
    sendTransaction,
    signMessage,
    getBalance,
    refreshBalance,
    addToken,
    removeToken,
    clearError,
    setLoading,
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
};

// Custom hook
export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

// Export for testing
export { WalletContext };

// Type declarations for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, handler: (...args: any[]) => void) => void;
      removeListener: (event: string, handler: (...args: any[]) => void) => void;
      chainId?: string;
    };
  }
}
