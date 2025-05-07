import React from 'react';
import LoginPage from './LoginPage';
import Dashboard from './Dashboard';
import DashboardHome from './DashboardHome';
import ReportsPage from './ReportsPage';
import { Routes, Route } from 'react-router-dom';
import './App.css';
import Settings from './Settings';

function App() {
  return ( 
    <Routes>
      <Route path="/" element={<LoginPage />} />

      <Route path="/dashboard" element={<Dashboard />}>
        <Route index element={<DashboardHome />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;
