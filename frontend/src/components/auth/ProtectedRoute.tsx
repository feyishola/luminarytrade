import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

interface ProtectedRouteProps {
  requiredRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requiredRoles }) => {
  const { user, loading, hasRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div style={{ padding: 24 }}>Checking session...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRoles && requiredRoles.length > 0) {
    const allowed = requiredRoles.every((role) => hasRole(role));
    if (!allowed) {
      return (
        <div style={{ padding: 24 }}>
          <h2>Access denied</h2>
          <p>Your account does not have permission to view this page.</p>
        </div>
      );
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;
