import { body, validationResult } from 'express-validator';

/**
 * Middleware to evaluate express-validator results and return formatted error response.
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed. Please check your inputs.',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

/**
 * Validation rules for user registration.
 */
export const validateSignup = [
  // Common fields
  body('name')
    .trim()
    .notEmpty().withMessage('Full name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email address is required')
    .isEmail().withMessage('Please enter a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),

  body('role')
    .notEmpty().withMessage('Account role is required')
    .isIn(['community_user', 'ngo', 'csr_manager']).withMessage('Role must be community_user, ngo, or csr_manager'),

  body('phone')
    .optional({ checkFalsy: true })
    .trim(),

  // Conditional Community User fields
  body('subType')
    .if(body('role').equals('community_user'))
    .notEmpty().withMessage('Subtype is required for community users')
    .isIn(['student', 'working_professional', 'general_volunteer']).withMessage('Subtype must be student, working_professional, or general_volunteer'),

  // Conditional NGO fields
  body('ngoName')
    .if(body('role').equals('ngo'))
    .trim()
    .notEmpty().withMessage('NGO name is required'),

  body('registrationNumber')
    .if(body('role').equals('ngo'))
    .trim()
    .notEmpty().withMessage('Registration number is required'),

  // Conditional CSR Manager fields
  body('companyName')
    .if(body('role').equals('csr_manager'))
    .trim()
    .notEmpty().withMessage('Company name is required'),

  body('csrManagerName')
    .if(body('role').equals('csr_manager'))
    .trim()
    .notEmpty().withMessage('CSR manager name is required'),

  handleValidationErrors
];

/**
 * Validation rules for login.
 */
export const validateLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required'),

  handleValidationErrors
];

/**
 * Validation rules for forgot-password.
 */
export const validateForgotPassword = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email address')
    .normalizeEmail(),

  handleValidationErrors
];

/**
 * Validation rules for password reset.
 */
export const validateResetPassword = [
  body('password')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),

  handleValidationErrors
];
