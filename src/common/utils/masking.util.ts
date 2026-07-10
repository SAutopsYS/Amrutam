/**
 * Masks sensitive medical/payment fields before logging.
 * Never log raw PHI or payment card data.
 */
export function maskSensitive(value: string | undefined | null, visibleChars = 4): string {
  if (!value) return '[REDACTED]';
  if (value.length <= visibleChars) return '*'.repeat(value.length);
  return '*'.repeat(value.length - visibleChars) + value.slice(-visibleChars);
}

export function sanitizeForLog(payload: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    'diagnosis',
    'doctorNotes',
    'chiefComplaint',
    'symptoms',
    'password',
    'token',
    'cardNumber',
    'cvv',
    'metadataEncrypted',
  ];
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(payload)) {
    if (sensitiveKeys.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
      result[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      result[key] = sanitizeForLog(val as Record<string, unknown>);
    } else {
      result[key] = val;
    }
  }
  return result;
}
