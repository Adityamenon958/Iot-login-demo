import React, { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import LoginPage from './LoginPage';
import Dashboard from './pages/Dashboard';
import ReportsPage from './pages/ReportsPage';
import Settings from './pages/Settings';
import ManageCompany from './pages/ManageCompany';
import AddUser from './pages/ManageCompany';
import AddUserHome from './pages/AddUserHome';
import AddUser2 from './pages/AddUser2';
import DashboardHome2 from './pages/DashboardHome2';
import AddDevice from './pages/AddDevices';
import Subscription from './pages/Subscription';
import FullPageSpinner from './components/FullPageSpinner';
import LoginCarousel from './components/LoginCarousel';
import './App.css';

function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading delay — replace this with token check or API call later
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) {
    return <FullPageSpinner />;
  }

  return (
    <Routes>
      <Route path="/" element={<LoginCarousel />} />


      <Route path="/dashboard" element={<Dashboard />}>
        <Route index element={<DashboardHome2 />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<Settings />} />
        <Route
          path="/dashboard/managecompany"
          element={
            <AddUser>
              <ManageCompany />
            </AddUser>
          }
        />
        <Route
          path="/dashboard/adduser"
          element={
            <AddUser2>
              <AddUserHome />
            </AddUser2>
          }
        />
        <Route path="adddevice" element={<AddDevice />} />
        <Route path="subscription" element={<Subscription />} />
      </Route>
    </Routes>
  );
}

export default App;
