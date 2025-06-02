import React, { useState, useEffect } from 'react';
import LoginPage from '../LoginPage';
import PreLoginSubscription from '../../src/pages/PreLoginSubscription';
import './LoginCarousel.css'; // Optional: for dot styles

export default function LoginCarousel() {
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    const intervalDuration = currentPage === 0 ? 8000 : 3000; // 8s on login, 3s on subscription
  
    const interval = setInterval(() => {
      setCurrentPage((prevPage) => (prevPage === 0 ? 1 : 0));
    }, intervalDuration);
  
    return () => clearInterval(interval); // Clear old timer before setting new one
  }, [currentPage]); // 👈 Add dependency so it re-runs on page change
  

  return (
    <div className="carousel-wrapper">
      <div
        className="carousel-slider"
        style={{ transform: `translateX(-${currentPage * 100}vw)` }}
      >
        <div className="carousel-slide">
          <LoginPage />
        </div>
        <div className="carousel-slide">
          <PreLoginSubscription />
        </div>
      </div>

      <div className="dot-pagination">
        <span
          className={`dot ${currentPage === 0 ? 'active' : ''}`}
          onClick={() => setCurrentPage(0)}
        ></span>
        <span
          className={`dot ${currentPage === 1 ? 'active' : ''}`}
          onClick={() => setCurrentPage(1)}
        ></span>
      </div>
    </div>
  );
}
