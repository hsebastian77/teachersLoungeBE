import pool from "./database.js";
import bcrypt from "bcrypt";
import { generatePreAuthToken } from "./utils/tokenGenerator.js";
import { logSecurityEvent } from "./utils/securityLogger.js";

// Function to decode JWT token (without verification for simplicity)
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    
    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64url').toString('utf8');
    return JSON.parse(decoded);
  } catch (error) {
    console.error('JWT decode error:', error);
    return null;
  }
}

const buildSocialMfaResponse = (user, mfaToken, challengeId) => {
  if (typeof mfaToken !== 'string' || !mfaToken.trim()) {
    throw new Error('Invalid MFA token generated');
  }

  const responsePayload = {
    message: "MFA verification required",
    user: {
      Email: user.email,
      FirstName: user.firstname,
      LastName: user.lastname,
      SchoolName: user.schoolname,
      Role: user.role,
      ProfilePicLink: user.profilepiclink
    },
    requires2FA: true,
    mfaRequired: true,
    mfaToken,
    challengeId
  };

  const expectedUserKeys = ['Email', 'FirstName', 'LastName', 'SchoolName', 'Role', 'ProfilePicLink'];
  const hasAllExpectedKeys = expectedUserKeys.every((key) => Object.prototype.hasOwnProperty.call(responsePayload.user, key));
  if (!hasAllExpectedKeys) {
    throw new Error('Social user payload keys are missing expected fields');
  }

  return responsePayload;
};

// Handle social login (Apple, Google, LinkedIn)
export const handleSocialLogin = async (req, res, next) => {
  let { provider, email, firstName, lastName, providerId, identityToken } = req.body;

  // For Apple login, extract email from identityToken if email is null
  if (provider === 'apple' && !email && identityToken) {
    const decodedToken = decodeJWT(identityToken);
    if (decodedToken && decodedToken.email) {
      email = decodedToken.email;
    }
  }

  if (!provider || !email) {
    logSecurityEvent('SOCIAL_LOGIN_VALIDATION_FAILED', { ip: req.ip, provider, email }, 'warning');
    return res.status(400).json({ message: "Provider and email are required" });
  }

  const client = await pool.connect();

  try {
    // Check if user already exists
    const checkUserQuery = `
      SELECT 
        U.email, 
        U.firstname, 
        U.lastname, 
        S.schoolname AS schoolname, 
        U.role,
        U.profilepiclink
      FROM USERS AS U
      INNER JOIN SCHOOL AS S ON U.schoolid = S.schoolid
      WHERE U.email = $1
    `;
    
    const existingUser = await client.query(checkUserQuery, [email]);

    if (existingUser.rows.length > 0) {
      // User exists, check if need to update status
      const user = existingUser.rows[0];
      
      // If user is Pending and this is a social login, update to Approved
      if (user.role === 'Pending') {
        const updateUserQuery = `
          UPDATE USERS SET role = 'Approved' WHERE email = $1
        `;
        await client.query(updateUserQuery, [email]);
        user.role = 'Approved'; // Update local object
      }
      
      const { token: mfaToken, challengeId } = generatePreAuthToken(user);
      const responsePayload = buildSocialMfaResponse(user, mfaToken, challengeId);
      logSecurityEvent('SOCIAL_LOGIN_MFA_CHALLENGE_CREATED', { ip: req.ip, email, provider, challengeId }, 'info');
      return res.status(200).json(responsePayload);
    } else {
      // User doesn't exist, create new user
      const defaultPassword = Math.random().toString(36).slice(-8); // Generate random password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(defaultPassword, salt);

      const insertUserQuery = `
        INSERT INTO USERS (Email, FirstName, LastName, Password, SchoolID, Role) 
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      
      await client.query(insertUserQuery, [
        email,
        firstName || 'Apple',
        lastName || 'User',
        hashedPassword,
        1, // Default school ID
        'Approved' // Social login users are automatically approved
      ]);

      // Get the newly created user with school info
      const newUserResult = await client.query(checkUserQuery, [email]);
      const newUser = newUserResult.rows[0];
      
      const { token: mfaToken, challengeId } = generatePreAuthToken(newUser);
      const responsePayload = buildSocialMfaResponse(newUser, mfaToken, challengeId);
      logSecurityEvent('SOCIAL_SIGNUP_MFA_CHALLENGE_CREATED', { ip: req.ip, email, provider, challengeId }, 'info');
      return res.status(200).json(responsePayload);
    }
  } catch (error) {
    logSecurityEvent('SOCIAL_LOGIN_SERVER_ERROR', { ip: req.ip, email, provider }, 'error');
    console.error('Social login error:', error.stack);
    return res.status(500).json({ message: "Server error: " + error.message });
  } finally {
    client.release();
  }
};

// Handle LinkedIn OAuth (if needed for code exchange)
export const handleLinkedInAuth = async (req, res, next) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ message: "Authorization code is required" });
  }

  // Check if LinkedIn client secret is configured
  if (!process.env.LINKEDIN_CLIENT_SECRET) {
    console.error('LINKEDIN_CLIENT_SECRET not found in environment variables');
    return res.status(500).json({ 
      message: "Server configuration error: LinkedIn Client Secret not configured. Please add LINKEDIN_CLIENT_SECRET to your environment variables." 
    });
  }

  try {
    // Exchange authorization code for access token
    const tokenParams = {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: 'https://omegaeducationaltechsolutions.com/linkedin-redirect',
      client_id: '77bw10d90022pu',
      client_secret: process.env.LINKEDIN_CLIENT_SECRET,
    };
    
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(tokenParams),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      logSecurityEvent('LINKEDIN_TOKEN_EXCHANGE_FAILED', { ip: req.ip, provider: 'linkedin' }, 'warning');
      console.error('LinkedIn token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        response: tokenData
      });
      return res.status(400).json({ 
        message: "Failed to exchange authorization code for access token",
        error: tokenData,
        hint: "This is usually caused by incorrect LinkedIn Client ID/Secret pair or redirect URI mismatch"
      });
    }

    // Get user profile and email information using LinkedIn OpenID Connect userinfo endpoint
    const userInfoResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'cache-control': 'no-cache'
      },
    });
    const userInfoData = await userInfoResponse.json();

    // Check if we got the required user information
    if (!userInfoData.email) {
      logSecurityEvent('LINKEDIN_USERINFO_MISSING_EMAIL', { ip: req.ip, provider: 'linkedin' }, 'warning');
      console.error('LinkedIn userinfo failed - no email. API Response:', userInfoData);
      return res.status(400).json({ 
        message: "Failed to get user email from LinkedIn OpenID Connect API",
        hint: "Make sure your LinkedIn app has the 'Sign in with LinkedIn using OpenID Connect' product enabled and the 'openid', 'profile', and 'email' scopes are requested."
      });
    }

    // Extract user information from OpenID Connect userinfo response
    const email = userInfoData.email;
    const firstName = userInfoData.given_name || userInfoData.name?.split(' ')[0] || 'LinkedIn';
    const lastName = userInfoData.family_name || userInfoData.name?.split(' ').slice(1).join(' ') || 'User';
    const userId = userInfoData.sub; // OpenID Connect standard user identifier

    // Now handle the social login with the user data
    req.body = {
      provider: 'linkedin',
      email: email,
      firstName: firstName,
      lastName: lastName,
      providerId: userId,
    };

    // Call the existing social login handler
    return handleSocialLogin(req, res, next);

  } catch (error) {
    logSecurityEvent('LINKEDIN_AUTH_SERVER_ERROR', { ip: req.ip, provider: 'linkedin' }, 'error');
    console.error('LinkedIn auth error:', error.stack);
    return res.status(500).json({ message: "Server error: " + error.message });
  }
};

// Handle Google OAuth code exchange
export const handleGoogleAuth = async (req, res, next) => {
  const { code, redirect_uri, code_verifier, client_id } = req.body;

  if (!code) {
    return res.status(400).json({ message: "Authorization code is required" });
  }

  // Use the redirect_uri and client_id from the request
  const actualRedirectUri = redirect_uri || 'tlapp://oauthredirect';
  const actualClientId = client_id || '503056180344-4segfcuad38tbsheem42k34ouou0dbj1.apps.googleusercontent.com';
  
  // Prepare token exchange body
  const tokenParams = {
    client_id: actualClientId,
    code: code,
    grant_type: 'authorization_code',
    redirect_uri: actualRedirectUri,
  };
  
  // For mobile clients with PKCE, we don't need client_secret
  if (code_verifier) {
    tokenParams.code_verifier = code_verifier;
  } else {
    // Only use client secret for web clients without PKCE
    if (!process.env.GOOGLE_CLIENT_SECRET) {
      console.error('GOOGLE_CLIENT_SECRET not found in environment variables');
      return res.status(500).json({ 
        message: "Server configuration error: Google Client Secret not configured for web client authentication." 
      });
    }
    tokenParams.client_secret = process.env.GOOGLE_CLIENT_SECRET;
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(tokenParams),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      logSecurityEvent('GOOGLE_TOKEN_EXCHANGE_FAILED', { ip: req.ip, provider: 'google' }, 'warning');
      return res.status(400).json({ 
        message: "Failed to exchange authorization code for access token",
        error: tokenData
      });
    }

    // Get user info from Google
    const userInfoResponse = await fetch(
      `https://www.googleapis.com/oauth2/v1/userinfo?access_token=${tokenData.access_token}`
    );
    const userData = await userInfoResponse.json();

    if (!userData.email) {
      logSecurityEvent('GOOGLE_USERINFO_MISSING_EMAIL', { ip: req.ip, provider: 'google' }, 'warning');
      return res.status(400).json({ message: "Failed to get user email from Google" });
    }

    // Now handle the social login with the user data
    req.body = {
      provider: 'google',
      email: userData.email,
      firstName: userData.given_name,
      lastName: userData.family_name,
      providerId: userData.id,
    };

    // Call the existing social login handler
    return handleSocialLogin(req, res, next);

  } catch (error) {
    logSecurityEvent('GOOGLE_AUTH_SERVER_ERROR', { ip: req.ip, provider: 'google' }, 'error');
    console.error('Google auth error:', error.stack);
    return res.status(500).json({ message: "Server error: " + error.message });
  }
};