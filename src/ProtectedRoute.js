import React, { useEffect } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";

const ProtectedRoute = ({ children, allowedRoles }) => {
    const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
    const userRole = localStorage.getItem("role");
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        console.log("🔑 ProtectedRoute: Current Role:", userRole, "Is Authenticated:", isAuthenticated, "Location:", location.pathname);
    }, [userRole, isAuthenticated, location.pathname]);

    if (!isAuthenticated) {
        console.log("🔒 ProtectedRoute: Not authenticated, redirecting to /");
        return <Navigate to="/" replace />;  // Use replace to prevent backtracing
    }

    if (allowedRoles && !allowedRoles.includes(userRole)) {
        console.log(`🚫 ProtectedRoute: Unauthorized! Role: ${userRole}, Allowed: ${allowedRoles}`);
        localStorage.clear();
        navigate("/", { replace: true });  // Use replace and navigate together
        return null; // Return null to prevent rendering
    }

    return children;
};

export default ProtectedRoute;
