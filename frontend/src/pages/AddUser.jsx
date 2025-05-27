
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';

const AddUser = ({ children }) => {
  const [isAuthorized, setIsAuthorized] = useState(null); // null = loading

  useEffect(() => {

    const checkRole = async () => {
      try {
        const res = await axios.get('/api/auth/userinfo', { withCredentials: true });
        const { role } = res.data;
        setIsAuthorized(role === "superadmin");
      } catch (err) {
        setIsAuthorized(false);
      }
    };

    checkRole();
  }, []);

  if (isAuthorized === null) return null; // or a loader

  return isAuthorized ? children : <Navigate to="/dashboard" replace />;
};

export default AddUser;
