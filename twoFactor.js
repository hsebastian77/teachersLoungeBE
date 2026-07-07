import express from 'express';
import { send2FACode } from './emailService.js'; 
import { generateToken, verifyToken } from './utils/tokenGenerator.js';
import pool from './database.js';

const router = express.Router();
const codeStorage = new Map();
const OTP_EXPIRY_MS = 5 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

const getPreAuthPayload = (req) => {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  const bodyToken = req.body?.mfaToken || req.body?.preAuthToken;
  const token = bearerToken || bodyToken;

  if (!token) {
    return { error: 'Pre-auth token is required' };
  }

  try {
    const decoded = verifyToken(token);
    if (decoded.tokenType !== 'preauth') {
      return { error: 'Invalid token type for MFA challenge' };
    }
    return { decoded };
  } catch (error) {
    return { error: 'Invalid or expired pre-auth token' };
  }
};

const sendOtpHandler = async (req, res) => {
  const { decoded, error } = getPreAuthPayload(req);
  if (error) {
    return res.status(401).json({ success: false, message: error });
  }

  const tokenEmail = decoded.email?.trim().toLowerCase();
  const tokenChallengeId = decoded.challengeId;
  const requestedEmail = req.body?.email?.trim().toLowerCase();

  if (requestedEmail && requestedEmail !== tokenEmail) {
    return res.status(400).json({ success: false, message: 'Email does not match MFA challenge' });
  }

  if (!tokenChallengeId) {
    return res.status(400).json({ success: false, message: 'Invalid MFA challenge' });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  codeStorage.set(tokenChallengeId, {
    email: tokenEmail,
    code,
    attempts: 0,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
  });

  try {
    await send2FACode(tokenEmail, code);
    console.log(`Sent OTP code for challenge ${tokenChallengeId} to ${tokenEmail}`);
    return res.status(200).json({ success: true, message: 'OTP sent', expiresInSeconds: OTP_EXPIRY_MS / 1000 });
  } catch (err) {
    console.error('Error sending OTP:', err);
    return res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
};

const verifyOtpHandler = async (req, res) => {
  const { decoded, error } = getPreAuthPayload(req);
  if (error) {
    return res.status(401).json({ success: false, message: error });
  }

  const submittedOtp = req.body?.otp?.toString().trim() || req.body?.code?.toString().trim();
  if (!submittedOtp) {
    return res.status(400).json({ success: false, message: 'OTP code is required' });
  }

  const tokenEmail = decoded.email?.trim().toLowerCase();
  const tokenChallengeId = decoded.challengeId;
  const challengeEntry = codeStorage.get(tokenChallengeId);

  if (!challengeEntry || challengeEntry.email !== tokenEmail) {
    return res.status(400).json({ success: false, message: 'No active OTP challenge found' });
  }

  if (challengeEntry.expiresAt <= Date.now()) {
    codeStorage.delete(tokenChallengeId);
    return res.status(401).json({ success: false, message: 'OTP has expired' });
  }

  if (challengeEntry.attempts >= MAX_VERIFY_ATTEMPTS) {
    codeStorage.delete(tokenChallengeId);
    return res.status(429).json({ success: false, message: 'Too many invalid OTP attempts' });
  }

  if (challengeEntry.code !== submittedOtp) {
    challengeEntry.attempts += 1;
    codeStorage.set(tokenChallengeId, challengeEntry);
    return res.status(401).json({ success: false, message: 'Invalid OTP' });
  }

  codeStorage.delete(tokenChallengeId);

  try {
    const userResult = await pool.query(
      `
      SELECT 
        U.email,
        U.username,
        U.firstname,
        U.lastname,
        U.color,
        U.role,
        U.profilepiclink,
        S.schoolname AS schoolname
      FROM USERS AS U
      INNER JOIN SCHOOL AS S ON U.schoolid = S.schoolid
      WHERE LOWER(TRIM(U.email)) = $1
      `,
      [tokenEmail]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = userResult.rows[0];
    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      token,
      requires2FA: false,
      user: {
        Email: user.email,
        Username: user.username,
        FirstName: user.firstname,
        LastName: user.lastname,
        SchoolName: user.schoolname,
        Role: user.role,
        color: user.color,
        ProfilePicLink: user.profilepiclink,
      },
    });
  } catch (err) {
    console.error('Error finalizing MFA login:', err);
    return res.status(500).json({ success: false, message: 'Failed to finalize login after OTP verification' });
  }
};

router.post('/send-2fa-code', sendOtpHandler);
router.post('/verify-2fa', verifyOtpHandler);
router.post('/send-otp', sendOtpHandler);
router.post('/verify-otp', verifyOtpHandler);

export default router; 