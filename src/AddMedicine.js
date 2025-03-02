import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const AddMedicine = () => {
  const [medicineName, setMedicineName] = useState("");
  const [stock, setStock] = useState("");
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(""); // ✅ State for errors
  const [loading, setLoading] = useState(false); // ✅ State for disabling button during submission

  const navigate = useNavigate(); // ✅ Fix: Define navigate
  const storeName = localStorage.getItem("storeName"); // ✅ Fix: Get store name from localStorage

  const handleSubmit = async () => {
    setMessage("");
    setError("");

    // ✅ Ensure fields are not empty
    if (!medicineName || !stock || !price) {
      setError("All fields are required.");
      return;
    }

    // ✅ Ensure store name exists
    if (!storeName) {
      setError("Store name not found! Please create a store first.");
      return;
    }

    const requestBody = {
      email: localStorage.getItem("email"), 
      storeName: localStorage.getItem("storeName"), // ✅ Ensure storeName is stored on login
      medicineName,
      stock: parseInt(stock, 10),
      price: parseFloat(price),
    };
    

    console.log("🔹 Sending Request:", requestBody); // ✅ Debugging log

    setLoading(true); // ✅ Disable button while submitting

    try {
      const response = await fetch("http://127.0.0.1:5000/add-medicine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      console.log("🔹 Server Response:", data); // ✅ Debugging log

      if (response.ok && data.success) {
        setMessage("Medicine added successfully!");
        setMedicineName("");
        setStock("");
        setPrice("");

        // ✅ Redirect to dashboard after success
        //setTimeout(() => navigate("/dashboard"), 2000);
      } else {
        setError(data.message || "Failed to add medicine.");
      }
    } catch (error) {
      console.error("❌ Error:", error);
      setError("Failed to connect to the server.");
    } finally {
      setLoading(false); // ✅ Re-enable button
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-semibold text-blue-700 mb-6">Add Medicine</h1>

      <div className="flex flex-col space-y-4 w-96 p-6 bg-white shadow-lg rounded-lg">
        <input
          type="text"
          placeholder="Medicine Name"
          value={medicineName}
          onChange={(e) => setMedicineName(e.target.value)}
          className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="number"
          placeholder="Stock"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="number"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />

        {/* Submit Button */}
        <button
          className={`bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg ${
            loading ? "opacity-50 cursor-not-allowed" : ""
          }`}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Adding..." : "Add Medicine"}
        </button>

        {/* Error Message */}
        {error && <p className="text-center text-red-500 mt-3">{error}</p>}

        {/* Success Message */}
        {message && <p className="text-center text-green-500 mt-3">{message}</p>}
      </div>
    </div>
  );
};

export default AddMedicine;
