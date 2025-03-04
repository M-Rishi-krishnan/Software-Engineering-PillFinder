import React, { useState } from "react";
import { FaUser, FaUserMd, FaUserShield } from "react-icons/fa";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import "./Login.css";

const Login = () => {
  const [role, setRole] = useState("customer");
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    setError("");
    if (!credentials.email || !credentials.password) {
      setError("Email and Password are required!");
      return;
    }

    const url = isSignUp ? "http://127.0.0.1:5000/signup" : "http://127.0.0.1:5000/signin";

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: credentials.email, password: credentials.password, role }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("email", credentials.email);
        localStorage.setItem("role", role);

        if (isSignUp && role === "storeOwner") {
          navigate("/create-store");
        } else if (role === "storeOwner") {
          navigate("/add-medicine");
        } else if (role === "customer") {
          navigate("/medicine-search");
        } else if (role === "admin") {
          navigate("/admin-panel");
        }
      } else {
        setError(data.message || "Login failed! Check your credentials.");
      }
    } catch (error) {
      console.error("❌ Error:", error);
      setError("Failed to connect to the server.");
    }
  };

  return (
    <div className="login-body">
      <div className="login-container">
        {/* Left Side Image */}
        <div className="login-image-container">
          <img
            src="https://img.freepik.com/free-vector/medical-prescription-concept-illustration_114360-29561.jpg"
            alt="Medical Illustration"
            className="login-image"
          />
        </div>
  
        {/* Right Side Login Box */}
        <div className="login-box">
          <h2 className="login-title">{isSignUp ? "Create an Account" : "Login"}</h2>
          {/* Role Selection */}
          <div className="role-selection">
            {[
              { name: "storeOwner", label: "Owner", icon: <FaUserMd size={30} /> },
              { name: "customer", label: "Customer", icon: <FaUser size={30} /> },
              { name: "admin", label: "Admin", icon: <FaUserShield size={30} /> },
            ].map((r) => (
              <motion.button
                key={r.name}
                className={`role-button ${role === r.name ? "selected" : ""}`}
                onClick={() => setRole(r.name)}
                whileTap={{ scale: 0.95 }}
              >
                {r.icon} <span>{r.label}</span>
              </motion.button>
            ))}
          </div>
  
          {/* Input Fields */}
          <div className="input-group1">
            <label>Email</label>
            <input type="email" name="email" placeholder="Enter your email" value={credentials.email} onChange={handleChange} />
          </div>
  
          <div className="input-group1">
            <label>Password</label>
            <input type="password" name="password" placeholder="Enter your password" value={credentials.password} onChange={handleChange} />
          </div>
  
          {error && <p className="error-message">{error}</p>}
  
          {/* Login Button */}
          <motion.button className="login-button" onClick={handleSubmit} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            {isSignUp ? "Sign Up" : `Login as ${role.charAt(0).toUpperCase() + role.slice(1)}`}
          </motion.button>
  
          {/* Signup Toggle */}
          <p className="signup-text">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <span className="signup-link" onClick={() => setIsSignUp((prev) => !prev)}>
              {isSignUp ? "Sign In" : "Sign Up"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
  
};

export default Login;
