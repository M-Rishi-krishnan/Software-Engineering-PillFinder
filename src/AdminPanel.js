import React, { useEffect, useState } from "react";
import "./AdminPanel.css";
import { useNavigate } from "react-router-dom";
import { FaExclamationTriangle, FaTrash, FaPills, FaStore, FaUsers, FaUserCog } from "react-icons/fa";

const AdminPanel = () => {
  const [stores, setStores] = useState([]);
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredStores, setFilteredStores] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminAppPassword, setNewAdminAppPassword] = useState("");
  const [authorized, setAuthorized] = useState(false); // Track if user is authorized
  const [medicines, setMedicines] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const userRole = localStorage.getItem("role");
    
    if (!userRole || userRole !== "admin") {
      setAuthorized(false);
      setError("Only admins can access this page");
    } else {
      setAuthorized(true);
    }
    fetchStores();
    fetchUsers();
    fetchMedicines();
  }, []);


  const token = localStorage.getItem("token");

  const fetchStores = () => {
    fetch(`${process.env.REACT_APP_API_URL}/get-all-stores`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStores(data.stores);
          setFilteredStores(data.stores);
        } else {
          setError(data.message);
        }
      })
      .catch(() => setError("Failed to fetch stores."));
  };

  const fetchUsers = () => {
    fetch(`${process.env.REACT_APP_API_URL}/get-all-users`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setUsers(data.users);
        } else {
          setError(data.message);
        }
      })
      .catch(() => setError("Failed to fetch users."));
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredStores(stores);
      return;
    }

    const filtered = stores.filter((store) =>
      store.name.toLowerCase().startsWith(query.toLowerCase())
    );
    setFilteredStores(filtered);
  };

  // ✅ Delete Store + Owner
  const handleDeleteStore = async (storeId, ownerEmail) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/delete-store`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ storeId, ownerEmail }),
      });

      const data = await response.json();
      if (data.success) {
        setStores(stores.filter((store) => store.id !== storeId));
        setFilteredStores(filteredStores.filter((store) => store.id !== storeId));
        setUsers(users.filter((user) => user.email !== ownerEmail));
        setMessage("Store and its owner deleted successfully!");
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Error deleting store.");
    }
  };

  // ✅ Delete User + Store (if Owner)
  const handleDeleteUser = async (userId, role, storeId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${process.env.REACT_APP_API_URL}/delete-user`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ userId, role, storeId }),
      });

      const data = await response.json();
      if (data.success) {
        setUsers(users.filter((user) => user.id !== userId));
        if (role === "owner") {
          setStores(stores.filter((store) => store.id !== storeId));
          setFilteredStores(filteredStores.filter((store) => store.id !== storeId));
          setMessage("Owner and their store deleted successfully!");
        } else {
          setMessage("User deleted successfully!");
        }
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Error deleting user.");
    }
  };

  // ✅ Delete Admin
  const handleDeleteAdmin = async (adminId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/delete-admin`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ adminId }),
      });

      const data = await response.json();
      if (data.success) {
        setUsers(users.filter((user) => user.id !== adminId));
        setMessage("Admin deleted successfully!");
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Error deleting admin.");
    }
  };

  const handleAddAdmin = async () => {
    const adminEmail = localStorage.getItem("email"); // Get logged-in admin's email
  
    if (!adminEmail) {
      setError("Admin email is missing. Please log in again.");
      return;
    }
  
    if (!newAdminEmail || !newAdminPassword || !newAdminAppPassword) {
      setError("Admin email, password, and app password are required.");
      return;
    }
  
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/add-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminEmail,  // 🔹 Send logged-in admin's email
          email: newAdminEmail,
          password: newAdminPassword,
          appPassword: newAdminAppPassword,
        }),
      });
  
      const data = await response.json();
      if (data.success) {
        setMessage("New admin added successfully!");
        setNewAdminEmail("");
        setNewAdminPassword("");
        setNewAdminAppPassword("");
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Error adding admin.");
    }
  };
  
  const handleDeleteMedicine = async (medicineId, storeId, medicineName) => {
    try {
      if (!medicineId || !storeId || !medicineName) {
        setError("Missing required parameters for medicine deletion");
        return;
      }
      const email = localStorage.getItem("email");
      const response = await fetch(`${process.env.REACT_APP_API_URL}/admin-delete-medicine`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          medicineId: medicineId, 
          storeId: storeId, 
          medicineName: medicineName 
        }),
      });

      const data = await response.json();
      if (data.success) {
        setMedicines(medicines.filter(med => med.medicineName !== medicineName));
        setMessage("Medicine deleted successfully!");
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Error deleting medicine.");
    }
  };

  const fetchMedicines = () => {
    fetch(`${process.env.REACT_APP_API_URL}/get-all-medicines`, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setMedicines(data.medicines);
        } else {
          setError(data.message);
        }
      })
      .catch(() => setError("Failed to fetch medicines."));
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

  return (
    <div className="page-container">
      {!authorized ? (
        <div className="container">
          <div className="unauthorized-message">
            <FaExclamationTriangle size={50} color="#ff6b6b" />
            <h2>Access Denied</h2>
            <p>Only admins can access</p>
            <button 
              className="return-home-btn" 
              onClick={() => navigate("/")}
            >
              Return to Home
            </button>
          </div>
        </div>
      ) : (
        <div className="admin-container">
          <div className="admin-header">
            <h1 className="head1">ADMIN PANEL</h1>
            <button className="logout-btn1" onClick={handleLogout}>Logout</button>
          </div>
          
          {/* Navigation Links */}
          <div className="navigation-links">
            <a href="#stores-section"><FaStore /> Stores</a>
            <a href="#users-section"><FaUsers /> Users</a>
            <a href="#medicines-section"><FaPills /> Medicines</a>
            <a href="#add-admin-section"><FaUserCog /> Add Admin</a>
          </div>

          <input
            type="text"
            placeholder="Search stores..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="search-bar"
          />

          {/* Add id attribute to each section */}
          <div id="stores-section" className="store-list">
            <h2 className="head2">Manage Stores</h2>
            <table>
              <thead>
                <tr>
                  <th>Store Name</th>
                  <th>Owner Email</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStores.map((store) => (
                  <tr key={store.id}>
                    <td>{store.name}</td>
                    <td>{store.owner_email}</td>
                    <td>
                      <button className="delete-btn" onClick={() => handleDeleteStore(store.id, store.owner_email)}>
                        Delete Store & Owner
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div id="users-section" className="user-list">
            <h2 className="head2">Manage Users</h2>
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>
                      {user.role === "admin" ? (
                        <button className="delete-btn" onClick={() => handleDeleteAdmin(user.id)}>
                          Delete Admin
                        </button>
                      ) : (
                        <button className="delete-btn" onClick={() => handleDeleteUser(user.id, user.role, user.store_id)}>
                          Delete User
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* New Medicines Section */}
          <div id="medicines-section" className="medicine-list">
            <h2 className="head2">Manage Medicines</h2>
            <table>
              <thead>
                <tr>
                  <th>Medicine Name</th>
                  <th>Store</th>
                  <th>Stock</th>
                  <th>Price</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {medicines.map((medicine) => (
                  <tr key={medicine.id}>
                    <td>{medicine.name}</td>
                    <td>{medicine.store_name}</td>
                    <td>{medicine.stock}</td>
                    <td>${medicine.price.toFixed(2)}</td>
                    <td>
                      <button className="delete-btn" onClick={() => handleDeleteMedicine(medicine.id, medicine.store_id, medicine.name)}>
                        <FaTrash /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div id="add-admin-section">
            <h2 className="head2">Add New Admin</h2>
            <div className="add-admin">
              <input type="email" placeholder="Admin Email" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} />
              <input type="password" placeholder="Admin Password" value={newAdminPassword} onChange={(e) => setNewAdminPassword(e.target.value)} />
              <input type="password" placeholder="Admin Gmail App Password" value={newAdminAppPassword} onChange={(e) => setNewAdminAppPassword(e.target.value)} />
              <button onClick={handleAddAdmin}>Add Admin</button>
            </div>
          </div>

          {message && <p className="success">{message}</p>}
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
