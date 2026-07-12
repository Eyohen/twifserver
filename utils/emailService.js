// utils/emailService.js - Email service facade (backward compatibility layer)
// This file delegates to the main email service in services/email.service.js

const emailService = require('../services/email.service');

// Log notice on first import
console.log('📧 Email service loaded (using Resend)');

/**
 * Send email verification link
 * @param {string} email - User's email address
 * @param {string} verificationToken - The token for email verification
 * @returns {Promise<boolean>} - Whether the email was successfully sent
 */
const sendVerificationEmail = async (email, verificationToken) => {
  return emailService.sendVerificationEmail(email, verificationToken);
};

/**
 * Send a welcome email after successful verification
 * @param {string} email - User's email address
 * @param {Object} userDetails - User details (firstName, lastName, etc.)
 * @returns {Promise<boolean>} - Whether the email was successfully sent
 */
const sendWelcomeEmail = async (email, userDetails = {}) => {
  return emailService.sendWelcomeEmail(email, userDetails);
};

/**
 * Send a password reset email
 * @param {string} email - User's email address
 * @param {string} resetToken - Token for password reset
 * @returns {Promise<boolean>} - Whether the email was successfully sent
 */
const sendResetPasswordEmail = async (email, resetToken) => {
  return emailService.sendPasswordResetEmail(email, resetToken);
};

/**
 * Send password changed confirmation email
 * @param {string} email - User's email address
 * @returns {Promise<boolean>} - Whether the email was successfully sent
 */
const sendPasswordChangedEmail = async (email) => {
  return emailService.sendPasswordChangedEmail(email);
};

/**
 * Send new collaboration request email
 * @param {string} email - User's email address
 * @param {Object} data - Request details
 * @returns {Promise<boolean>} - Whether the email was successfully sent
 */
const sendNewRequestEmail = async (email, data) => {
  return emailService.sendNewRequestEmail(email, data);
};

/**
 * Send request accepted email
 * @param {string} email - User's email address
 * @param {Object} data - Request details
 * @returns {Promise<boolean>} - Whether the email was successfully sent
 */
const sendRequestAcceptedEmail = async (email, data) => {
  return emailService.sendRequestAcceptedEmail(email, data);
};

/**
 * Send payment received email
 * @param {string} email - User's email address
 * @param {Object} data - Payment details
 * @returns {Promise<boolean>} - Whether the email was successfully sent
 */
const sendPaymentReceivedEmail = async (email, data) => {
  return emailService.sendPaymentReceivedEmail(email, data);
};

/**
 * Test email configuration
 * @returns {Promise<Object>} - Configuration status
 */
const testEmailConnection = async () => {
  return emailService.testEmailConnection();
};

module.exports = {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendResetPasswordEmail,
  sendPasswordChangedEmail,
  sendNewRequestEmail,
  sendRequestAcceptedEmail,
  sendPaymentReceivedEmail,
  testEmailConnection
};
