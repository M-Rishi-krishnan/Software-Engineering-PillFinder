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
  const [priceRange, setPriceRange] = useState({ min: 0, max: Infinity });
  const [maxDistance, setMaxDistance] = useState(Infinity);
  const [minStock, setMinStock] = useState(0);
  const [storeQuery, setStoreQuery] = useState("");

  const navigate = useNavigate();

  const userRole = localStorage.getItem("role");

  const handleAddMedicineClick = () => {
    navigate("/add-medicine");
  };

  useEffect(() => {
    if (!localStorage.getItem("isAuthenticated")) {
      navigate("/medicine-search");
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
              const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
              const data = await response.json();
  
              const address = data.display_name || "Address not found";
              const location = { latitude, longitude, address };
  
              setUserLocation(location); 
              resolve(location);
            } catch (error) {
              console.error("Error fetching address:", error);
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
  
  const filterByPrice = (medicine) => {
    return medicine.price >= priceRange.min && medicine.price <= priceRange.max;
  };
  
  const filterByDistance = (medicine) => {
    return medicine.distance_km <= maxDistance;
  };
  
  const filterByStock = (medicine) => {
    return medicine.stock >= minStock;
  };
  
  const filterByStoreName = (medicine) => {
    return storeQuery === "" || medicine.store_name.toLowerCase().includes(storeQuery.toLowerCase());
  };
  
  const fetchFilteredMedicines = async (input) => {
    try {
      const { latitude, longitude } = userLocation || {};
    
      if (!latitude || !longitude) {
        setError("Location is required to fetch medicines.");
        return;
      }
    
      const queryParam = input.trim() ? `query=${encodeURIComponent(input)}` : 'query=';
      const url = `http://127.0.0.1:5000/search-medicines?${queryParam}&latitude=${latitude}&longitude=${longitude}`;
    
      const response = await fetch(url);
      const data = await response.json();
    
      if (response.ok && data.success) {
        let filteredResults = data.medicines
          .filter(filterByPrice)
          .filter(filterByDistance)
          .filter(filterByStock)
          .filter(filterByStoreName);
    
        setFilteredMedicines(filteredResults);
        /*
        if (input.trim()) {
          const uniqueSuggestions = [
            ...new Set(data.medicines.map((med) => med.name.toLowerCase()))
          ].filter((name) => name.toLowerCase() !== input.toLowerCase()).slice(0, 5);
          setSuggestions(uniqueSuggestions);
        } else {
          setSuggestions([]);
        }*/
      } else {
        setError(data.message || "Failed to fetch medicines.");
        setFilteredMedicines([]);
        setSuggestions([]);
      }
    } catch (err) {
      console.error("Error fetching medicines:", err);
      setError("Error fetching medicines.");
    }
  };
  
  const handleSearch = (input) => {
    setQuery(input);
    fetchFilteredMedicines(input);
  };

  const handleLogout = () => {
    // Clear application session
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("role");
    localStorage.removeItem("token");
    localStorage.removeItem("email");
   
    // Redirect to Auth0 logout endpoint
    const auth0Domain = "dev-pfxq5f1mprdmtiuk.us.auth0.com"; // Replace with your Auth0 domain
    const clientId = "p0ltv0AFCMYykNcihJLcfSwveNUKHVXV"; // Replace with your Client ID
    const returnToUrl = `${window.location.origin}`; // Redirect back to your website's login page
  
    window.location.href = `https://${auth0Domain}/v2/logout?returnTo=${encodeURIComponent(returnToUrl)}&client_id=${clientId}`;
  };
  
  const handleFilterApply = () => {
    fetchFilteredMedicines(query);
  };

  const isSearching = query.trim() !== "";

  return (
    <div className="MedicineSearch-body">
      <div className="container">
        <motion.div className="navbar" initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }}>
          <h1 className="title">Find Your Medicine</h1>
          <div className="nav-buttons">
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

        <div className="main-content">
          <div className="filter-sidebar">
            <h3>Filters</h3>
            <input
              type="number"
              placeholder="Min Price"
              onChange={(e) => setPriceRange({ ...priceRange, min: Number(e.target.value) || 0 })}
            />
            <input
              type="number"
              placeholder="Max Price"
              onChange={(e) => setPriceRange({ ...priceRange, max: Number(e.target.value) || Infinity })}
            />
            <input
              type="number"
              placeholder="Max Distance (km)"
              onChange={(e) => setMaxDistance(Number(e.target.value) || Infinity)}
            />
            <input
              type="number"
              placeholder="Min Stock"
              onChange={(e) => setMinStock(Number(e.target.value) || 0)}
            />
            <input
              type="text"
              placeholder="Search by store name"
              value={storeQuery}
              onChange={(e) => setStoreQuery(e.target.value)}
            />
            <button onClick={handleFilterApply}>Apply Filters</button>
          </div>

          <div className="search-results">
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
                    {isSearching && <th>Distance (km)</th>}
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
                      {isSearching && <td>{med.distance_km} km</td>}
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              
              ) : (
                !error && (
                  <p className="no-results">No medicines found.</p>
                )
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicineSearch;
