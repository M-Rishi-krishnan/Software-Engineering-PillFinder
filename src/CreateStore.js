import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const CreateStore = () => {
  const [storeName, setStoreName] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleCreateStore = async () => {
    if (!storeName.trim()) {
      setError("Store name cannot be empty.");
      return;
    }
  
    const requestBody = {
      email: localStorage.getItem("email"),
      storeName: storeName,
    };
  
    console.log("🔹 Sending Data:", requestBody); // ✅ Debugging log
  
    try {
      const response = await fetch("http://127.0.0.1:5000/create-store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
  
      const data = await response.json();
      console.log("🔹 Server Response:", data); // ✅ Debugging log
  
      if (response.ok && data.success) {
        localStorage.setItem("storeName", storeName); // ✅ Store name in localStorage
        alert("Store created successfully!");
        navigate("/add-medicine"); // ✅ Redirect to medicine add page
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Failed to create store. Check your connection.");
    }
  };
  

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-semibold text-blue-700 mb-6">Create Your Store</h1>

      <input
        type="text"
        className="p-3 w-72 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        placeholder="Enter Store Name..."
        value={storeName}
        onChange={(e) => setStoreName(e.target.value)}
      />

      <button
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg mt-4"
        onClick={handleCreateStore}
      >
        Create Store
      </button>

      {error && <p className="text-red-500 mt-3">{error}</p>}
    </div>
  );
};

export default CreateStore;
