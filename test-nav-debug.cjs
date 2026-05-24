const { chromium } = require('playwright-core');

async function testNavDebug() {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/liyu498/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    headless: true
  });

  const page = await browser.newPage();

  // Log all console messages
  page.on('console', msg => {
    console.log(`[BROWSER ${msg.type()}]:`, msg.text());
  });

  // Log all requests
  page.on('request', request => {
    if (request.url().includes('localhost')) {
      console.log(`[REQUEST]: ${request.method()} ${request.url()}`);
    }
  });

  page.on('response', response => {
    if (response.url().includes('localhost')) {
      console.log(`[RESPONSE]: ${response.status()} ${response.url()}`);
    }
  });

  // Navigate to app
  console.log('1. Navigating to app...');
  await page.goto('http://localhost:1420');
  await page.waitForTimeout(2000);

  // Login
  console.log('2. Logging in...');
  await page.locator('input').first().fill('admin');
  await page.locator('input').nth(1).fill('admin123');
  await page.locator('button').click();
  await page.waitForTimeout(3000);

  console.log('Current URL after login:', page.url());

  // Try clicking 新建凭证 button using JavaScript
  console.log('\n3. Looking for 新建凭证 button...');

  // Find all buttons containing "新建凭证"
  const buttons = await page.locator('button:has-text("新建凭证")').all();
  console.log(`Found ${buttons.length} buttons with text "新建凭证"`);

  if (buttons.length > 0) {
    // Get the first one's bounding box
    const bbox = await buttons[0].boundingBox();
    console.log('Button bounding box:', bbox);

    // Click it
    console.log('Clicking button...');
    await buttons[0].click();
    await page.waitForTimeout(3000);

    console.log('Current URL after click:', page.url());

    // Get body text
    const bodyText = await page.locator('body').innerText();
    console.log('\n--- Body text after click ---');
    console.log(bodyText.substring(0, 1500));
  }

  await page.screenshot({ path: 'nav-debug.png', fullPage: true });

  await browser.close();
  console.log('\nTest completed');
}

testNavDebug().catch(console.error);
