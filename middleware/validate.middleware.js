const { validationResult, body, param, query } = require('express-validator');

// Middleware to check validation results
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// Common validation rules
const validations = {
  // Auth validations
  register: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and number'),
    body('accountType')
      .custom((value, { req }) => {
        const accountType = value || req.body.userType || req.body.accountType;
        if (!['personal', 'business'].includes(accountType)) {
          throw new Error('Account type must be personal or business');
        }
        return true;
      }),
    body()
      .custom((_, { req }) => {
        const accountType = req.body.accountType || req.body.userType;
        const fullName = req.body.fullName?.trim();
        const firstName = req.body.firstName?.trim();
        const businessName = (req.body.businessName || req.body.companyName || req.body.company || '').trim();
        const contactName = (req.body.contactName || req.body.fullName || '').trim();

        if (accountType === 'personal' && !fullName && !firstName) {
          throw new Error('Personal sign up requires fullName or firstName');
        }

        if (accountType === 'business' && !businessName) {
          throw new Error('Business sign up requires businessName');
        }

        if (accountType === 'business' && !contactName) {
          throw new Error('Business sign up requires contactName');
        }

        return true;
      })
  ],

  login: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],

  forgotPassword: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required')
  ],

  resetPassword: [
    body('token')
      .notEmpty()
      .withMessage('Reset token is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and number')
  ],

  changePassword: [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('New password must contain uppercase, lowercase, and number')
  ],

  personalProfile: [
    body('firstName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('First name must be 1-100 characters'),
    body('lastName')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Last name must be 100 characters or fewer'),
    body('displayName')
      .optional()
      .trim()
      .isLength({ max: 150 })
      .withMessage('Display name must be 150 characters or fewer'),
    body('headline')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Headline must be 200 characters or fewer'),
    body('bio')
      .optional()
      .isLength({ max: 2000 })
      .withMessage('Bio must be less than 2000 characters'),
    body('website')
      .optional({ values: 'falsy' })
      .isURL()
      .withMessage('Website must be a valid URL')
  ],

  businessProfile: [
    body('businessName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 255 })
      .withMessage('Business name must be 2-255 characters'),
    body('contactName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 200 })
      .withMessage('Contact name must be 2-200 characters'),
    body('businessType')
      .optional()
      .isIn(['startup', 'sme', 'enterprise', 'agency', 'nonprofit', 'other'])
      .withMessage('Invalid business type'),
    body('industry')
      .optional()
      .trim()
      .isLength({ max: 150 })
      .withMessage('Industry must be 150 characters or fewer'),
    body('description')
      .optional()
      .isLength({ max: 3000 })
      .withMessage('Description must be less than 3000 characters'),
    body('website')
      .optional({ values: 'falsy' })
      .isURL()
      .withMessage('Website must be a valid URL')
  ],

  // Creator profile validations
  creatorProfile: [
    body('displayName')
      .optional()
      .isLength({ min: 2, max: 100 })
      .withMessage('Display name must be 2-100 characters'),
    body('bio')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Bio must be less than 1000 characters'),
    body('stateId')
      .optional()
      .isUUID()
      .withMessage('Invalid state ID'),
    body('cityId')
      .optional()
      .isUUID()
      .withMessage('Invalid city ID')
  ],

  // Brand profile validations
  brandProfile: [
    body('companyName')
      .optional()
      .isLength({ min: 2, max: 200 })
      .withMessage('Company name must be 2-200 characters'),
    body('description')
      .optional()
      .isLength({ max: 2000 })
      .withMessage('Description must be less than 2000 characters'),
    body('industryId')
      .optional()
      .isUUID()
      .withMessage('Invalid industry ID'),
    body('website')
      .optional()
      .isURL()
      .withMessage('Invalid website URL')
  ],

  // Rate card validations
  rateCard: [
    body('platform')
      .isIn(['instagram', 'tiktok', 'youtube', 'twitter', 'facebook', 'linkedin', 'blog', 'podcast', 'other'])
      .withMessage('Invalid platform'),
    body('contentType')
      .notEmpty()
      .withMessage('Content type is required'),
    body('priceType')
      .optional()
      .isIn(['fixed', 'range', 'starting_from', 'contact'])
      .withMessage('Invalid price type'),
    body('basePrice')
      .notEmpty()
      .isFloat({ min: 0 })
      .withMessage('Base price is required and must be a positive number'),
    body('maxPrice')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Max price must be a positive number'),
    body('deliveryDays')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Delivery days must be at least 1'),
    body('description')
      .optional()
      .isString()
      .withMessage('Description must be a string')
  ],

  // Portfolio item validations
  portfolioItem: [
    body('title')
      .isLength({ min: 1, max: 200 })
      .withMessage('Title is required and must be less than 200 characters'),
    body('mediaType')
      .isIn(['image', 'video', 'link'])
      .withMessage('Invalid media type'),
    body('mediaUrl')
      .notEmpty()
      .withMessage('Media URL is required'),
    body('description')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Description must be less than 1000 characters'),
    body('brandName')
      .optional()
      .isLength({ max: 255 })
      .withMessage('Brand name must be less than 255 characters'),
    body('platform')
      .optional()
      .isString()
      .withMessage('Platform must be a string')
  ],

  // Collaboration request validations
  collaborationRequest: [
    body('creatorId')
      .isUUID()
      .withMessage('Invalid creator ID'),
    body('campaignTitle')
      .isLength({ min: 5, max: 200 })
      .withMessage('Campaign title must be 5-200 characters'),
    body('campaignBrief')
      .isLength({ min: 20 })
      .withMessage('Campaign brief must be at least 20 characters'),
    body('startDate')
      .isISO8601()
      .withMessage('Invalid start date'),
    body('endDate')
      .isISO8601()
      .withMessage('Invalid end date'),
    body('budgetAmount')
      .isInt({ min: 5000 })
      .withMessage('Budget must be at least 5000 Naira')
  ],

  // Review validations
  review: [
    body('rating')
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5'),
    body('comment')
      .optional()
      .isLength({ max: 2000 })
      .withMessage('Comment must be less than 2000 characters'),
    body('communicationRating')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Communication rating must be between 1 and 5'),
    body('qualityRating')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Quality rating must be between 1 and 5'),
    body('professionalismRating')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Professionalism rating must be between 1 and 5'),
    body('timelinessRating')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Timeliness rating must be between 1 and 5')
  ],

  // Bank account validations
  bankAccount: [
    body('bankCode')
      .notEmpty()
      .withMessage('Bank code is required'),
    body('accountNumber')
      .matches(/^\d{10}$/)
      .withMessage('Account number must be 10 digits'),
    body('accountName')
      .isLength({ min: 2, max: 200 })
      .withMessage('Account name is required')
  ],

  // Payout request validations
  payoutRequest: [
    body('amount')
      .isInt({ min: 5000 })
      .withMessage('Minimum payout amount is 5000 Naira'),
    body('bankAccountId')
      .isUUID()
      .withMessage('Invalid bank account ID')
  ],

  // Message validations
  message: [
    body('content')
      .isLength({ min: 1, max: 5000 })
      .withMessage('Message must be 1-5000 characters')
  ],

  // Search/filter validations
  creatorSearch: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive number'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
    query('minPrice')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Min price must be a positive number'),
    query('maxPrice')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Max price must be a positive number'),
    query('minFollowers')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Min followers must be a positive number'),
    query('maxFollowers')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Max followers must be a positive number'),
    query('minRating')
      .optional()
      .isFloat({ min: 0, max: 5 })
      .withMessage('Min rating must be between 0 and 5')
  ],

  // UUID param validation
  uuidParam: (paramName = 'id') => [
    param(paramName)
      .isUUID()
      .withMessage(`Invalid ${paramName}`)
  ]
};

module.exports = {
  validate,
  validations
};
