// ✅ User utility functions

/**
 * Generate company initials from company name
 * @param {string} companyName - The company name
 * @returns {string} - Company initials (max 3 characters)
 */
export const generateCompanyInitials = (companyName) => {
  if (!companyName || typeof companyName !== 'string') {
    return 'U'; // Default: User
  }
  
  const trimmedName = companyName.trim();
  if (trimmedName.length === 0) return 'U';
  
  const words = trimmedName.split(' ').filter(word => word.length > 0);
  
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }
  
  // Take first letter of each word, max 3 characters
  return words
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 3);
};

/**
 * Get user display name (fallback to email if no name)
 * @param {object} user - User object
 * @returns {string} - Display name
 */
export const getUserDisplayName = (user) => {
  if (user?.name && user.name.trim()) {
    return user.name.trim();
  }
  if (user?.email) {
    return user.email.split('@')[0]; // Username part of email
  }
  return 'User';
};

/**
 * Get user role display name
 * @param {string} role - User role
 * @returns {string} - Formatted role name
 */
export const getUserRoleDisplay = (role) => {
  if (!role) return 'User';
  
  const roleMap = {
    'superadmin': 'Super Admin',
    'admin': 'Administrator',
    'user': 'User'
  };
  
  return roleMap[role] || role.charAt(0).toUpperCase() + role.slice(1);
}; 