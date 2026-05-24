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
  await page.waitForTimeout(3000);

  // Get page content
  const bodyText = await page.locator('body').innerText();
  console.log('\n--- Page Content (first 2000 chars) ---');
  console.log(bodyText.substring(0, 2000));

  // Check if there's a login form
  const loginForm = await page.locator('form').count();
  console.log('\n--- Form count:', loginForm);

  // Check for input fields
  const inputs = await page.locator('input').count();
  console.log('Input count:', inputs);

  // Check for buttons
  const buttons = await page.locator('button').count();
  console.log('Button count:', buttons);

  // Check for any visible text containing "账套" or "公司"
  const hasAccountText = bodyText.includes('账套') || bodyText.includes('公司');
  console.log('\nContains 账套/公司 text:', hasAccountText);

  // Check console errors
  console.log('\n--- Console Errors ---');
  consoleMessages.filter(m => m.type === 'error').forEach(m => console.log(m.text));

  // Take screenshot
  await page.screenshot({ path: 'test-app-screenshot.png', fullPage: true });
  console.log('\nScreenshot saved to test-app-screenshot.png');

  await browser.close();
  console.log('Test completed');
}

testApp().catch(console.error);
