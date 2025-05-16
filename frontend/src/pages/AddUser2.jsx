import React from 'react';
import { Navigate } from 'react-router-dom';

const AddUser2 = ({ children }) => {
    const role = localStorage.getItem("role");
  
    if (role !== "admin") {
      return <Navigate to="/dashboard" replace />;
    }
  
    return children;
  };
  
  export default AddUser2;