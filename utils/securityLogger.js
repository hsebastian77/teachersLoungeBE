const maskEmail = (email) => {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return 'unknown';
  }

  const [name, domain] = email.split('@');
  if (!name || !domain) {
    return 'unknown';
  }

  const visibleName = name.slice(0, 2);
  return `${visibleName}***@${domain}`;
};

const sanitizeDetails = (details = {}) => ({
  ...details,
  email: details.email ? maskEmail(details.email) : undefined,
  token: details.token ? '[REDACTED]' : undefined,
  mfaToken: details.mfaToken ? '[REDACTED]' : undefined,
  otp: details.otp ? '[REDACTED]' : undefined,
  code: details.code ? '[REDACTED]' : undefined,
});

const logSecurityEvent = (eventType, details = {}, severity = 'info') => {
  const payload = {
    eventType,
    severity,
    timestamp: new Date().toISOString(),
    details: sanitizeDetails(details),
  };

  console.log('SECURITY_EVENT', JSON.stringify(payload));
};

export { logSecurityEvent };
