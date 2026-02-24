import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import LoginForm from "./LoginForm";
import SignupForm from "./SignupForm";

interface AuthPageProps {
  mode: "login" | "signup";
}

const AuthPage: React.FC<AuthPageProps> = ({ mode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || "/";

  const handleSuccess = () => {
    navigate(from, { replace: true });
  };

  return (
    <div style={{
      minHeight: "80vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 16px",
      background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)",
    }}>
      <div style={{
        width: "min(100%, 420px)",
        background: "white",
        borderRadius: 16,
        boxShadow: "0 20px 50px rgba(15, 23, 42, 0.12)",
        padding: 32,
      }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p style={{ color: "#64748b", marginTop: 8 }}>
            {mode === "login"
              ? "Sign in with email, wallet, or social account."
              : "Sign up to secure your session and access protected tools."}
          </p>
        </div>

        {mode === "login" ? (
          <LoginForm onSuccess={handleSuccess} />
        ) : (
          <SignupForm onSuccess={() => navigate("/login")} />
        )}

        <div style={{ marginTop: 24, fontSize: 14, textAlign: "center" }}>
          {mode === "login" ? (
            <span>
              No account? <Link to="/signup">Sign up</Link>
            </span>
          ) : (
            <span>
              Already have an account? <Link to="/login">Sign in</Link>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
