import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./AddMedicine.css"; 
import { FaExclamationTriangle} from "react-icons/fa";

  const AddMedicine = () => {
  const [medicineName, setMedicineName] = useState("");
  const [stock, setStock] = useState("");
  const [price, setPrice] = useState("");
  const [medicines, setMedicines] = useState([]); 
  const [storeName, setStoreName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const token = localStorage.getItem("token");  
  const email = localStorage.getItem("email"); 
  const [authorized, setAuthorized] = useState(false); 

  useEffect(() => {
    const userRole = localStorage.getItem("role");
    
    if (!userRole || userRole !== "storeOwner") {
      setAuthorized(false);
      setError("Only store owners can access this page");
    } else {
      setAuthorized(true);
    }
    if (!email) {
      setError("User not found. Please log in again.");
      navigate("/");
      return;
    }
    fetchStoreName();
  }, [email]);

  const fetchStoreName = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/get-store?email=${email}`);
      const data = await response.json();
      if (data.success && data.store) {
        setStoreName(data.store);
        fetchMedicines(data.store);
      } else {
        setError(data.message || "Failed to fetch store name.");
      }
    } catch (error) {
      setError("Failed to connect to the server.");
    }
  };

  const fetchMedicines = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/get-medicines?email=${email}`);
      const data = await response.json();
      if (data.success) {
        setMedicines(data.medicines);
      } else {
        setError(data.message || "Failed to load medicines.");
      }
    } catch (error) {
      setError("Failed to connect to the server.");
    }
  };

const handleSubmit = async () => {
  setMessage("");
  setError("");

  if (!medicineName || !stock || !price) {
    setError("All fields are required.");
    return;
  }

  if (isTokenExpired()) {
    setError("Session expired. Please login again.");
    navigate("/");
    return;
  }

  if (parseInt(stock, 10) <= 0) {
    setError("Stock must be greater than zero.");
    return;
  }

  if (parseFloat(price) < 0) {
    setError("Price cannot be negative.");
    return;
  }

  setLoading(true);
  try {
    const response = await fetch(`${process.env.REACT_APP_API_URL}/add-medicine`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}` 
      },
      body: JSON.stringify({
        email,
        medicineName,
        stock: parseInt(stock, 10),
        price: parseFloat(price),
      }),
    });

    const data = await response.json();
    if (data.success) {
      setMessage("Medicine added successfully!");
      setMedicineName("");
      setStock("");
      setPrice("");
      fetchMedicines();
    } else {
      setError(data.message || "Failed to add medicine.");
    }
  } catch (error) {
    setError("Failed to connect to the server.");
  } finally {
    setLoading(false);
  }
};

const isTokenExpired = () => {
  const token = localStorage.getItem("token");
  if (!token) return true;
  const payload = token.split('.')[1];
  const decoded = JSON.parse(atob(payload));
  return decoded.exp < Date.now() / 1000;
};

if (isTokenExpired()) {
  navigate("/");
}

  const handleUpdate = async (medicineName, updatedStock, updatedPrice) => {
    setError("");
    setMessage("");
    
    if (parseInt(updatedStock, 10) <= 0) {
      setError("Stock must be greater than zero.");
      return;
    }
  
    if (parseFloat(updatedPrice) < 0) {
      setError("Price cannot be negative.");
      return;
    }

    const token = localStorage.getItem("token"); 

    const requestBody = {
      email,
      medicineName,
      stock: parseInt(updatedStock, 10),
      price: parseFloat(updatedPrice),
    };

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/update-medicine`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 

        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      if (data.success) {
        setMessage("Medicine updated successfully!");
        fetchMedicines(); 
      } else {
        setError(data.message || "Failed to update medicine.");
      }
    } catch (error) {
      setError("Failed to connect to the server.");
    }
  };

  const handleLogout = () => {
        localStorage.removeItem("isAuthenticated");
        localStorage.removeItem("role");
        localStorage.removeItem("token");
        localStorage.removeItem("email");
       
        const auth0Domain = process.env.AUTH0_DOMAIN;
        const clientId = process.env.AUTH0_CLIENT_ID;
        const returnToUrl = `${window.location.origin}`; 
      
        window.location.href = `https://${auth0Domain}/v2/logout?returnTo=${encodeURIComponent(returnToUrl)}&client_id=${clientId}`;
  };

  if (!authorized) {
    return (
      <div className="container1">
        <div className="unauthorized-message">
          <FaExclamationTriangle size={50} color="#ff6b6b" />
          <h2>Access Denied</h2>
          <p>Only storeOwners can access</p>
          <button 
            className="return-home-btn" 
            onClick={() => navigate("/")}
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="container1">
      <div className="navbar1">
        <h2 className="store-title">Store: {storeName || "Loading..."}</h2>
        <button className="logout-btn" onClick={handleLogout}>
          <i className="fas fa-sign-out-alt"></i> Logout
        </button>
      </div>

      <div className="add-medicine-container">
        <h1>Add Medicine</h1>

        <input 
          type="text" 
          placeholder="Medicine Name" 
          value={medicineName} 
          onChange={(e) => setMedicineName(e.target.value)} 
          className="input-field"
        />
        <input 
          type="number" 
          placeholder="Stock" 
          value={stock} 
          onChange={(e) => setStock(e.target.value)} 
          className="input-field"
        />
        <input 
          type="number" 
          placeholder="Price" 
          value={price} 
          onChange={(e) => setPrice(e.target.value)} 
          className="input-field"
        />

        <button className="submit-btn" onClick={handleSubmit} disabled={loading}>
          <i className="fas fa-plus-circle"></i> {loading ? "Adding..." : "Add Medicine"}
        </button>

        {error && <p className="error-msg">{error}</p>}
        {message && <p className="success-msg">{message}</p>}

        <h2 className="medicine-list-heading">Available Medicines</h2>
        <div className="medicine-list">
          {medicines.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Stock</th>
                  <th>Price</th>
                  <th>Update</th>
                </tr>
              </thead>
              <tbody>
                {medicines.map((med, index) => (
                  <tr key={index}>
                    <td>{med.medicineName}</td>
                    <td><input type="number" value={med.stock} onChange={(e) => {
                          const updated = [...medicines];
                          updated[index].stock = e.target.value;
                          setMedicines(updated);
                        }}/></td>
                    <td><input type="number" value={med.price} onChange={(e) => {
                          const updated = [...medicines];
                          updated[index].price = e.target.value;
                          setMedicines(updated);
                        }}/></td>
                    <td>
                      <button className="update-btn" onClick={() => handleUpdate(med.medicineName, med.stock, med.price)}>
                        <i className="fas fa-edit"></i> Update
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="no-medicine">No medicines available.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddMedicine;
