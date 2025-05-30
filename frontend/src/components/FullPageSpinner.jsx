// src/components/FullPageSpinner.jsx
import React from 'react';
import Spinner from 'react-bootstrap/Spinner';
import './FullPageSpinner.css'; // for full-page overlay styling

const FullPageSpinner = () => {
  return (
    <div className="spinner-overlay1">
      <Spinner animation="border" role="status" variant="primary" />
    </div>
  );
};

export default FullPageSpinner;
