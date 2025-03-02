import React, { useEffect, useState } from "react";

const AdminPanel = () => {
  const [stores, setStores] = useState([]); // ✅ Holds all stores
  const [searchQuery, setSearchQuery] = useState(""); // ✅ Holds user input for search
  const [filteredStores, setFilteredStores] = useState([]); // ✅ Stores that match the search
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // ✅ Add Admin Form State
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");

  useEffect(() => {
    fetch("http://127.0.0.1:5000/get-all-stores")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStores(data.stores);
          setFilteredStores(data.stores); // ✅ Initially, show all stores
        } else {
          setError(data.message);
        }
      })
      .catch(() => setError("Failed to fetch stores."));
  }, []);

  // ✅ Handle Search (Filter stores starting with the input)
  const handleSearch = (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredStores(stores); // Show all stores if search is empty
      return;
    }

    const filtered = stores.filter((store) =>
      store.name.toLowerCase().startsWith(query.toLowerCase())
    );
    setFilteredStores(filtered);
  };

  // ✅ Delete Store Function
  const handleDeleteStore = async (storeId) => {
    try {
      const response = await fetch("http://127.0.0.1:5000/delete-store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId }),
      });

      const data = await response.json();
      if (data.success) {
        setStores(stores.filter((store) => store.id !== storeId));
        setFilteredStores(filteredStores.filter((store) => store.id !== storeId));
        setMessage("Store deleted successfully!");
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Error deleting store.");
    }
  };

  // ✅ Handle Add Admin
  const handleAddAdmin = async () => {
    if (!newAdminEmail || !newAdminPassword) {
      setError("Admin email and password are required.");
      return;
    }

    const adminEmail = localStorage.getItem("email"); // ✅ Get logged-in admin email

    try {
      const response = await fetch("http://127.0.0.1:5000/add-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newAdminEmail,
          password: newAdminPassword,
          adminEmail, // ✅ Ensure only an admin can add another admin
        }),
      });

      const data = await response.json();
      if (data.success) {
        setMessage("New admin added successfully!");
        setNewAdminEmail("");
        setNewAdminPassword("");
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Error adding admin.");
    }
  };

  return (
    <div className="container">
      <h1>Admin Panel</h1>

      {/* ✅ Search Bar */}
      <input
        type="text"
        placeholder="Search stores..."
        value={searchQuery}
        onChange={(e) => handleSearch(e.target.value)}
        className="search-bar"
      />

      {/* ✅ Display Stores */}
      <div className="store-list">
        {filteredStores.length > 0 ? (
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
                    <button onClick={() => handleDeleteStore(store.id)}>Delete Store</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No stores found.</p>
        )}
      </div>

      {/* ✅ Add Admin Section */}
      <h2>Add New Admin</h2>
      <input
        type="email"
        placeholder="New Admin Email"
        value={newAdminEmail}
        onChange={(e) => setNewAdminEmail(e.target.value)}
        className="admin-input"
      />
      <input
        type="password"
        placeholder="New Admin Password"
        value={newAdminPassword}
        onChange={(e) => setNewAdminPassword(e.target.value)}
        className="admin-input"
      />
      <button onClick={handleAddAdmin}>Add Admin</button>

      {/* ✅ Messages */}
      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
};

export default AdminPanel;
