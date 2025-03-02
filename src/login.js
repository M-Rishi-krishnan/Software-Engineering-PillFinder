import React, { useState } from "react";
import { FaUser, FaUserMd } from "react-icons/fa";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const [role, setRole] = useState("customer");
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // ✅ Handles input changes
  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  // ✅ Handles form submission
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
        body: JSON.stringify({ email: credentials.email, password: credentials.password, role }), // ✅ Include role
      });
  
      const data = await response.json();
  
      if (response.ok && data.success) {
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("email", credentials.email);
        localStorage.setItem("role", role); // ✅ Save role
  
        if (isSignUp && role === "storeOwner") {
          navigate("/create-store");
        } else if (role === "storeOwner") {
          navigate("/add-medicine");
        } else if(role === "customer") {
          navigate("/medicine-search");
        } else if (role === "admin") {
          navigate("/admin-panel")
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
    <div
      style={{
        height: "100vh",
        width: "100vw",
        backgroundColor: "rgba(169, 205, 222, 0.8)",
        backgroundPosition: "center",
        position: "relative",
      }}
    >
      {/* Blurry Overlay */}
      <div
        style={{
          height: "100%",
          width: "100%",
          position: "absolute",
          backgroundColor: "rgba(0, 0, 0, 0.3)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      ></div>

      {/* Login Container */}
      <div
        className="flex justify-center items-center h-full"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            width: "62%",
            height: "90%",
            backgroundColor: "white",
            borderRadius: "20px",
            border: "1px solid grey",
            overflow: "hidden",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
          }}
        >
          {/* Left Side Image */}
          <div
            style={{
              width: "58%",
              backgroundImage:
                "url(https://img.freepik.com/free-vector/medical-prescription-concept-illustration_114360-6755.jpg?t=st=1739019987~exp=1739023587~hmac=376444b1cc9b77b140dd2adff2072e555c863e092acd57d9dcc8b0bc9f0ece7b&w=740)",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          ></div>

          {/* Right Side Login Form */}
          <div
            className="w-1/2 p-10 flex flex-col justify-center items-center bg-white"
            style={{
              border: "1px solid black",
              height: "50%",
              width: "40%",
              position: "relative",
              top: "20%",
              left: "3%",
            }}
          >
            <h2 className="text-3xl font-semibold text-blue-700 mb-6">
              {isSignUp ? "Create an Account" : "Login"}
            </h2>

            {/* Role Selection */}
            <div className="flex justify-center gap-6 mb-6">
              {[
                { name: "storeOwner", label: "Owner", icon: <FaUserMd size={50} /> },
                { name: "customer", label: "Customer", icon: <FaUser size={50} /> },
                { name: "admin", label: "Admin", icon: <FaUser size={50} /> },
              ].map((r) => (
                <motion.button
                  key={r.name}
                  className={`flex flex-col items-center px-6 py-3 w-36 rounded-lg border shadow-sm transition-all
                  ${role === r.name ? "bg-blue-100 border-blue-500" : "bg-white"}`}
                  onClick={() => setRole(r.name)}
                  whileTap={{ scale: 0.95 }}
                >
                  {r.icon}
                  <span className="mt-2 font-medium">{r.label}</span>
                </motion.button>
              ))}
            </div>

            {/* Email Input */}
            <div className="w-full mb-4">
              <label className="block text-lg font-medium text-gray-700">Email</label>
              <input
                type="email"
                name="email"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mt-2"
                placeholder="Enter your email"
                value={credentials.email}
                onChange={handleChange}
              />
            </div>

            {/* Password Input */}
            <div className="w-full mb-6">
              <label className="block text-lg font-medium text-gray-700">Password</label>
              <input
                type="password"
                name="password"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mt-2"
                placeholder="Enter your password"
                value={credentials.password}
                onChange={handleChange}
              />
            </div>

            {/* Error Message */}
            {error && <p className="text-red-500 mb-4">{error}</p>}

            {/* Submit Button */}
            <motion.button
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600 text-white font-semibold py-3 rounded-lg transition-all shadow-lg mb-4"
              onClick={handleSubmit}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isSignUp ? "Sign Up" : `Login as ${role.charAt(0).toUpperCase() + role.slice(1)}`}
            </motion.button>

            {/* Toggle Between Sign-In & Sign-Up */}
            <p className="text-gray-600">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <span
                className="text-blue-600 cursor-pointer hover:underline"
                onClick={() => setIsSignUp((prev) => !prev)} // ✅ Fixed Toggle
              >
                {isSignUp ? "Sign In" : "Sign Up"}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
