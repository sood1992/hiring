#!/usr/bin/env node
/**
 * LinkedIn Cookie Generator
 *
 * Run this script LOCALLY on your computer (not on server)
 * It opens a visible browser so you can complete security checks
 *
 * Usage:
 *   node generate-linkedin-cookies.js
 *
 * After login, copy .linkedin-cookies.json to your server
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const COOKIES_PATH = path.join(__dirname, '.linkedin-cookies.json');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
  console.log('\n🔐 LinkedIn Cookie Generator\n');
  console.log('This will open a browser window where you can log in to LinkedIn.');
  console.log('Complete any security checks (CAPTCHA, email verification, etc.)');
  console.log('Once logged in, cookies will be saved automatically.\n');

  const email = await ask('Enter your LinkedIn email: ');
  const password = await ask('Enter your LinkedIn password: ');

  console.log('\n📱 Opening browser... Complete any verification steps.\n');

  const browser = await chromium.launch({
    headless: false, // VISIBLE browser so you can complete verification
    slowMo: 50
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    // Go to login page
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Fill credentials
    await page.fill('#username', email);
    await page.waitForTimeout(500);
    await page.fill('#password', password);
    await page.waitForTimeout(500);

    // Click sign in
    await page.click('[type="submit"]');

    console.log('⏳ Waiting for login... Complete any verification in the browser window.\n');
    console.log('   Press ENTER here once you are logged in and see your LinkedIn feed.\n');

    await ask('   → Press ENTER when ready: ');

    // Check if logged in
    const url = page.url();
    if (url.includes('/feed') || url.includes('/mynetwork') || !url.includes('/login')) {
      // Save cookies
      const cookies = await context.cookies();
      fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));

      console.log('\n✅ Success! Cookies saved to: .linkedin-cookies.json');
      console.log('\n📤 Next steps:');
      console.log('   1. Copy .linkedin-cookies.json to your server');
      console.log('   2. Place it in the same folder as server.js');
      console.log('   3. Restart your server');
      console.log('   4. LinkedIn should now work without login!\n');
    } else {
      console.log('\n❌ Login may not have completed. Current URL:', url);
      console.log('   Try running the script again.\n');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await browser.close();
    rl.close();
  }
}

main().catch(console.error);
