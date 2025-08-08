import React, { useState, useEffect } from 'react';

// ✅ Component for smooth value transitions
export const SmoothValueTransition = ({ 
  value, 
  formatFunction = (val) => val,
  className = '',
  style = {}
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (value !== displayValue) {
      setIsTransitioning(true);
      
      // Smooth transition with CSS animation
      const timer = setTimeout(() => {
        setDisplayValue(value);
        setIsTransitioning(false);
      }, 150); // Small delay for smooth transition

      return () => clearTimeout(timer);
    }
  }, [value, displayValue]);

  return (
    <span 
      className={`${className} ${isTransitioning ? 'value-transition' : ''}`}
      style={{
        ...style,
        transition: isTransitioning ? 'opacity 0.15s ease-in-out' : 'none',
        opacity: isTransitioning ? 0.7 : 1
      }}
    >
      {formatFunction(displayValue)}
    </span>
  );
};

// ✅ Component for smooth number transitions
export const SmoothNumberTransition = ({ 
  value, 
  className = '',
  style = {}
}) => {
  return (
    <SmoothValueTransition
      value={value}
      formatFunction={(val) => val.toString()}
      className={className}
      style={style}
    />
  );
};

// ✅ Component for smooth time format transitions
export const SmoothTimeTransition = ({ 
  value, 
  formatFunction,
  className = '',
  style = {}
}) => {
  return (
    <SmoothValueTransition
      value={value}
      formatFunction={formatFunction}
      className={className}
      style={style}
    />
  );
}; 