import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const MedicineSearch = () => {
  const [query, setQuery] = useState("");
  const [medicines, setMedicines] = useState([]);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // ✅ Redirect user to login if not authenticated
  useEffect(() => {
    if (!localStorage.getItem("isAuthenticated")) {
      navigate("/");
    }
  }, [navigate]);

  // ✅ Handle Search
  const handleSearch = async () => {
    if (!query.trim()) {
      setError("Please enter a medicine name.");
      setMedicines([]);
      return;
    }

    try {
      const response = await fetch(`http://127.0.0.1:5000/search-medicine?query=${query}`);
      const data = await response.json();

      if (data.success) {
        setMedicines(data.medicines);
        setError("");
      } else {
        setError(data.message);
        setMedicines([]);
      }
    } catch (err) {
      setError("Failed to fetch data. Please check your connection.");
      setMedicines([]);
    }
  };

  // ✅ Allow searching with "Enter" key
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // ✅ Logout Function
  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    navigate("/");
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 p-6">
      {/* Navbar */}
      <div className="w-full flex justify-between items-center bg-blue-600 text-white p-4 rounded-lg shadow-md">
        <h1 className="text-xl font-semibold">Medicine Finder</h1>
        <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg">
          Logout
        </button>
      </div>

      {/* Search Section */}
      <div className="mt-6 flex space-x-3">
        <input
          type="text"
          className="p-3 w-72 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="Enter medicine name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyPress} // ✅ Fixed Enter Key Event
        />
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-all"
          onClick={handleSearch}
        >
          Search
        </button>
      </div>

      {/* Error Message */}
      {error && <p className="text-red-500 mt-3">{error}</p>}

      {/* Medicine Results */}
      <div className="mt-6 w-full max-w-3xl bg-white shadow-lg rounded-lg p-4">
        {medicines.length > 0 ? (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-blue-500 text-white">
                <th className="p-3 text-left">Medicine</th>
                <th className="p-3 text-left">Store</th>
                <th className="p-3 text-left">Stock</th>
                <th className="p-3 text-left">Price</th>
                <th className="p-3 text-left">Store Address</th>
              </tr>
            </thead>
            <tbody>
              {medicines.map((med, index) => (
                <tr key={index} className="border-b hover:bg-gray-100">
                  <td className="p-3">{med.name}</td>
                  <td className="p-3">{med.store_name}</td>
                  <td className="p-3">{med.stock}</td>
                  <td className="p-3">${med.price.toFixed(2)}</td>
                  <td className="p-3">{med.store_address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          !error && <p className="text-gray-500 text-center">No medicines found in any stores.</p>
        )}
      </div>
    </div>
  );
};

export default MedicineSearch;
