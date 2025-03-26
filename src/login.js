import React, { useState, useEffect } from "react";
import { FaUser, FaUserMd, FaUserShield, FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import "./Login.css";

const Login = () => {
  const [role, setRole] = useState("customer");
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState("");
  const [authMethod, setAuthMethod] = useState(0);
  const navigate = useNavigate();
  const { loginWithRedirect, user, isAuthenticated } = useAuth0();

  useEffect(() => {
    if (role === "admin") {
      setIsSignUp(false);
    }
  }, [role]);
  

  useEffect(() => {
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("role");
    localStorage.removeItem("token");
    localStorage.removeItem("email");
  }, []);

  const handleAuth0Login = async (selectedRole) => {
    localStorage.setItem('selectedRole', selectedRole);
    await loginWithRedirect({
      prompt: "login",
      redirectUri: `${window.location.origin}`,
    });
  };

  useEffect(() => {
    const handleRoleSelect = async () => {
      if (isAuthenticated && user) {
        try {
          const auth0Role = localStorage.getItem('selectedRole') || 'customer';
          
          const response = await fetch("http://127.0.0.1:5000/auth0-signin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: user.email,
              name: user.name,
              auth0Id: user.sub,
              role: auth0Role
            }),
          });
  
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              localStorage.setItem("isAuthenticated", "true");
              localStorage.setItem("token", data.token);
              localStorage.setItem("email", user.email);
              localStorage.setItem("role", auth0Role);
              navigate(data.redirect, { replace: true });
            } else {
              setError(data.message || "Login failed!");
            }
          } else {
            setError("Failed to connect to the server.");
          }
        } catch (error) {
          console.error("Error during Auth0 signin:", error);
          setError("An error occurred while connecting to the server.");
        }
      }
    };
  
    handleRoleSelect();
  }, [isAuthenticated, user, navigate]);

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
        if (role === "admin" && data.step === "otp") {
          setStep(2);
        } else {
          localStorage.setItem("isAuthenticated", "true");
          localStorage.setItem("token", data.token);
          localStorage.setItem("email", credentials.email);
          localStorage.setItem("role", role);
          navigate(data.redirect, { replace: true });
        }
      } else {
        setError(data.message || "Login failed! Check your credentials.");
      }
    } catch (error) {
      console.error("❌ Error:", error);
      setError("Failed to connect to the server.");
    }
  };

  const handleVerifyOtp = async () => {
    setError("");
    if (!otp.trim()) {
      setError("OTP is required!");
      return;
    }

    try {
      const response = await fetch("http://127.0.0.1:5000/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: credentials.email, otp }),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem("email", data.email);
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", "admin");
        navigate("/admin-panel");
      } else {
        setError(data.message || "Invalid OTP.");
      }
    } catch (error) {
      console.error("❌ Error:", error);
      setError("Failed to verify OTP.");
    }
  };

  const nextAuthMethod = () => {
    setAuthMethod((prev) => (prev === 0 ? 1 : 0));
  };

  const prevAuthMethod = () => {
    setAuthMethod((prev) => (prev === 0 ? 1 : 0));
  };

  return (
    <div className="login-body">
      <div className="login-container">
        <div className="login-image-container">
          <img
            src="https://img.freepik.com/free-vector/medical-prescription-concept-illustration_114360-29561.jpg"
            alt="Medical Illustration"
            className="login-image"
          />
        </div>

        <div className="login-box">
          <h2 className="login-title">
            {step === 1 ? (isSignUp ? "Create an Account" : "Login") : "Enter OTP"}
          </h2>

          {step === 1 && (
            <>
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

              <div className="carousel-container">
                <button className="carousel-arrow left" onClick={prevAuthMethod}>
                  <FaArrowLeft />
                </button>
                
                <div className="carousel-wrapper">
                  <AnimatePresence mode="wait">
                    <motion.div 
                      key={authMethod}
                      className="carousel-slide"
                      initial={{ opacity: 0, x: authMethod === 0 ? -100 : 100 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: authMethod === 0 ? 100 : -100 }}
                      transition={{ duration: 0.3 }}
                    >
                      {authMethod === 0 ? (
                        <div className="traditional-auth">
                          <h3 className="Login-Heading">
                          {isSignUp && role !== "admin" ? "Signup With PillFindr" : "Login With PillFindr"}
                          </h3>

                          <div className="input-group1">
                            <label>Email</label>
                            <input 
                              type="email" 
                              name="email" 
                              placeholder="Enter your email" 
                              value={credentials.email} 
                              onChange={handleChange} 
                            />
                          </div>

                          <div className="input-group1">
                            <label>Password</label>
                            <input 
                              type="password" 
                              name="password" 
                              placeholder="Enter your password" 
                              value={credentials.password} 
                              onChange={handleChange} 
                            />
                          </div>

                          {error && <p className="error-message">{error}</p>}

                          <motion.button 
                            className="login-button" 
                            onClick={handleSubmit} 
                            whileHover={{ scale: 1.05 }} 
                            whileTap={{ scale: 0.95 }}
                          >
                            {isSignUp ? "Sign Up" : `Login as ${role.charAt(0).toUpperCase() + role.slice(1)}`}
                          </motion.button>

                          {role !== "admin" && (
                            <p className="signup-text">
                              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
                              <span className="signup-link" onClick={() => setIsSignUp((prev) => !prev)}>
                                {isSignUp ? "Sign In" : "Sign Up"}
                              </span>
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="auth0-auth">
                          <h3 className="Login-Heading">
                          {isSignUp && role !== "admin" ? "Signup with Auth0" : "Login with Auth0"}
                          </h3>

                          <p>Use your social accounts or Auth0 to login securely</p>
                          
                          <div className="auth0-buttons">
                            <motion.button 
                              className="auth0-button customer"
                              onClick={() => handleAuth0Login("customer")}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <FaUser size={24} />
                              <span>{isSignUp && role !== "admin" ? "Signup" : "Login"} as Customer</span>

                            </motion.button>
                            
                            <motion.button 
                              className="auth0-button store-owner"
                              onClick={() => handleAuth0Login("storeOwner")}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <FaUserMd size={24} />
                              <span>{isSignUp && role !== "admin" ? "Signup" : "Login"} as Owner</span>

                            </motion.button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
                
                <button className="carousel-arrow right" onClick={nextAuthMethod}>
                  <FaArrowRight />
                </button>
              </div>

              <div className="carousel-indicators">
                <span 
                  className={`indicator ${authMethod === 0 ? 'active' : ''}`} 
                  onClick={() => setAuthMethod(0)}
                ></span>
                <span 
                  className={`indicator ${authMethod === 1 ? 'active' : ''}`} 
                  onClick={() => setAuthMethod(1)}
                ></span>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="otp-message">An OTP has been sent to your email. Enter it below.</p>
              <div className="input-group1">
                <label>OTP</label>
                <input type="text" placeholder="Enter OTP" value={otp} onChange={(e) => setOtp(e.target.value)} />
              </div>

              {error && <p className="error-message">{error}</p>}

              <motion.button 
                className="login-button" 
                onClick={handleVerifyOtp} 
                whileHover={{ scale: 1.05 }} 
                whileTap={{ scale: 0.95 }}
              >
                Verify OTP
              </motion.button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
