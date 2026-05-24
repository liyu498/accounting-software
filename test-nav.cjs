const { chromium } = require('playwright-core');

async function testNavigation() {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/liyu498/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    headless: true
  });

  const page = await browser.newPage();

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

  // Get all links and buttons
  console.log('\n3. Finding navigation elements...');

  // Find all clickable elements
  const allElements = await page.locator('a, button, [role="menuitem"], [role="button"]').all();
  console.log('Total clickable elements:', allElements.length);

  // Print all visible text
  const bodyText = await page.locator('body').innerText();

  // Look for sidebar/nav section
  console.log('\n--- Looking for 财务/凭证 in page ---');
  console.log('Contains 财务:', bodyText.includes('财务'));
  console.log('Contains 凭证:', bodyText.includes('凭证'));
  console.log('Contains 业务处理:', bodyText.includes('业务处理'));
  console.log('Contains 报表:', bodyText.includes('报表'));

  // Try clicking on sidebar items
  console.log('\n4. Trying to find and click sidebar items...');

  // Get all visible text split by newlines
  const lines = bodyText.split('\n').filter(l => l.trim());
  console.log('\n--- All non-empty lines ---');
  for (let i = 0; i < Math.min(lines.length, 80); i++) {
    console.log(`${i}: "${lines[i]}"`);
  }

  await page.screenshot({ path: 'step4-nav.png', fullPage: true });

  await browser.close();
  console.log('\nTest completed');
}

testNavigation().catch(console.error);
