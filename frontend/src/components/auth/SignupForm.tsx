import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";

interface SignupFormProps {
  onSuccess?: () => void;
}

const SignupForm: React.FC<SignupFormProps> = ({ onSuccess }) => {
  const { signup, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [walletKey, setWalletKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length >= 8 && password === confirmPassword;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!canSubmit) {
      setError("Check your email and password (min 8 chars, matching confirmation)." );
      return;
    }

    try {
      const response = await signup(email.trim(), password, walletKey.trim() || undefined);
      const verificationNote = response.emailVerificationRequired
        ? "Check your inbox to verify your email."
        : "You can sign in now.";
      const tokenNote = response.verificationToken
        ? ` Dev verification token: ${response.verificationToken}`
        : "";
      setMessage(`Account created. ${verificationNote}${tokenNote}`);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label style={labelStyle}>Email</label>
      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@company.com"
        style={inputStyle}
      />

      <label style={{ ...labelStyle, marginTop: 16 }}>Password</label>
      <input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Minimum 8 characters"
        style={inputStyle}
      />

      <label style={{ ...labelStyle, marginTop: 16 }}>Confirm password</label>
      <input
        type="password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        placeholder="Re-enter password"
        style={inputStyle}
      />

      <label style={{ ...labelStyle, marginTop: 16 }}>Wallet public key (optional)</label>
      <input
        type="text"
        value={walletKey}
        onChange={(event) => setWalletKey(event.target.value)}
        placeholder="0x..."
        style={inputStyle}
      />

      {error && <div style={errorStyle}>{error}</div>}
      {message && <div style={successStyle}>{message}</div>}

      <button type="submit" disabled={!canSubmit || loading} style={primaryButtonStyle}>
        {loading ? "Creating..." : "Create account"}
      </button>
    </form>
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
  background: "#2563eb",
  color: "white",
  fontWeight: 600,
  fontSize: 15,
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

const successStyle: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 12px",
  borderRadius: 10,
  background: "#dcfce7",
  color: "#15803d",
  fontSize: 13,
};

export default SignupForm;
