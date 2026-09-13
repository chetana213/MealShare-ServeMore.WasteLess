import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { token, user } = useAuth();
  const location = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: location }} />;

  const role = String(user?.role || "").toLowerCase();
  const permittedRoles = allowedRoles?.map((allowedRole) => String(allowedRole).toLowerCase());
  if (permittedRoles && !permittedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
