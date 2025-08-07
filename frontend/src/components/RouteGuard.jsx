import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Spinner, Alert } from 'react-bootstrap';
import axios from 'axios';

export default function RouteGuard({ children, requiredAccess }) {
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    checkAccess();
  }, [requiredAccess]);

  const checkAccess = async () => {
    try {
      setLoading(true);
      setError('');

      // Get user info
      const userResponse = await axios.get('/api/auth/userinfo', {
        withCredentials: true
      });

      const { role } = userResponse.data;
      setUserRole(role);

      // Superadmin has access to everything
      if (role === 'superadmin') {
        setHasAccess(true);
        setLoading(false);
        return;
      }

      // Check specific dashboard access
      const accessResponse = await axios.get(`/api/check-dashboard-access/${requiredAccess}`, {
        withCredentials: true
      });

      setHasAccess(accessResponse.data.hasAccess);
      
      if (!accessResponse.data.hasAccess) {
        setError(`Access denied. You don't have permission to access this page.`);
      }

    } catch (err) {
      console.error('❌ Route guard error:', err);
      setError('Failed to verify access permissions.');
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '50vh' }}>
        <div className="text-center">
          <Spinner animation="border" />
          <p className="mt-2">Checking access permissions...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '50vh' }}>
        <div className="text-center">
          <Alert variant="danger">
            <h5>🚫 Access Denied</h5>
            <p>{error || 'You do not have permission to access this page.'}</p>
            <p>Current role: <strong>{userRole}</strong></p>
            <p>Required access: <strong>{requiredAccess}</strong></p>
          </Alert>
        </div>
      </div>
    );
  }

  return children;
} 