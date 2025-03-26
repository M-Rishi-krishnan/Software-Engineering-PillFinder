import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Auth0Provider } from '@auth0/auth0-react';
import Login from './login';
import MedicineSearch from './MedicineSearch';
import CreateStore from './CreateStore';
import AddMedicine from './AddMedicine';
import AdminPanel from './AdminPanel';

function App() {
  return (
    <Auth0Provider
      domain="dev-pfxq5f1mprdmtiuk.us.auth0.com"
      clientId="p0ltv0AFCMYykNcihJLcfSwveNUKHVXV"
      authorizationParams={{ 
        redirect_uri: window.location.origin 
      }}
    >
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/medicine-search" element={<MedicineSearch />} />
          <Route path="/create-store" element={<CreateStore />} />
          <Route path="/add-medicine" element={<AddMedicine />} />
          <Route path="/admin-panel" element={<AdminPanel />} />
        </Routes>
      </Router>
    </Auth0Provider>
  );
}

export default App;
