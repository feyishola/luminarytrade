import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "../components/auth/ProtectedRoute";
import { AuthContext, AuthContextValue } from "../context/AuthContext";

const renderWithAuth = (value: Partial<AuthContextValue>) => {
  const defaults: AuthContextValue = {
    user: null,
    accessToken: null,
    csrfToken: null,
    loading: false,
    error: null,
    sessionExpiresAt: null,
    loginWithEmail: jest.fn(),
    loginWithWallet: jest.fn(),
    loginWithSocial: jest.fn(),
    signup: jest.fn(),
    logout: jest.fn(),
    logoutAll: jest.fn(),
    refresh: jest.fn(),
    hasRole: () => false,
  };

  return render(
    <AuthContext.Provider value={{ ...defaults, ...value }}>
      <MemoryRouter initialEntries={["/private"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/private" element={<div>Private</div>} />
          </Route>
          <Route path="/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
};

describe("ProtectedRoute", () => {
  it("redirects unauthenticated users", async () => {
    renderWithAuth({ user: null, loading: false });
    expect(await screen.findByText("Login")).toBeInTheDocument();
  });

  it("renders children for authenticated users", () => {
    renderWithAuth({
      user: {
        id: "user-1",
        email: "user@example.com",
        publicKey: null,
        roles: ["user"],
        tier: "free",
        emailVerified: true,
      },
    });
    expect(screen.getByText("Private")).toBeInTheDocument();
  });
});
