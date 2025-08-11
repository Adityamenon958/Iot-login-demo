// ✅ Email validation utilities
export const validateEmail = (email) => {
  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!email) return { isValid: false, message: 'Email is required' };
  if (!emailRegex.test(email)) return { isValid: false, message: 'Please enter a valid email address' };
  
  // Check for common disposable email domains
  const disposableDomains = [
    'tempmail.org', '10minutemail.com', 'guerrillamail.com', 
    'mailinator.com', 'yopmail.com', 'temp-mail.org'
  ];
  
  const domain = email.split('@')[1]?.toLowerCase();
  if (disposableDomains.includes(domain)) {
    return { isValid: false, message: 'Please use a valid email address' };
  }
  
  return { isValid: true, message: 'Valid email format' };
};

// ✅ Password validation utilities
export const validatePassword = (password) => {
  if (!password) {
    return {
      isValid: false,
      strength: 'weak',
      requirements: {
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        symbol: false,
        notCommon: false
      },
      message: 'Password is required'
    };
  }

  // Common weak passwords to avoid
  const commonPasswords = [
    'password', 'password123', '123456', '12345678', 'qwerty',
    'abc123', 'password1', 'admin', 'letmein', 'welcome'
  ];

  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    symbol: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    notCommon: !commonPasswords.includes(password.toLowerCase())
  };

  // Count met requirements
  const metRequirements = Object.values(requirements).filter(Boolean).length;
  
  // Determine strength
  let strength = 'weak';
  let isValid = false;
  
  if (metRequirements >= 5 && requirements.length) {
    strength = 'excellent';
    isValid = true;
  } else if (metRequirements >= 4 && requirements.length) {
    strength = 'strong';
    isValid = true;
  } else if (metRequirements >= 3 && requirements.length) {
    strength = 'medium';
    isValid = true;
  } else {
    strength = 'weak';
    isValid = false;
  }

  return {
    isValid,
    strength,
    requirements,
    message: isValid ? 'Password meets requirements' : 'Password does not meet requirements'
  };
};

// ✅ Get strength color for UI
export const getStrengthColor = (strength) => {
  switch (strength) {
    case 'excellent': return '#28a745'; // Green
    case 'strong': return '#17a2b8';   // Blue
    case 'medium': return '#ffc107';   // Yellow
    case 'weak': return '#dc3545';     // Red
    default: return '#6c757d';         // Gray
  }
};

// ✅ Get strength text for UI
export const getStrengthText = (strength) => {
  switch (strength) {
    case 'excellent': return 'Excellent';
    case 'strong': return 'Strong';
    case 'medium': return 'Medium';
    case 'weak': return 'Weak';
    default: return 'Very Weak';
  }
};

// ✅ Get requirement icon
export const getRequirementIcon = (met) => {
  return met ? '✅' : '❌';
};

// ✅ Get requirement color
export const getRequirementColor = (met) => {
  return met ? '#28a745' : '#dc3545';
}; 