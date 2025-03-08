import React, { useEffect, useState } from "react";
import "./AdminPanel.css";
import { useNavigate } from "react-router-dom";
import { FaExclamationTriangle} from "react-icons/fa";

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
  }, []);
  const token = localStorage.getItem("token");
  const fetchStores = () => {
    fetch("http://127.0.0.1:5000/get-all-stores", {
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
    fetch("http://127.0.0.1:5000/get-all-users", {
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
      const response = await fetch("http://127.0.0.1:5000/delete-store", {
        method: "POST",
        headers: { "Content-Type": "application/json",
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
      const response = await fetch("http://127.0.0.1:5000/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json",
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
      const response = await fetch("http://127.0.0.1:5000/delete-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json",
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
      const response = await fetch("http://127.0.0.1:5000/add-admin", {
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
  

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    navigate("/");
  };

  if (!authorized) {
      return (
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
      );
    }

  return (
    <div className="page-container">
      <div className="admin-container">
        <div className="admin-header">
          <h1 className="head1">ADMIN PANEL</h1>
          <button className="logout-btn1" onClick={handleLogout}>Logout</button>
        </div>

        <input
          type="text"
          placeholder="Search stores..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="search-bar"
        />

        <div className="store-list">
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

        <div className="user-list">
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

        <h2 className="head2">Add New Admin</h2>
        <div className="add-admin">
          <input type="email" placeholder="Admin Email" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} />
          <input type="password" placeholder="Admin Password" value={newAdminPassword} onChange={(e) => setNewAdminPassword(e.target.value)} />
          <input type="password" placeholder="Admin Gmail App Password" value={newAdminAppPassword} onChange={(e) => setNewAdminAppPassword(e.target.value)} />
          <button onClick={handleAddAdmin}>Add Admin</button>
        </div>

        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
};

export default AdminPanel;
