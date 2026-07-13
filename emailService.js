import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

// Create reusable transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  logger: process.env.SMTP_DEBUG === 'true',
  debug: process.env.SMTP_DEBUG === 'true',
});

// Main send function
export async function send2FACode(email, code) {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Your Teachers Lounge 2FA Code",
    text: `Your 2-factor authentication code is: ${code}`,
    html: `<b>Your 2-factor authentication code is: ${code}</b>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`2FA email sent to ${email}: ${info.response}`);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
} 

export async function sendSignupVerificationCode(email, code) {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Your Teachers Lounge Signup Verification Code",
    text: `Your signup verification code is: ${code}`,
    html: `<b>Your signup verification code is: ${code}</b>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Signup verification email sent to ${email}: ${info.response}`);
  } catch (error) {
    console.error("Error sending signup verification email:", error);
    throw error;
  }
}

export async function sendPasswordResetEmail(email, resetUrl) {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Your Teachers Lounge Password Reset Link",
    text: `Use this link to reset your password: ${resetUrl}`,
    html: `<p>Use this link to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${email}: ${info.response}`);
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw error;
  }
}

export async function sendPasswordResetCodeEmail(email, code, resetUrl) {
  const linkText = resetUrl
    ? `<p>If your email app supports links, you can also open: <a href="${resetUrl}">${resetUrl}</a></p>`
    : "";

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Your Teachers Lounge Password Reset Code",
    text: `Your password reset code is: ${code}. This code expires shortly.`,
    html: `<p>Your password reset code is:</p><h2>${code}</h2><p>This code expires shortly.</p>${linkText}`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Password reset code email sent to ${email}: ${info.response}`);
  } catch (error) {
    console.error("Error sending password reset code email:", error);
    throw error;
  }
}