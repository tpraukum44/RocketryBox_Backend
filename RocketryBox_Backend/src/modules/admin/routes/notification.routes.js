import express from 'express';
import {
  getEmailConfig,
  updateEmailConfig,
  getSMSConfig,
  updateSMSConfig,
  getNotificationSystemConfig,
  updateNotificationSystemConfig,
  sendTestEmail,
  sendTestSMS,
  listEmailTemplates,
  getEmailTemplateById,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  listSMSTemplates,
  getSMSTemplateById,
  createSMSTemplate,
  updateSMSTemplate,
  deleteSMSTemplate
} from '../controllers/notification.controller.js';
import {
  validateEmailConfig,
  validateSMSConfig,
  validateNotificationSystemConfig,
  validateSendTestEmail,
  validateSendTestSMS,
  validateEmailTemplate,
  validateSMSTemplate,
  validateTemplateId
} from '../validators/notification.validator.js';
import { protect } from '../../../middleware/auth.js';
import { checkPermission } from '../../../middleware/permission.js';

const router = express.Router();

// Email configuration routes
router.get(
  '/email',
  protect,
  checkPermission('settings'),
  getEmailConfig
);

router.put(
  '/email',
  protect,
  checkPermission('settings'),
  validateEmailConfig,
  updateEmailConfig
);

router.post(
  '/email/test',
  protect,
  checkPermission('settings'),
  validateSendTestEmail,
  sendTestEmail
);

// SMS configuration routes
router.get(
  '/sms',
  protect,
  checkPermission('settings'),
  getSMSConfig
);

router.put(
  '/sms',
  protect,
  checkPermission('settings'),
  validateSMSConfig,
  updateSMSConfig
);

router.post(
  '/sms/test',
  protect,
  checkPermission('settings'),
  validateSendTestSMS,
  sendTestSMS
);

// System notification configuration routes
router.get(
  '/system',
  protect,
  checkPermission('settings'),
  getNotificationSystemConfig
);

router.put(
  '/system',
  protect,
  checkPermission('settings'),
  validateNotificationSystemConfig,
  updateNotificationSystemConfig
);

// Email template routes
router.get(
  '/email-templates',
  protect,
  checkPermission('settings'),
  listEmailTemplates
);

router.get(
  '/email-templates/:id',
  protect,
  checkPermission('settings'),
  validateTemplateId,
  getEmailTemplateById
);

router.post(
  '/email-templates',
  protect,
  checkPermission('settings'),
  validateEmailTemplate,
  createEmailTemplate
);

router.put(
  '/email-templates/:id',
  protect,
  checkPermission('settings'),
  validateTemplateId,
  validateEmailTemplate,
  updateEmailTemplate
);

router.delete(
  '/email-templates/:id',
  protect,
  checkPermission('settings'),
  validateTemplateId,
  deleteEmailTemplate
);

// SMS template routes
router.get(
  '/sms-templates',
  protect,
  checkPermission('settings'),
  listSMSTemplates
);

router.get(
  '/sms-templates/:id',
  protect,
  checkPermission('settings'),
  validateTemplateId,
  getSMSTemplateById
);

router.post(
  '/sms-templates',
  protect,
  checkPermission('settings'),
  validateSMSTemplate,
  createSMSTemplate
);

router.put(
  '/sms-templates/:id',
  protect,
  checkPermission('settings'),
  validateTemplateId,
  validateSMSTemplate,
  updateSMSTemplate
);

router.delete(
  '/sms-templates/:id',
  protect,
  checkPermission('settings'),
  validateTemplateId,
  deleteSMSTemplate
);

export default router; 