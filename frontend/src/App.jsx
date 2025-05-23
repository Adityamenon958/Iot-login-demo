import React from 'react';
import LoginPage from './LoginPage';
import Dashboard from './pages/Dashboard';
import DashboardHome from './pages/DashboardHome';
import ReportsPage from './pages/ReportsPage';
import { Routes, Route } from 'react-router-dom';
import './App.css';
import Settings from './pages/Settings';
import ManageCompany from './pages/ManageCompany';
import AddUser from './pages/ManageCompany';
import AddUserHome from './pages/AddUserHome';
import AddUser2 from './pages/AddUser2';
import DashboardHome2 from './pages/DashboardHome2';
import AddDevice from './pages/AddDevices';



function App() {
  return ( 
    <Routes>
      <Route path="/" element={<LoginPage />} />

      <Route path="/dashboard" element={<Dashboard />}>
        {/* <Route index element={<DashboardHome />} /> */}
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
          path='/dashboard/adduser'
          element={
            <AddUser2>
              <AddUserHome />
            </AddUser2>
          }
          />

      <Route path="adddevice" element={<AddDevice />} />


      </Route>
    </Routes>
  );
}

export default App;
