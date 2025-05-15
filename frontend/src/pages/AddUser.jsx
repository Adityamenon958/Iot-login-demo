import React from 'react';
import { Navigate } from 'react-router-dom';

const AddUser = ({ children }) => {
    const role = localStorage.getItem("role");
  
    if (role !== "superadmin") {
      return <Navigate to="/dashboard" replace />;
    }
  
    return children;
  };
  
  export default AddUser;