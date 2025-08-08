import React from 'react';
import LoginPage from '../LoginPage';
import PreLoginSubscription from '../../src/pages/PreLoginSubscription';
import './LoginCarousel.css';

export default function LoginCarousel() {
  return (
    <div className="carousel-wrapper">
      <div className="carousel-slider">
        <div className="carousel-slide">
          <LoginPage />
        </div>
        <div className="carousel-slide">
          <PreLoginSubscription />
        </div>
      </div>
    </div>
  );
}
