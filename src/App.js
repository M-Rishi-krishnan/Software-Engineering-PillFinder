import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useLocation // Import useLocation
} from "react-router-dom";
import Login from "./login";
import MedicineSearch from "./MedicineSearch";
import CreateStore from "./CreateStore";
import AddMedicine from "./AddMedicine";
import AdminPanel from "./AdminPanel";


function App() {
  const [userRole, setUserRole] = useState(localStorage.getItem('role') || '');

  useEffect(() => {
    const handleStorageChange = () => {
      setUserRole(localStorage.getItem('role') || '');
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return (
    <Router>
      <AppContent userRole={userRole} />
    </Router>
  );
}

function AppContent() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/medicine-search" element={<MedicineSearch />} />
      <Route path="/create-store" element={<CreateStore />} />
      <Route path="/add-medicine" element={<AddMedicine />} />
      <Route path="/admin-panel" element={<AdminPanel />} />

    </Routes>
  );
}

export default App;