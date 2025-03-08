import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import "./MedicineSearch.css";

const MedicineSearch = () => {
  const [query, setQuery] = useState("");
  const [allMedicines, setAllMedicines] = useState([]);
  const [filteredMedicines, setFilteredMedicines] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState("");
  const [userLocation, setUserLocation] = useState(null); 
  const [locationError, setLocationError] = useState(""); 
  const navigate = useNavigate();

  const userRole = localStorage.getItem("role");

  const handleAddMedicineClick = () => {
    navigate("/add-medicine");
  };

  useEffect(() => {
    if (!localStorage.getItem("isAuthenticated")) {
      navigate("/");
    }
  }, [navigate]);

  useEffect(() => {
    const fetchAllMedicines = async () => {
      try {
        const response = await fetch("http://127.0.0.1:5000/get-all-medicines");
        const data = await response.json();

        if (data.success) {
          setAllMedicines(data.medicines);
          setFilteredMedicines(data.medicines);
        } else {
          setError("Failed to load medicines.");
        }
      } catch (err) {
        setError("Failed to fetch data.");
      }
    };

    fetchAllMedicines();
  }, []);

  // Get user location on component mount
  useEffect(() => {
    const fetchLocation = async () => {
      const location = await getUserLocation();
      setUserLocation(location);
    };

    fetchLocation();
  }, []);

  const getUserLocation = () => {
    return new Promise((resolve) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            
            try {
              // 🌍 Reverse Geocode to get Address
              const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
              const data = await response.json();
  
              const address = data.display_name || "Address not found";
              const location = { latitude, longitude, address };
  
              setUserLocation(location); 
              resolve(location);
            } catch (error) {
              console.error("❌ Error fetching address:", error);
              resolve({ latitude, longitude, address: "Address not available" });
            }
          },
          (error) => {
            let message = "Unknown error occurred.";
            switch (error.code) {
              case error.PERMISSION_DENIED:
                message = "Location access denied by user.";
                break;
              case error.POSITION_UNAVAILABLE:
                message = "Location information is unavailable.";
                break;
              case error.TIMEOUT:
                message = "Location request timed out.";
                break;
            }
            setLocationError(message);
            resolve({ latitude: null, longitude: null, address: "Location error" });
          }
        );
      } else {
        setLocationError("Geolocation is not supported in your browser.");
        resolve({ latitude: null, longitude: null, address: "Not supported" });
      }
    });
  };
  

  const fetchFilteredMedicines = async (input) => {
    if (!input.trim()) {
      setFilteredMedicines(allMedicines);
      setSuggestions([]);
      return;
    }
  
    try {
      const { latitude, longitude } = userLocation || {};
  
      if (!latitude || !longitude) {
        setError("Location is required to fetch medicines.");
        return;
      }
  
      console.log("📤 Sending API Request:", { query: input, latitude, longitude });
  
      const response = await fetch(
        `http://127.0.0.1:5000/search-medicines?query=${input}&latitude=${latitude}&longitude=${longitude}`
      );

      if (response.status === 400 || response.status === 404) {
        setError(data.message || "Error occurred while fetching medicines.");
        setFilteredMedicines([]);
      }
      

      const data = await response.json();
  
      console.log("🔄 API Response:", data);
  
      if (data.success) {
        setFilteredMedicines(data.medicines);
  
        // ✅ Extract unique medicine names for suggestions
        const uniqueSuggestions = [
          ...new Set(data.medicines.map((med) => med.name.toLowerCase()))
        ].filter((name) => name.toLowerCase() !== input.toLowerCase()).slice(0, 5);
  
        setSuggestions(uniqueSuggestions);
      } else {
        setFilteredMedicines([]);
        setSuggestions([]);
      }
    } catch (err) {
      console.error("❌ Error fetching medicines:", err);
      setError("Error fetching medicines.");
    }
  };
  

  const handleSearch = (input) => {
    setQuery(input);
    fetchFilteredMedicines(input);
  };

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("role");
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    navigate("/");
  };
  

  const isSearching = query.trim() !== ""; // ✅ Check if a search is active

  return (
    <div className="MedicineSearch-body">
      <div className="container">
        <motion.div className="navbar" initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }}>
          <h1 className="title">Find Your Medicine</h1>
          <div className="nav-buttons">
            {/* Only show Add Medicine button if user is a store owner */}
            {userRole === "customer" && (
              <button 
                onClick={handleAddMedicineClick} 
                className="add-medicine-btn"
              >
                Add Medicine
              </button>
            )}
          <button onClick={handleLogout} className="logout-btn">Logout</button>
          </div>
        </motion.div>

        {userLocation ? (
  <p className="location-display">
    🌍 Your Location: {userLocation.address}
  </p>
) : (
  <p className="error-msg">{locationError}</p>
)}


        <motion.div className="search-box" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5 }}>
          <input
            type="text"
            className="search-input"
            placeholder="Enter medicine name..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </motion.div>

        {suggestions.length > 0 && (
          <ul className="suggestions">
            {suggestions.map((s, index) => (
              <li key={index} onClick={() => handleSearch(s)}>{s}</li>
            ))}
          </ul>
        )}

        {error && <p className="error-msg">{error}</p>}

       {/* Results Table */}
       <motion.div 
  className="results-container" 
  initial={{ y: 30, opacity: 0 }} 
  animate={{ y: 0, opacity: 1 }} 
  transition={{ duration: 0.5 }}
>
  {filteredMedicines.length > 0 ? (
    <table className="medicine-table">
      <thead>
        <tr>
          <th>Medicine</th>
          <th>Store</th>
          <th>Stock</th>
          <th>Price</th>
          <th>Store Address</th>
          <th>Store Phone</th>
          {isSearching && <th>Distance (km)</th>} {/* Conditionally show column */}
        </tr>
      </thead>
      <tbody>
        {filteredMedicines.map((med, index) => (
          <motion.tr 
            key={index} 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <td>{med.name}</td>
            <td>{med.store_name}</td>
            <td>{med.stock}</td>
            <td>${med.price.toFixed(2)}</td>
            <td>{med.store_address}</td>
            <td>{med.store_phone}</td>
            {isSearching && <td>{med.distance_km} km</td>} {/* Conditionally show value */}
          </motion.tr>
        ))}
      </tbody>
    </table>
  ) : (
    !error && (
      // Display "No medicines found" when there are no results and no error
      <p className="no-results">No medicines found.</p>
    )
  )}
</motion.div>


      </div>
    </div>
  );
};

export default MedicineSearch;  