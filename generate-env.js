import fs from 'fs';

// Read from Netlify's environment variables
const url = process.env.SUPABASE_URL || 'https://sxgjhivrclawaxqtphge.supabase.co';
const key = process.env.SUPABASE_KEY || '';

// Write to .env file in the build directory
const content = `SUPABASE_URL=${url}
SUPABASE_KEY=${key}
`;

fs.writeFileSync('.env', content);
console.log('.env file generated successfully!');

// Write to config.json file in the public directory for Vite dev and production builds
const configContent = JSON.stringify({
    SUPABASE_URL: url,
    SUPABASE_KEY: key
}, null, 2);

fs.writeFileSync('public/config.json', configContent);
console.log('public/config.json file generated successfully!');
