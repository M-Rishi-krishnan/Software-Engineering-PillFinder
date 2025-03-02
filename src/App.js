import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./login";
import MedicineSearch from "./MedicineSearch";
import CreateStore from "./CreateStore";
import AddMedicine from "./AddMedicine";
import AdminPanel from "./AdminPanel";  // ✅ Import Admin Panel
import ProtectedRoute from "./ProtectedRoute";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/medicine-search" element={<ProtectedRoute><MedicineSearch /></ProtectedRoute>} />
        <Route path="/create-store" element={<ProtectedRoute><CreateStore /></ProtectedRoute>} />
        <Route path="/add-medicine" element={<ProtectedRoute><AddMedicine /></ProtectedRoute>} />
        <Route path="/admin-panel" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default App;
