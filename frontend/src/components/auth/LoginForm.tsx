import React, { useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useWalletActions } from "../../hooks/useWalletActions";
import { WalletType } from "../../providers/IWalletProvider";

interface LoginFormProps {
  onSuccess?: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const { loginWithEmail, loginWithWallet, loginWithSocial, loading, error } = useAuth();
  const wallet = useWalletActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [walletType, setWalletType] = useState<WalletType>(wallet.availableWallets[0] ?? "metamask");
  const [socialProvider, setSocialProvider] = useState("google");
  const [socialEmail, setSocialEmail] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.trim().length >= 8;

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    if (!canSubmit) {
      setLocalError("Enter a valid email and password (min 8 chars).");
      return;
    }

    try {
      await loginWithEmail(email.trim(), password);
      onSuccess?.();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Login failed.");
    }
  };

  const handleWalletLogin = async () => {
    setLocalError(null);
    if (!wallet.isConnected) {
      try {
        await wallet.connect(walletType);
      } catch (error) {
        setLocalError(error instanceof Error ? error.message : "Wallet connection failed.");
        return;
      }
    }

    if (!wallet.account?.address) {
      setLocalError("Connect a wallet before signing.");
      return;
    }

    const message = `Login:${Date.now()}`;
    const signature = await wallet.signAuthChallenge(message);

    if (!signature) {
      setLocalError("Wallet signature failed.");
      return;
    }

    try {
      await loginWithWallet({
        publicKey: wallet.account.address,
        message,
        signature,
      });
      onSuccess?.();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Wallet login failed.");
    }
  };

  const handleSocialLogin = async () => {
    setLocalError(null);
    const token = `dev-${Date.now()}`;
    try {
      await loginWithSocial({
        provider: socialProvider,
        token,
        email: socialEmail || undefined,
      });
      onSuccess?.();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Social login failed.");
    }
  };

  const availableWallets = useMemo(
    () => wallet.availableWallets,
    [wallet.availableWallets],
  );

  return (
    <div>
      <form onSubmit={handleLogin}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          style={inputStyle}
        />

        <label style={{ display: "block", fontWeight: 600, marginBottom: 6, marginTop: 16 }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          style={inputStyle}
        />

        {(localError || error) && (
          <div style={errorStyle}>{localError || error}</div>
        )}

        <button
          type="submit"
          disabled={!canSubmit || loading}
          style={primaryButtonStyle}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div style={sectionDividerStyle}>
        <span>Or continue with</span>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <label style={labelStyle}>Wallet</label>
          <div style={{ display: "flex", gap: 8 }}>
            <select
              value={walletType}
              onChange={(event) => setWalletType(event.target.value as WalletType)}
              style={{ ...inputStyle, padding: "10px 12px" }}
            >
              {availableWallets.map((walletType) => (
                <option key={walletType} value={walletType}>
                  {walletType}
                </option>
              ))}
            </select>
            <button type="button" onClick={handleWalletLogin} style={secondaryButtonStyle}>
              {wallet.isConnected ? "Sign with Wallet" : "Connect Wallet"}
            </button>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Social (dev)</label>
          <div style={{ display: "grid", gap: 8 }}>
            <select
              value={socialProvider}
              onChange={(event) => setSocialProvider(event.target.value)}
              style={{ ...inputStyle, padding: "10px 12px" }}
            >
              <option value="google">Google</option>
              <option value="github">GitHub</option>
              <option value="discord">Discord</option>
            </select>
            <input
              type="email"
              value={socialEmail}
              onChange={(event) => setSocialEmail(event.target.value)}
              placeholder="Optional email"
              style={inputStyle}
            />
            <button type="button" onClick={handleSocialLogin} style={secondaryButtonStyle}>
              Continue with {socialProvider}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  fontSize: 14,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 600,
  marginBottom: 6,
};

const primaryButtonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 18,
  padding: "12px",
  borderRadius: 10,
  border: "none",
  background: "#4f46e5",
  color: "white",
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #cbd5f5",
  background: "#eef2ff",
  color: "#4338ca",
  fontWeight: 600,
  cursor: "pointer",
};

const errorStyle: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 12px",
  borderRadius: 10,
  background: "#fee2e2",
  color: "#b91c1c",
  fontSize: 13,
};

const sectionDividerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  margin: "24px 0",
  color: "#94a3b8",
  fontSize: 13,
};

export default LoginForm;
