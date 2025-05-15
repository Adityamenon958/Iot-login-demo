import React from 'react';
import LoginPage from './LoginPage';
import Dashboard from './pages/Dashboard';
import DashboardHome from './pages/DashboardHome';
import ReportsPage from './pages/ReportsPage';
import { Routes, Route } from 'react-router-dom';
import './App.css';
import Settings from './pages/Settings';
import AddUserHome from './pages/AddUserHome';
import AddUser from './pages/AddUserHome';

function App() {
  return ( 
    <Routes>
      <Route path="/" element={<LoginPage />} />

      <Route path="/dashboard" element={<Dashboard />}>
        <Route index element={<DashboardHome />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<Settings />} />
        
        <Route
        path="/dashboard/adduser"
        element={
          <AddUser>
            <AddUserHome />
          </AddUser>
          }
          />
      </Route>
    </Routes>
  );
}

export default App;
