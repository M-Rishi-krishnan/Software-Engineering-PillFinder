import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./CreateStore.css";
import { FaStore, FaUser, FaPhone ,FaExclamationTriangle} from "react-icons/fa";

const storeIconUrl = "https://cdn-icons-png.flaticon.com/512/4320/4320337.png";

const storeIcon = new L.Icon({
  iconUrl: storeIconUrl,
  iconSize: [40, 40],
});

const CreateStore = () => {
  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [location, setLocation] = useState({ lat: 28.6139, lng: 77.209 }); 
  const [address, setAddress] = useState("Default location: New Delhi"); 
  const [authorized, setAuthorized] = useState(false); 

  const navigate = useNavigate();

  //Getting current owner address
  useEffect(() => {
    const userRole = localStorage.getItem("role");
    
    if (!userRole || userRole !== "storeOwner") {
      setAuthorized(false);
      setError("Only storeOwners can access this page");
     
    } else {
      setAuthorized(true);
    }
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setLocation(newLocation);
          setError(""); 
          fetchAddress(newLocation.lat, newLocation.lng);
        },
        (error) => {
          setError("Click to select location  ");
        }
      );
    } else {
      setError("Geolocation is not supported by your browser.");
    }
  }, []);

  //For getting address
  const fetchAddress = async (lat, lng) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await response.json();
      if (data && data.display_name) {
        setAddress(data.display_name);
      } else {
        setAddress("Address not found");
      }
    } catch (error) {
      setAddress("Error fetching address");
    }
  };

  //Marking shop location on amp
  const LocationMarker = () => {
    useMapEvents({
      click(e) {
        const newLocation = { lat: e.latlng.lat, lng: e.latlng.lng };
        setLocation(newLocation);
        setError("");
        fetchAddress(newLocation.lat, newLocation.lng);
      },
    });

    return (
      <Marker position={[location.lat, location.lng]} icon={storeIcon}>
        <Popup>{address}</Popup>
      </Marker>
    );
  };

  //Posts to backend for creating a store
  const handleCreateStore = async () => {
    if (!storeName.trim() || !ownerName.trim() || !phone.trim() || location.lat == null || location.lng == null) {
      setError("All fields are required.");
      return;
    }
    
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Please log in first");
      navigate("/login");
      return;
  }
    const requestBody = {
      email: localStorage.getItem("email"),
      storeName,
      ownerName,
      phone,
      latitude: location.lat,  
      longitude: location.lng,  
      address,
    };
  
    console.log("Sending Data:", requestBody); 
  
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/create-store`, {
        method: "POST",
        headers: { "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` },
        body: JSON.stringify(requestBody),
      });
  
      const data = await response.json();
      console.log("Server Response:", data);
  
      if (response.ok && data.success) {
        alert("Store created successfully!");
        navigate("/add-medicine");
      } else {
        setError(data.message);
      }
    } catch (err) {
      console.error("Failed to create store:", err);
      setError("Failed to create store. Check your connection.");
    }
  };
  
   if (!authorized) {
    return (
      <div className="createstorebody">
        <div className="create-store-container">
          <div className="unauthorized-message">
            <FaExclamationTriangle size={50} color="#ff6b6b" />
            <h2>Access Denied</h2>
            <p>Only storeOwners can access</p>
            <button 
              className="store-button" 
              onClick={() => navigate("/")}
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }
  

  return (
    <div className="createstorebody">
      <div className="create-store-container">
        <div className="store-icon-container">
          <img src={storeIconUrl} alt="Store Icon" className="store-icon-image" />
        </div>

        <div className="store-card">
          <h1>Create Your Store</h1>
          <div className="input-group">
            <FaStore />
            <input
              type="text"
              className="store-input"
              placeholder="Store Name"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
            />
          </div>

          <div className="input-group">
            <FaUser />
            <input
              type="text"
              className="store-input"
              placeholder="Owner Name"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
            />
          </div>

          <div className="input-group">
            <FaPhone />
            <input
              type="text"
              className="store-input"
              placeholder="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <h3>Select Store Location</h3>
          {error && <p className="error-text">{error}</p>}
          <p><strong>Selected Address:</strong> {address}</p>

          <MapContainer
            center={[location.lat, location.lng]}
            zoom={13}
            style={{ height: "300px", width: "100%", borderRadius: "10px" }}
            className="custom-map"
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <LocationMarker />
          </MapContainer>
          <button className="store-button" onClick={handleCreateStore}>
            Create Store
          </button>
        </div>
      </div>
    </div>
  ); 
};

export default CreateStore;
