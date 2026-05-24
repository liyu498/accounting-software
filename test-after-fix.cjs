const { chromium } = require('playwright-core');

async function testAfterFix() {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/liyu498/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    headless: true
  });

  const page = await browser.newPage();

  // Log errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[BROWSER ERROR]:`, msg.text());
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

  // Wait for the page to update after login
  await page.waitForTimeout(5000);

  console.log('Current URL:', page.url());

  // Get body text
  const bodyText = await page.locator('body').innerText();
  console.log('\n--- Page content after login and wait ---');
  console.log(bodyText.substring(0, 2000));

  // Check for warning toast or navigate to vouchers
  console.log('\n--- Checking if warning toast appeared ---');
  console.log('Contains 请先选择一个账套:', bodyText.includes('请先选择一个账套'));

  // Try to click 新建凭证
  console.log('\n3. Trying to click 新建凭证...');
  const voucherBtn = page.locator('button:has-text("新建凭证")').first();
  if (await voucherBtn.count() > 0) {
    await voucherBtn.click();
    await page.waitForTimeout(2000);
    console.log('URL after clicking新建凭证:', page.url());

    if (page.url().includes('vouchers')) {
      console.log('SUCCESS: Navigated to vouchers page!');
      const voucherText = await page.locator('body').innerText();
      console.log('\nVoucher page content (first 1000 chars):');
      console.log(voucherText.substring(0, 1000));
    } else {
      console.log('Still on same page, checking for toast...');
      const newBodyText = await page.locator('body').innerText();
      console.log('Warning still shown:', newBodyText.includes('请先选择一个账套'));
    }
  }

  await page.screenshot({ path: 'after-fix.png', fullPage: true });

  await browser.close();
  console.log('\nTest completed');
}

testAfterFix().catch(console.error);
