import rateLimit from 'express-rate-limit';

const buildLimiter = ({ windowMs, max, message }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message },
  });

const authRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts. Please try again later.',
});

const otpSendRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many OTP send requests. Please try again later.',
});

const otpVerifyRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 12,
  message: 'Too many OTP verification attempts. Please try again later.',
});

const passwordResetRequestRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many password reset requests. Please try again later.',
});

const passwordResetConfirmRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many password reset attempts. Please try again later.',
});

const writeOperationRateLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Too many write requests. Please slow down.',
});

const usernameLookupRateLimiter = buildLimiter({
  windowMs: 1000,
  max: 5,
  message: 'Too many username lookup requests. Please pause typing.',
});

export {
  authRateLimiter,
  otpSendRateLimiter,
  otpVerifyRateLimiter,
  passwordResetRequestRateLimiter,
  passwordResetConfirmRateLimiter,
  usernameLookupRateLimiter,
  writeOperationRateLimiter,
};
