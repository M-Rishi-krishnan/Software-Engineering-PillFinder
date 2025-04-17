import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Modal from "react-modal";
import "./MedicineSearch.css";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

Modal.setAppElement('#root');

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
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState(null);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  
  const userLat = userLocation?.latitude || 0;
  const userLng = userLocation?.longitude || 0;
  const medLat = selectedMedicine?.latitude || 0;
  const medLng = selectedMedicine?.longitude || 0;

  const startIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
  
  const endIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

//To dynamically watch if user coordinates are changing
useEffect(() => {
  let watchId;
  const successCallback = async (position) => {
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
      );
      const data = await response.json();
      const address = data.display_name || "Address not found";
      setUserLocation({ latitude, longitude, address });
    } catch (error) {
      console.error("Error fetching address:", error);
      setUserLocation(prev => ({ ...prev, latitude, longitude }));
    }
  };

  const errorCallback = (error) => {
    console.error("Geolocation error:", error);
    setLocationError("Error updating live location");
  };

  if (navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(
      successCallback,
      errorCallback,
      { 
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  }

  return () => {
    if (watchId) navigator.geolocation.clearWatch(watchId);
  };
}, []);

//For Getting directions to store after selecting a medicine
useEffect(() => {
  if (selectedMedicine?.latitude && userLocation?.latitude) {
    getDirections();
  }
}, [userLocation, selectedMedicine]);

//Selecting a medicine
const handleMedicineSelect = (medicine) => {
    setRouteCoordinates(null);
    setSelectedMedicine(medicine);  
    if (medicine.store_id) {
      fetchStoreCoordinates(medicine.store_id);
      setModalIsOpen(true);
    }
  };
  
const closeModal = () => {
    setModalIsOpen(false);
  };
  
  useEffect(() => {
    if (selectedMedicine && selectedMedicine.latitude && selectedMedicine.longitude && userLocation) {
      getDirections();
    }
  }, [selectedMedicine, userLocation]);
  
//Getting store Coordinates
const fetchStoreCoordinates = async (storeId) => {
    try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/get-store-coordinates?store_id=${storeId}`);
        const data = await response.json();
        if (data.success) {
            setSelectedMedicine(prevState => ({
                ...prevState,
                latitude: data.latitude,
                longitude: data.longitude,
            }));
        } else {
            alert("Failed to fetch store coordinates.");
        }
    } catch (error) {
        alert("Error fetching store coordinates: " + error.message);
    }
};
;

const customModalStyles = {
    content: {
      top: '50%',
      left: '50%',
      right: 'auto',
      bottom: 'auto',
      marginRight: '-50%',
      transform: 'translate(-50%, -50%)',
      width: '80%',
      maxWidth: '800px',
      height: '560px',
      padding: '20px',
    },
    overlay: {
      backgroundColor: 'rgba(0, 0, 0, 0.75)'
    }
  };
    
//Main get direction function
const getDirections = async () => {
      if (!selectedMedicine || !selectedMedicine.latitude || !selectedMedicine.longitude || !userLocation) {
        alert("Invalid coordinates for directions");
        return;
      }
      
      try {
        setRouteCoordinates(null);
        const response = await fetch(`${process.env.REACT_APP_API_URL}/get-directions?start_lat=${String(userLocation.latitude)}&start_lon=${String(userLocation.longitude)}&end_lat=${String(selectedMedicine.latitude)}&end_lon=${String(selectedMedicine.longitude)}`);
        const data = await response.json();      
        if (data.routes && data.routes[0] && data.routes[0].geometry) {
          const decodedRoute = decodePolyline(data.routes[0].geometry);
          setRouteCoordinates(decodedRoute);
        } 
        else if (data.features && data.features[0] && data.features[0].geometry) {
          const coordinates = data.features[0].geometry.coordinates;
          const routeCoords = coordinates.map(coord => [coord[1], coord[0]]);
          setRouteCoordinates(routeCoords);
        } 
      } catch (error) {
      }
    };
    
    //Checking if Coordinates are in right format
    useEffect(() => {
      if (routeCoordinates && routeCoordinates.length > 0) {
        const firstPoint = routeCoordinates[0];
        if (Array.isArray(firstPoint) && firstPoint.length === 2) {
        } else {
          alert("Warning: Coordinates may be in wrong format: " + JSON.stringify(firstPoint));
        }
      }
    }, [routeCoordinates]);
    

    const navigate = useNavigate();
    const userRole = localStorage.getItem("role");

    //Test navigation button
    const handleAddMedicineClick = () => {
      navigate("/add-medicine");
    };

    useEffect(() => {
      if (!localStorage.getItem("isAuthenticated")) {
        navigate("/");
      }
    }, [navigate]);


    //Displays all medicines available on mount
    useEffect(() => {
      const fetchAllMedicines = async () => {
        try {
          const response = await fetch(`${process.env.REACT_APP_API_URL}/get-all-medicines`);
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

    //Gets user location on mount
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
    
    //For plotting route on map
    function decodePolyline(encoded) {
      const poly = [];
      let index = 0;
      const len = encoded.length;
      let lat = 0;
      let lng = 0;
    
      while (index < len) {
        let b;
        let shift = 0;
        let result = 0;
        do {
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;
    
        shift = 0;
        result = 0;
        do {
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;
    
        poly.push([lat / 1e5, lng / 1e5]);
      }
    
      return poly;
    }
    

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
    
    //Fetch medicines after applying filters
    const fetchFilteredMedicines = async (input) => {
      try {
        const { latitude, longitude } = userLocation || {};
      
        if (!latitude || !longitude) {
          setError("Location is required to fetch medicines.");
          return;
        }
      
        const queryParam = input.trim() ? `query=${encodeURIComponent(input)}` : 'query=';
        const url = `${process.env.REACT_APP_API_URL}/search-medicines?${queryParam}&latitude=${latitude}&longitude=${longitude}`;
      
        const response = await fetch(url);
        const data = await response.json();
      
        if (response.ok && data.success) {
          let filteredResults = data.medicines
            .filter(filterByPrice)
            .filter(filterByDistance)
            .filter(filterByStock)
            .filter(filterByStoreName);
      
          setFilteredMedicines(filteredResults);
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
    
    //Searching for a medicine
    const handleSearch = (input) => {
      setQuery(input);
      fetchFilteredMedicines(input);
    };

    const handleLogout = () => {
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("role");
      localStorage.removeItem("token");
      localStorage.removeItem("email");
    
      const auth0Domain = "dev-pfxq5f1mprdmtiuk.us.auth0.com";
      const clientId = "p0ltv0AFCMYykNcihJLcfSwveNUKHVXV";
      const returnToUrl = `${window.location.origin}`;
    
      window.location.href = `https://${auth0Domain}/v2/logout?returnTo=${encodeURIComponent(returnToUrl)}&client_id=${clientId}`;
    };
    
    const handleFilterApply = () => {
      fetchFilteredMedicines(query);
    };

    //For distance visibility while searching for a medicine
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
                   Your Location: {userLocation.address}
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
                      <th>Directions</th>
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
                        <td><button onClick={() => handleMedicineSelect(med)}>Get Directions</button></td>
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
        <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        style={customModalStyles}
        contentLabel="Directions Map"
      >
        <div className="modal-header">
          <h2>Directions to {selectedMedicine?.store_name}</h2>
          <button onClick={closeModal} className="close-modal-btn">×</button>
        </div>
        
        {userLocation && selectedMedicine && (
          <MapContainer 
            key={`map-${selectedMedicine.store_id}`}
            center={[userLocation.latitude, userLocation.longitude]} 
            zoom={13} 
            style={{ height: '400px', width: '100%' }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            
            {userLocation.latitude && userLocation.longitude && (
              <Marker position={[userLat, userLng]} icon={startIcon}>
                <Popup>Your Location</Popup>
              </Marker>
            )}
            
            {selectedMedicine.latitude && selectedMedicine.longitude && (
              <Marker position={[medLat, medLng]} icon={endIcon}>
                <Popup>{selectedMedicine?.store_name || 'Selected Medicine'}</Popup>
              </Marker>
            )}
            
            {routeCoordinates && routeCoordinates.length > 0 && (
              <Polyline 
                key={selectedMedicine?.id || Math.random()}
                positions={routeCoordinates} 
                color="blue" 
                weight={5} 
                opacity={0.7} 
              />
            )}
          </MapContainer>
        )}
        
        <div className="modal-footer">
  <button onClick={closeModal} className="btn">Close</button>
</div>

      </Modal>
    </div>
  );
};

export default MedicineSearch;
