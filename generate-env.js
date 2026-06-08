import fs from 'fs';
import path from 'path';

// Ensure public directory exists
const publicDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
    console.log('Created public directory');
}

// Load existing .env variables if they exist
let existingUrl = '';
let existingKey = '';
if (fs.existsSync('.env')) {
    try {
        const envContent = fs.readFileSync('.env', 'utf-8');
        envContent.split('\n').forEach(line => {
            const parts = line.split('=');
            if (parts.length >= 2) {
                const k = parts[0].trim();
                const v = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
                if (k === 'VITE_SUPABASE_URL') existingUrl = v;
                if (k === 'VITE_SUPABASE_KEY') existingKey = v;
            }
        });
    } catch (e) {
        console.warn("Could not parse existing .env file:", e);
    }
}

// Read from Netlify's environment variables (support both prefixed and non-prefixed for safety)
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || existingUrl || 'https://sxgjhivrclawaxqtphge.supabase.co';
const key = process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_KEY || existingKey || '';

// Write to .env file in the build directory
const content = `VITE_SUPABASE_URL=${url}
VITE_SUPABASE_KEY=${key}
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
