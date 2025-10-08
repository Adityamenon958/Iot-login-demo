import React from 'react';
import styles from './RegisterBitDisplay.module.css';

const RegisterBitDisplay = ({ registerData, registerName }) => {
  if (!registerData || !registerData.bits) {
    return <div>No data</div>;
  }
  
  // ✅ Display bits as-is (was already correct)
  // Binary string: [0]=bit7, [1]=bit6, ..., [7]=bit0
  // Tooltip: reverse the bit number (7-index) to match the label
  
  return (
    <div className={styles.registerBits}>
      <div className={styles.registerLabel}>{registerName}:</div>
      <div className={styles.bitsContainer}>
        {registerData.bits.map((bit, index) => (
          <div 
            key={index}
            className={`${styles.bitBox} ${bit === '1' ? styles.bitActive : styles.bitInactive}`}
            title={`${registerName} - Bit ${7-index}: ${registerData.labels[7-index]} = ${bit}`}
          >
            {bit}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RegisterBitDisplay;
