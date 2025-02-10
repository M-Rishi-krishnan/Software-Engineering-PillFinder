import React, { useState } from "react";
import { FaUserMd, FaUser } from "react-icons/fa";
import { motion } from "framer-motion";

const Login = () => {
  const [role, setRole] = useState("doctor");
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
    <div className="h-screen flex items-center justify-center bg-blue-100">
      <div className="flex w-3/4 h-5/6 bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Left Side Image */}
        <div
          className="w-1/2 bg-cover bg-center"
          style={{
            backgroundImage:
              "url(https://img.freepik.com/free-vector/medical-prescription-concept-illustration_114360-6755.jpg?w=740)",
          }}
        ></div>

        {/* Right Side Login Form */}
        <div className="w-1/2 p-10 flex flex-col justify-center bg-white">
          <h2 className="text-3xl font-semibold text-center text-blue-700 mb-6">
            {isSignUp ? "Create an Account" : "Login"}
          </h2>

          {/* Role Selection */}
          <div className="flex justify-center gap-6 mb-6">
            {[
              { name: "doctor", icon: <FaUserMd size={30} /> },
              { name: "patient", icon: <FaUser size={30} /> },
            ].map((r) => (
              <motion.div
                key={r.name}
                className={`flex flex-col items-center p-4 border rounded-lg cursor-pointer transition-all w-1/3 text-center shadow-md ${
                  role === r.name ? "border-blue-500 bg-blue-100" : "border-gray-300"
                }`}
                onClick={() => setRole(r.name)}
                whileTap={{ scale: 0.95 }}
              >
                {r.icon}
                <span className="text-lg font-medium capitalize mt-2">{r.name}</span>
              </motion.div>
            ))}
          </div>

          {/* Email Input */}
          <div className="mb-4">
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
          <div className="mb-4">
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
          <p className="text-center text-gray-600 text-lg">
            {isSignUp ? "Already have an account?" : "Don't have an account?"} {" "}
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
  );
};

export default Login;
