const fs = require('fs');

// Read from Netlify's environment variables
const url = process.env.SUPABASE_URL || 'https://sxgjhivrclawaxqtphge.supabase.co';
const key = process.env.SUPABASE_KEY || '';

// Write to .env file in the build directory
const content = `SUPABASE_URL=${url}
SUPABASE_KEY=${key}
`;

fs.writeFileSync('.env', content);
console.log('.env file generated successfully from build environment variables!');
