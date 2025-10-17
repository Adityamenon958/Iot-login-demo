import React, { useEffect, useState } from 'react';
import LoginPage from './LoginPage';
import HeroSection from './HeroSection';
import FeaturesShowcase from './FeaturesShowcase';
import SocialProofSection from './SocialProofSection';
import PreLoginSubscription from '../../pages/PreLoginSubscription';
import './LoginCarousel.css';

export default function LoginCarousel() {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showPlanNotification, setShowPlanNotification] = useState(false);

  // ✅ Listen for plan selection events
  useEffect(() => {
    const handlePlanSelected = (event) => {
      const { planName } = event.detail;
      setSelectedPlan(planName);
      setShowPlanNotification(true);
      
      // Hide notification after 3 seconds
      setTimeout(() => {
        setShowPlanNotification(false);
      }, 3000);
    };

    window.addEventListener('planSelected', handlePlanSelected);
    
    return () => {
      window.removeEventListener('planSelected', handlePlanSelected);
    };
  }, []);

  return (
    <div className="carousel-wrapper">
      {/* ✅ Plan selection notification */}
      {showPlanNotification && selectedPlan && (
        <div 
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'linear-gradient(135deg, #4db3b3 0%, #3a9a9a 100%)',
            color: 'white',
            padding: '0.75rem 1.5rem',
            borderRadius: '25px',
            boxShadow: '0 8px 25px rgba(77, 179, 179, 0.3)',
            fontSize: '0.9rem',
            fontWeight: '600',
            animation: 'slideDown 0.5s ease-out',
            border: '2px solid rgba(255, 255, 255, 0.2)'
          }}
        >
          🎉 Great choice! You selected the <strong>{selectedPlan}</strong> plan
        </div>
      )}
      
      <div className="carousel-slider">
        <div className="carousel-slide">
          <LoginPage selectedPlan={selectedPlan} />
        </div>
        <div className="carousel-slide">
          <HeroSection />
        </div>
        <div className="carousel-slide">
          <FeaturesShowcase />
        </div>
        <div className="carousel-slide">
          <SocialProofSection />
        </div>
        <div className="carousel-slide">
          <PreLoginSubscription />
        </div>
      </div>
    </div>
  );
}
