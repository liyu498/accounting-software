const { chromium } = require('playwright-core');

async function testApp() {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/liyu498/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    headless: true
  });

  const page = await browser.newPage();

  // Collect console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  // Navigate to app
  console.log('Navigating to app...');
  await page.goto('http://localhost:1420');
  console.log('Page title:', await page.title());

  // Wait for page to load
  await page.waitForTimeout(2000);

  // Find login form inputs
  const usernameInput = page.locator('input').first();
  const passwordInput = page.locator('input').nth(1);
  const loginButton = page.locator('button');

  console.log('Found username input:', await usernameInput.count() > 0);
  console.log('Found password input:', await passwordInput.count() > 0);
  console.log('Found login button:', await loginButton.count() > 0);

  // Fill in login credentials
  await usernameInput.fill('admin');
  await passwordInput.fill('admin123');

  console.log('Filled login form');

  // Click login button
  await loginButton.click();
  console.log('Clicked login button');

  // Wait for navigation/response
  await page.waitForTimeout(3000);

  // Get page content after login
  const bodyText = await page.locator('body').innerText();
  console.log('\n--- Page Content after login (first 3000 chars) ---');
  console.log(bodyText.substring(0, 3000));

  // Check if login was successful (look for navigation items)
  const hasDashboard = bodyText.includes('首页') || bodyText.includes('Dashboard');
  const hasVoucher = bodyText.includes('凭证');
  const hasAccount = bodyText.includes('账套') || bodyText.includes('账户');

  console.log('\n--- Login Status ---');
  console.log('Has Dashboard:', hasDashboard);
  console.log('Has Voucher:', hasVoucher);
  console.log('Has Account:', hasAccount);

  // Check console errors
  console.log('\n--- Console Errors ---');
  consoleMessages.filter(m => m.type === 'error').forEach(m => console.log(m.text));

  // Take screenshot
  await page.screenshot({ path: 'test-after-login.png', fullPage: true });
  console.log('\nScreenshot saved to test-after-login.png');

  await browser.close();
  console.log('Test completed');
}

testApp().catch(console.error);
