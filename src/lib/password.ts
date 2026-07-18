/** Initial login may still be the 4-digit PIN from seed. */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;

export function isValidNewPassword(password: string): boolean {
  const p = password.trim();
  return p.length >= MIN_PASSWORD_LENGTH && p.length <= MAX_PASSWORD_LENGTH;
}

export function passwordErrorMessage(password: string): string | null {
  const p = password.trim();
  if (p.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`;
  }
  if (p.length > MAX_PASSWORD_LENGTH) {
    return `La contraseña no puede superar ${MAX_PASSWORD_LENGTH} caracteres`;
  }
  return null;
}
