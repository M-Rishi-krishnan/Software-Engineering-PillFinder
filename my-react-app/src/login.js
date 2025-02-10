import React, { useState } from "react";
import { FaUser, FaUserMd } from "react-icons/fa";
import { motion } from "framer-motion";

const Login = () => {
  const [role, setRole] = useState("doctor"); // Default role is "doctor"
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [isSignUp, setIsSignUp] = useState(false);

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    const url = isSignUp
      ? "http://127.0.0.1:5000/signup"
      : "http://127.0.0.1:5000/signin";
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...credentials, role }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      alert(data.message);
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to connect to the server. Please check your backend.");
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
          zIndex: 1, // Keeps form above the blurred background
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
                { name: "doctor", label: "Doctor", icon: <FaUserMd size={50} /> },
                { name: "patient", label: "Patient", icon: <FaUser size={50} /> },
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
              <label className="block text-lg font-medium text-gray-700" style={{ paddingRight: "40px" }}>
                Email
              </label>
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
              <label className="block text-lg font-medium text-gray-700" style={{ paddingRight: "12px" }}>
                Password
              </label>
              <input
                type="password"
                name="password"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mt-2"
                placeholder="Enter your password"
                value={credentials.password}
                onChange={handleChange}
              />
            </div>

            {/* Submit Button */}
            <motion.button
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600 text-white font-semibold py-3 rounded-lg transition-all shadow-lg mb-4"
              onClick={handleSubmit}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isSignUp ? "Sign Up" : `Login as ${role.charAt(0).toUpperCase() + role.slice(1)}`}
            </motion.button>

            {/* Toggle Sign-Up/Sign-In */}
            <p className="text-gray-600">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <span
                className="text-blue-600 cursor-pointer hover:underline"
                onClick={() => setIsSignUp(!isSignUp)}
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