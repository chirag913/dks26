// scripts/generate-token.js
import crypto from 'crypto';

// Generate a secure random token
const token = crypto.randomBytes(32).toString('hex');

console.log('Use this token as your CRON_SECRET_TOKEN:');
console.log(token);