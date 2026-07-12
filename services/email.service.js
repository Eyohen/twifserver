// services/email.service.js - Email service using Resend
const { Resend } = require('resend');
const fs = require('fs').promises;
const path = require('path');

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);
const appName = process.env.APP_NAME || 'Twif';

// Load and process email template
const loadTemplate = async (templateName, variables = {}) => {
  try {
    const templatePath = path.join(__dirname, '..', 'templates', 'emails', `${templateName}.html`);
    let template = await fs.readFile(templatePath, 'utf8');

    // Replace template variables
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      template = template.replace(regex, variables[key] || '');
    });

    return template;
  } catch (error) {
    console.error(`Error loading template ${templateName}:`, error);
    throw new Error(`Template ${templateName} not found`);
  }
};

// Get base template variables
const getBaseVariables = () => ({
  appName,
  appTagline: 'Connect with purpose. Grow through opportunity.',
  currentYear: new Date().getFullYear(),
  supportUrl: `${process.env.FRONTEND_URL || process.env.CLIENT_URL}/support`,
  privacyUrl: `${process.env.FRONTEND_URL || process.env.CLIENT_URL}/privacy`,
  termsUrl: `${process.env.FRONTEND_URL || process.env.CLIENT_URL}/terms`,
  frontendUrl: process.env.FRONTEND_URL || process.env.CLIENT_URL
});

// Send email using Resend
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const result = await resend.emails.send({
      from: `${appName} <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`,
      to,
      subject,
      html,
      text
    });

    console.log('📧 Resend API Response:', JSON.stringify(result, null, 2));

    if (result.error) {
      console.error('❌ Resend returned an error:', result.error);
      return { success: false, error: result.error.message };
    }

    console.log('✅ Email sent successfully to:', to);
    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    console.error('Error details:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
};

// Send email verification link
const sendVerificationEmail = async (email, verificationToken) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL;
    const templateVariables = {
      ...getBaseVariables(),
      verificationUrl: `${frontendUrl}/verify-email?token=${verificationToken}`
    };

    const htmlContent = await loadTemplate('email-verification', templateVariables);

    const result = await sendEmail({
      to: email,
      subject: `Verify Your Email - ${appName}`,
      html: htmlContent,
      text: `Welcome to ${appName}! Please verify your email by visiting: ${templateVariables.verificationUrl}`
    });

    return result.success;
  } catch (error) {
    console.error('❌ Error sending verification email:', error);
    return false;
  }
};

// Send welcome email after verification
const sendWelcomeEmail = async (email, userDetails = {}) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL;
    const templateVariables = {
      ...getBaseVariables(),
      firstName: userDetails.firstName || 'there',
      userName: userDetails.firstName ? `${userDetails.firstName} ${userDetails.lastName || ''}`.trim() : 'there',
      loginUrl: `${frontendUrl}/login`,
      dashboardUrl: `${frontendUrl}/dashboard`,
      exploreUrl: `${frontendUrl}/explore`
    };

    const htmlContent = await loadTemplate('welcome-email', templateVariables);

    const result = await sendEmail({
      to: email,
      subject: `Welcome to ${appName}!`,
      html: htmlContent,
      text: `Welcome to ${appName}! We're excited to have you on board. Start exploring at ${frontendUrl}`
    });

    return result.success;
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    return false;
  }
};

// Send password reset email
const sendPasswordResetEmail = async (email, resetToken) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL;
    const templateVariables = {
      ...getBaseVariables(),
      resetUrl: `${frontendUrl}/reset-password?token=${resetToken}`
    };

    const htmlContent = await loadTemplate('password-reset', templateVariables);

    const result = await sendEmail({
      to: email,
      subject: `Reset Your Password - ${appName}`,
      html: htmlContent,
      text: `Reset your ${appName} password by visiting: ${templateVariables.resetUrl}. This link expires in 1 hour.`
    });

    return result.success;
  } catch (error) {
    console.error('❌ Error sending password reset email:', error);
    return false;
  }
};

// Send password changed confirmation email
const sendPasswordChangedEmail = async (email) => {
  try {
    const templateVariables = {
      ...getBaseVariables()
    };

    const htmlContent = await loadTemplate('password-changed', templateVariables);

    const result = await sendEmail({
      to: email,
      subject: `Your Password Was Changed - ${appName}`,
      html: htmlContent,
      text: `Your ${appName} password was successfully changed. If you did not make this change, please contact support immediately.`
    });

    return result.success;
  } catch (error) {
    console.error('❌ Error sending password changed email:', error);
    return false;
  }
};

const sendNotificationEmail = async (email, data) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
    const actionUrl = data.actionUrl?.startsWith('http')
      ? data.actionUrl
      : `${frontendUrl}${data.actionUrl || '/dashboard'}`;
    const templateVariables = {
      ...getBaseVariables(),
      title: data.title || 'New Twif notification',
      message: data.message || 'You have a new update on Twif.',
      actionUrl,
      ctaLabel: data.ctaLabel || 'Open Twif'
    };

    const htmlContent = await loadTemplate('notification', templateVariables);

    const result = await sendEmail({
      to: email,
      subject: data.subject || `${templateVariables.title} - ${appName}`,
      html: htmlContent,
      text: `${templateVariables.title}\n\n${templateVariables.message}\n\nOpen: ${actionUrl}`
    });

    return result.success;
  } catch (error) {
    console.error('❌ Error sending notification email:', error);
    return false;
  }
};

// Send new collaboration request email
const sendNewRequestEmail = async (email, data) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL;
    const templateVariables = {
      ...getBaseVariables(),
      brandName: data.brandName,
      campaignTitle: data.campaignTitle,
      campaignBrief: data.campaignBrief?.substring(0, 200) || '',
      budget: data.budget?.toLocaleString() || '0',
      requestUrl: `${frontendUrl}/creator/requests/${data.requestId}`
    };

    const htmlContent = await loadTemplate('new-request', templateVariables);

    const result = await sendEmail({
      to: email,
      subject: `New Collaboration Request: ${data.campaignTitle}`,
      html: htmlContent,
      text: `New collaboration request from ${data.brandName}: ${data.campaignTitle}`
    });

    return result.success;
  } catch (error) {
    console.error('❌ Error sending new request email:', error);
    return false;
  }
};

// Send request accepted email
const sendRequestAcceptedEmail = async (email, data) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL;
    const templateVariables = {
      ...getBaseVariables(),
      creatorName: data.creatorName,
      campaignTitle: data.campaignTitle,
      requestUrl: `${frontendUrl}/brand/requests/${data.requestId}`
    };

    const htmlContent = await loadTemplate('request-accepted', templateVariables);

    const result = await sendEmail({
      to: email,
      subject: `Your Request Was Accepted: ${data.campaignTitle}`,
      html: htmlContent,
      text: `${data.creatorName} accepted your collaboration request: ${data.campaignTitle}`
    });

    return result.success;
  } catch (error) {
    console.error('❌ Error sending request accepted email:', error);
    return false;
  }
};

// Send payment received email
const sendPaymentReceivedEmail = async (email, data) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL;
    const templateVariables = {
      ...getBaseVariables(),
      amount: data.amount?.toLocaleString() || '0',
      campaignTitle: data.campaignTitle,
      earningsUrl: `${frontendUrl}/creator/earnings`
    };

    const htmlContent = await loadTemplate('payment-received', templateVariables);

    const result = await sendEmail({
      to: email,
      subject: `Payment Received: ₦${data.amount?.toLocaleString()}`,
      html: htmlContent,
      text: `You received ₦${data.amount?.toLocaleString()} for ${data.campaignTitle}`
    });

    return result.success;
  } catch (error) {
    console.error('❌ Error sending payment received email:', error);
    return false;
  }
};

// Test email configuration
const testEmailConnection = async () => {
  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not set');
    }
    console.log('✅ Resend email service configured');
    return { success: true };
  } catch (error) {
    console.error('❌ Email service configuration failed:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendNotificationEmail,
  sendNewRequestEmail,
  sendRequestAcceptedEmail,
  sendPaymentReceivedEmail,
  testEmailConnection
};
