// Usage: node scripts/hash-password.mjs 'new-password'
// Paste the output into the ADMIN_PASSWORD_HASH environment variable on Vercel.
import { hashPassword } from '../lib/auth.js';

const pw = process.argv[2];
if (!pw || pw.length < 12) {
  console.error('Give a password of at least 12 characters.');
  process.exit(1);
}
console.log(hashPassword(pw));
