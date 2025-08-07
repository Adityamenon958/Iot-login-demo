import React, { useEffect, useState } from 'react';
import { Routes, Route,Navigate } from 'react-router-dom';
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
import RouteGuard from './components/RouteGuard';
import './App.css';
import DynamicDb from './components/DynamicDb';
import CraneDashboard from './pages/CraneDashboard';
import CraneOverview from './pages/CraneOverview';
import ElevatorOverview from './pages/ElevatorOverview';

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
        {/* <Route path="dynamicdb" element={<DynamicDb />} /> */}
        <Route path="device" element={<Navigate to="GS-1234" replace />} />
        <Route path="device/:deviceId" element={<DynamicDb />} />
        <Route path="crane" element={<CraneDashboard />} />
        
        {/* ✅ Protected Routes with Access Control */}
        <Route path="crane-overview" element={
          <RouteGuard requiredAccess="craneOverview">
            <CraneOverview />
          </RouteGuard>
        } />
        
        <Route path="elevator-overview" element={
          <RouteGuard requiredAccess="elevatorOverview">
            <ElevatorOverview />
          </RouteGuard>
        } />
        
        <Route path="reports" element={
          <RouteGuard requiredAccess="reports">
            <ReportsPage />
          </RouteGuard>
        } />
        
        <Route path="settings" element={
          <RouteGuard requiredAccess="settings">
            <Settings />
          </RouteGuard>
        } />
        
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
            <RouteGuard requiredAccess="addUsers">
            <AddUser2>
              <AddUserHome />
            </AddUser2>
            </RouteGuard>
          }
        />
        
        <Route path="adddevice" element={
          <RouteGuard requiredAccess="addDevices">
            <AddDevice />
          </RouteGuard>
        } />
        
        <Route path="subscription" element={
          <RouteGuard requiredAccess="subscription">
            <Subscription />
          </RouteGuard>
        } />
      </Route>
    </Routes>
  );
}

export default App;
