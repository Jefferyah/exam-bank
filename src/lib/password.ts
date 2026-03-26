/**
 * Validate password strength.
 * Requirements: >= 8 characters, at least one letter and one number.
 */
export function validatePassword(password: string): { valid: boolean; error: string | null } {
  if (!password || password.length < 8) {
    return { valid: false, error: "密碼至少需要 8 個字元" };
  }

  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, error: "密碼需包含至少一個英文字母" };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "密碼需包含至少一個數字" };
  }

  if (password.length > 128) {
    return { valid: false, error: "密碼長度不得超過 128 個字元" };
  }

  return { valid: true, error: null };
}
