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
  logger: true,
  debug: true,
});
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS:', process.env.EMAIL_PASS);

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