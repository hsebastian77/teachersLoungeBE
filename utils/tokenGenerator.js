import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Generates and returns a jwt token based on param: user
const generateToken = (user) => {
  const { email, role } = user;  
  // Access token expires in 60 minutes.
  const token = jwt.sign({ email, role, tokenType: 'access' }, process.env.JWT_SECRET, { expiresIn: '60m' });
  return token;
};

// Generates a short-lived token used only for MFA challenge endpoints.
const generatePreAuthToken = (user) => {
  const { email, role } = user;
  const challengeId = crypto.randomUUID();
  const token = jwt.sign(
    { email, role, tokenType: 'preauth', challengeId },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );

  return { token, challengeId };
};

const verifyToken = (token) => jwt.verify(token, process.env.JWT_SECRET);

export { generateToken, generatePreAuthToken, verifyToken };
