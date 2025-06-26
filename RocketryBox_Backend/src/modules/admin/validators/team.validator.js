import { body, param, query } from 'express-validator';

export const teamQueryValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('role').optional().isIn(['Admin', 'Manager', 'Support', 'Agent']).withMessage('Invalid role'),
  query('status').optional().isIn(['Active', 'Inactive', 'On Leave']).withMessage('Invalid status')
];

export const teamIdValidator = [
  param('userId').isMongoId().withMessage('Invalid team member ID')
];

export const updateTeamMemberValidator = [
  ...teamIdValidator,
  body('fullName')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Full name must be between 2 and 50 characters'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address'),
  body('phoneNumber')
    .optional()
    .isLength({ min: 10, max: 15 })
    .withMessage('Phone number must be between 10 and 15 characters'),
  body('role')
    .optional()
    .isIn(['Admin', 'Manager', 'Support', 'Agent'])
    .withMessage('Invalid role'),
  body('status')
    .optional()
    .isIn(['Active', 'Inactive', 'On Leave'])
    .withMessage('Invalid status'),
  body('department')
    .optional()
    .notEmpty()
    .withMessage('Department cannot be empty'),
  body('designation')
    .optional()
    .notEmpty()
    .withMessage('Designation cannot be empty'),
  // Financial & Identity Information
  body('aadharNumber')
    .optional()
    .isLength({ min: 12, max: 12 })
    .isNumeric()
    .withMessage('Aadhar number must be exactly 12 digits'),
  body('panNumber')
    .optional()
    .isLength({ min: 10, max: 10 })
    .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
    .withMessage('PAN number format: ABCDE1234F'),
  body('bankAccountNumber')
    .optional()
    .isLength({ min: 9, max: 18 })
    .isNumeric()
    .withMessage('Bank account number must be between 9 and 18 digits'),
  body('ifscCode')
    .optional()
    .isLength({ min: 11, max: 11 })
    .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/)
    .withMessage('IFSC code format: ABCD0123456'),
  body('bankName')
    .optional()
    .isString()
    .withMessage('Bank name must be a string'),
  body('accountHolderName')
    .optional()
    .isString()
    .withMessage('Account holder name must be a string')
];

export const registerTeamMemberValidator = [
  body('fullName')
    .notEmpty()
    .isLength({ min: 2, max: 50 })
    .withMessage('Full name is required and must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address'),
  body('phoneNumber')
    .notEmpty()
    .isLength({ min: 10, max: 15 })
    .withMessage('Phone number is required and must be between 10 and 15 characters'),
  body('role')
    .isIn(['Admin', 'Manager', 'Support', 'Agent'])
    .withMessage('Invalid role'),
  body('department')
    .notEmpty()
    .withMessage('Department is required'),
  body('address')
    .optional()
    .isString()
    .withMessage('Address must be a string'),
  body('designation')
    .optional()
    .isString()
    .withMessage('Designation must be a string'),
  body('remarks')
    .optional()
    .isString()
    .withMessage('Remarks must be a string'),
  body('dateOfJoining')
    .optional()
    .isISO8601()
    .withMessage('Date of joining must be a valid date'),
  body('sendInvitation')
    .optional()
    .isBoolean()
    .withMessage('Send invitation must be a boolean'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
  // Financial & Identity Information
  body('aadharNumber')
    .optional()
    .isLength({ min: 12, max: 12 })
    .isNumeric()
    .withMessage('Aadhar number must be exactly 12 digits'),
  body('panNumber')
    .optional()
    .isLength({ min: 10, max: 10 })
    .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
    .withMessage('PAN number format: ABCDE1234F'),
  body('bankAccountNumber')
    .optional()
    .isLength({ min: 9, max: 18 })
    .isNumeric()
    .withMessage('Bank account number must be between 9 and 18 digits'),
  body('ifscCode')
    .optional()
    .isLength({ min: 11, max: 11 })
    .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/)
    .withMessage('IFSC code format: ABCD0123456'),
  body('bankName')
    .optional()
    .isString()
    .withMessage('Bank name must be a string'),
  body('accountHolderName')
    .optional()
    .isString()
    .withMessage('Account holder name must be a string'),
  body('isSuperAdmin')
    .optional()
    .isBoolean()
    .withMessage('isSuperAdmin must be a boolean')
];

export const updateStatusValidator = [
  ...teamIdValidator,
  body('status')
    .isIn(['Active', 'Inactive', 'On Leave'])
    .withMessage('Invalid status'),
  body('reason')
    .optional()
    .isString()
    .withMessage('Reason must be a string')
];

export const updatePermissionsValidator = [
  ...teamIdValidator,
  body('permissions')
    .isObject()
    .withMessage('Permissions must be an object'),

  // Core Access
  body('permissions.dashboardAccess').optional().isBoolean().withMessage('dashboardAccess must be boolean'),

  // Navigation Permissions - All Sidebar Items
  body('permissions.usersAccess').optional().isBoolean().withMessage('usersAccess must be boolean'),
  body('permissions.teamsAccess').optional().isBoolean().withMessage('teamsAccess must be boolean'),
  body('permissions.partnersAccess').optional().isBoolean().withMessage('partnersAccess must be boolean'),
  body('permissions.ordersAccess').optional().isBoolean().withMessage('ordersAccess must be boolean'),
  body('permissions.shipmentsAccess').optional().isBoolean().withMessage('shipmentsAccess must be boolean'),
  body('permissions.ticketsAccess').optional().isBoolean().withMessage('ticketsAccess must be boolean'),
  body('permissions.ndrAccess').optional().isBoolean().withMessage('ndrAccess must be boolean'),
  body('permissions.billingAccess').optional().isBoolean().withMessage('billingAccess must be boolean'),
  body('permissions.reportsAccess').optional().isBoolean().withMessage('reportsAccess must be boolean'),
  body('permissions.escalationAccess').optional().isBoolean().withMessage('escalationAccess must be boolean'),
  body('permissions.settingsAccess').optional().isBoolean().withMessage('settingsAccess must be boolean'),

  // Granular Operation Permissions
  body('permissions.userManagement').optional().isBoolean().withMessage('userManagement must be boolean'),
  body('permissions.teamManagement').optional().isBoolean().withMessage('teamManagement must be boolean'),
  body('permissions.ordersShipping').optional().isBoolean().withMessage('ordersShipping must be boolean'),
  body('permissions.financialOperations').optional().isBoolean().withMessage('financialOperations must be boolean'),
  body('permissions.systemConfig').optional().isBoolean().withMessage('systemConfig must be boolean'),
  body('permissions.sellerManagement').optional().isBoolean().withMessage('sellerManagement must be boolean'),
  body('permissions.supportTickets').optional().isBoolean().withMessage('supportTickets must be boolean'),
  body('permissions.reportsAnalytics').optional().isBoolean().withMessage('reportsAnalytics must be boolean'),
  body('permissions.marketingPromotions').optional().isBoolean().withMessage('marketingPromotions must be boolean')
];

export const uploadDocumentValidator = [
  ...teamIdValidator,
  body('type')
    .isIn(['aadharDocument', 'panDocument', 'bankPassbookDocument', 'idProof', 'employmentContract'])
    .withMessage('Invalid document type. Must be one of: aadharDocument, panDocument, bankPassbookDocument, idProof, employmentContract')
];
