import { PARENT_RULES, TASK_TYPES } from './constants';

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password) => {
  return password.length >= 6;
};

export const validateUsername = (username) => {
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
};

export const validateTaskName = (name) => {
  return name && name.trim().length > 0;
};

export const validateHierarchy = (childType, parentType) => {
  if (parentType === 'life_goal') {
    return { isValid: true };
  }

  const allowedParents = PARENT_RULES[childType];
  const isValid = allowedParents.includes(parentType);

  return {
    isValid,
    message: isValid
      ? ''
      : `A ${childType} task can only have ${allowedParents.join(' or ')} tasks as parent`,
  };
};

export const formatDate = (date) => {
  if (!date) return '';

  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

