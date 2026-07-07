import express from 'express';
import crypto from 'crypto';
import { send2FACode } from './emailService.js'; 
import { generateToken, verifyToken } from './utils/tokenGenerator.js';
import pool from './database.js';
import { otpSendRateLimiter, otpVerifyRateLimiter } from './middleware/rateLimiters.js';
import { logSecurityEvent } from './utils/securityLogger.js';

const router = express.Router();
const OTP_EXPIRY_MS = 5 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const OTP_SEND_COOLDOWN_SECONDS = 30;
let otpTableReady = false;

const ensureOtpTable = async () => {
  if (otpTableReady) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mfa_challenges (
      challenge_id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      otp_salt TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 5,
      expires_at TIMESTAMPTZ NOT NULL,
      last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  otpTableReady = true;
};

const hashOtp = (otp, salt) => crypto.createHash('sha256').update(`${salt}:${otp}`).digest('hex');

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
  try {
    await ensureOtpTable();
  } catch (error) {
    logSecurityEvent('OTP_TABLE_INIT_FAILED', { ip: req.ip }, 'error');
    return res.status(500).json({ success: false, message: 'Failed to initialize MFA challenge store' });
  }

  const { decoded, error } = getPreAuthPayload(req);
  if (error) {
    logSecurityEvent('OTP_SEND_UNAUTHORIZED', { ip: req.ip, email: req.body?.email }, 'warning');
    return res.status(401).json({ success: false, message: error });
  }

  const tokenEmail = decoded.email?.trim().toLowerCase();
  const tokenChallengeId = decoded.challengeId;
  const requestedEmail = req.body?.email?.trim().toLowerCase();

  if (requestedEmail && requestedEmail !== tokenEmail) {
    logSecurityEvent('OTP_SEND_EMAIL_MISMATCH', { ip: req.ip, email: tokenEmail }, 'warning');
    return res.status(400).json({ success: false, message: 'Email does not match MFA challenge' });
  }

  if (!tokenChallengeId) {
    return res.status(400).json({ success: false, message: 'Invalid MFA challenge' });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const salt = crypto.randomBytes(16).toString('hex');
  const otpHash = hashOtp(code, salt);

  try {
    const existingChallengeResult = await pool.query(
      `
      SELECT challenge_id
      FROM mfa_challenges
      WHERE challenge_id = $1
        AND last_sent_at > NOW() - ($2::INT * INTERVAL '1 second')
      `,
      [tokenChallengeId, OTP_SEND_COOLDOWN_SECONDS]
    );

    if (existingChallengeResult.rows.length > 0) {
      return res.status(429).json({ success: false, message: 'Please wait before requesting another OTP' });
    }

    await pool.query(
      `
      INSERT INTO mfa_challenges (
        challenge_id,
        email,
        otp_hash,
        otp_salt,
        attempts,
        max_attempts,
        expires_at,
        last_sent_at,
        created_at
      )
      VALUES ($1, $2, $3, $4, 0, $5, NOW() + ($6::INT * INTERVAL '1 millisecond'), NOW(), NOW())
      ON CONFLICT (challenge_id)
      DO UPDATE SET
        email = EXCLUDED.email,
        otp_hash = EXCLUDED.otp_hash,
        otp_salt = EXCLUDED.otp_salt,
        attempts = 0,
        max_attempts = EXCLUDED.max_attempts,
        expires_at = EXCLUDED.expires_at,
        last_sent_at = NOW()
      `,
      [tokenChallengeId, tokenEmail, otpHash, salt, MAX_VERIFY_ATTEMPTS, OTP_EXPIRY_MS]
    );

    await send2FACode(tokenEmail, code);
    logSecurityEvent('OTP_SENT', { ip: req.ip, email: tokenEmail, challengeId: tokenChallengeId }, 'info');
    return res.status(200).json({ success: true, message: 'OTP sent', expiresInSeconds: OTP_EXPIRY_MS / 1000 });
  } catch (err) {
    logSecurityEvent('OTP_SEND_FAILED', { ip: req.ip, email: tokenEmail, challengeId: tokenChallengeId }, 'error');
    console.error('Error sending OTP:', err);
    return res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
};

const verifyOtpHandler = async (req, res) => {
  try {
    await ensureOtpTable();
  } catch (tableError) {
    logSecurityEvent('OTP_TABLE_INIT_FAILED', { ip: req.ip }, 'error');
    return res.status(500).json({ success: false, message: 'Failed to initialize MFA challenge store' });
  }

  const { decoded, error } = getPreAuthPayload(req);
  if (error) {
    logSecurityEvent('OTP_VERIFY_UNAUTHORIZED', { ip: req.ip, email: req.body?.email }, 'warning');
    return res.status(401).json({ success: false, message: error });
  }

  const submittedOtp = req.body?.otp?.toString().trim() || req.body?.code?.toString().trim();
  if (!submittedOtp) {
    return res.status(400).json({ success: false, message: 'OTP code is required' });
  }

  const tokenEmail = decoded.email?.trim().toLowerCase();
  const tokenChallengeId = decoded.challengeId;
  try {
    const challengeResult = await pool.query(
      `
      SELECT challenge_id, email, otp_hash, otp_salt, attempts, max_attempts, expires_at
      FROM mfa_challenges
      WHERE challenge_id = $1
      `,
      [tokenChallengeId]
    );
    const challengeEntry = challengeResult.rows[0];

    if (!challengeEntry || challengeEntry.email?.trim().toLowerCase() !== tokenEmail) {
      logSecurityEvent('OTP_VERIFY_NO_CHALLENGE', { ip: req.ip, email: tokenEmail, challengeId: tokenChallengeId }, 'warning');
      return res.status(400).json({ success: false, message: 'No active OTP challenge found' });
    }

    if (new Date(challengeEntry.expires_at).getTime() <= Date.now()) {
      await pool.query('DELETE FROM mfa_challenges WHERE challenge_id = $1', [tokenChallengeId]);
      logSecurityEvent('OTP_VERIFY_EXPIRED', { ip: req.ip, email: tokenEmail, challengeId: tokenChallengeId }, 'warning');
      return res.status(401).json({ success: false, message: 'OTP has expired' });
    }

    if (challengeEntry.attempts >= challengeEntry.max_attempts) {
      await pool.query('DELETE FROM mfa_challenges WHERE challenge_id = $1', [tokenChallengeId]);
      logSecurityEvent('OTP_VERIFY_LOCKED', { ip: req.ip, email: tokenEmail, challengeId: tokenChallengeId }, 'warning');
      return res.status(429).json({ success: false, message: 'Too many invalid OTP attempts' });
    }

    const submittedHash = hashOtp(submittedOtp, challengeEntry.otp_salt);

    if (submittedHash !== challengeEntry.otp_hash) {
      await pool.query(
        'UPDATE mfa_challenges SET attempts = attempts + 1 WHERE challenge_id = $1',
        [tokenChallengeId]
      );
      logSecurityEvent('OTP_VERIFY_FAILED', { ip: req.ip, email: tokenEmail, challengeId: tokenChallengeId }, 'warning');
      return res.status(401).json({ success: false, message: 'Invalid OTP' });
    }

    await pool.query('DELETE FROM mfa_challenges WHERE challenge_id = $1', [tokenChallengeId]);
    logSecurityEvent('OTP_VERIFY_SUCCESS', { ip: req.ip, email: tokenEmail, challengeId: tokenChallengeId }, 'info');

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
    logSecurityEvent('OTP_VERIFY_FINALIZE_FAILED', { ip: req.ip, email: tokenEmail, challengeId: tokenChallengeId }, 'error');
    console.error('Error finalizing MFA login:', err);
    return res.status(500).json({ success: false, message: 'Failed to finalize login after OTP verification' });
  }
};

router.post('/send-2fa-code', otpSendRateLimiter, sendOtpHandler);
router.post('/verify-2fa', otpVerifyRateLimiter, verifyOtpHandler);
router.post('/send-otp', otpSendRateLimiter, sendOtpHandler);
router.post('/verify-otp', otpVerifyRateLimiter, verifyOtpHandler);

export default router; 