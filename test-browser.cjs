const { chromium } = require('playwright-core');

async function testApp() {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/liyu498/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    headless: true
  });

  const page = await browser.newPage();

  // Navigate to app
  await page.goto('http://localhost:1420');
  console.log('Page title:', await page.title());

  // Take screenshot
  await page.screenshot({ path: 'test-screenshot.png' });
  console.log('Screenshot saved to test-screenshot.png');

  // Check for console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Console error:', msg.text());
    }
  });

  // Wait a bit for any async errors
  await page.waitForTimeout(2000);

  await browser.close();
  console.log('Test completed');
}

testApp().catch(console.error);
