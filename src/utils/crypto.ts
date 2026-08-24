// Secure cryptographic hashing using standard Web Crypto API
export async function hashPassword(password: string, salt = 'cipherchat_secure_salt_2026'): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + ':' + salt);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
