const { chromium } = require('playwright-core');

async function testSelectAccount() {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/liyu498/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    headless: true
  });

  const page = await browser.newPage();

  // Log all console messages
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
  await page.waitForTimeout(3000);

  console.log('Current URL:', page.url());

  // The page shows 账套所属期 dropdown with periods, but selectedCompanyId might be null
  // Let's find the CompanySelector dropdown in the header

  console.log('\n3. Looking for CompanySelector dropdown...');

  // The CompanySelector button should be visible in the header
  // It shows the current account name and has a dropdown arrow
  // Look for a button that contains Building2 icon or has account-related text

  // First, let's check the header area
  const headerButton = page.locator('header button').first();
  if (await headerButton.count() > 0) {
    const headerBtnText = await headerButton.innerText();
    console.log('First header button text:', headerBtnText);
  }

  // Look for buttons containing specific text
  const buttons = await page.locator('button').all();
  console.log('\nAll buttons on page:');
  for (let i = 0; i < Math.min(buttons.length, 15); i++) {
    const text = await buttons[i].innerText().catch(() => '');
    console.log(`  ${i}: "${text}"`);
  }

  // Click on the first button in the header area (which should be the back to home button)
  // The CompanySelector should be after that
  console.log('\n4. Trying to click on CompanySelector...');

  // The CompanySelector should be near "账套" text
  const accountSelectorBtn = page.locator('button:has-text("2024")').first();
  if (await accountSelectorBtn.count() > 0) {
    console.log('Found button with 2024, clicking...');
    await accountSelectorBtn.click();
    await page.waitForTimeout(1000);

    // Check if dropdown appeared
    const dropdownText = await page.locator('body').innerText();
    console.log('\nAfter clicking, dropdown content includes:');
    console.log('Has 账套:', dropdownText.includes('账套'));
    console.log('Has 切换账套:', dropdownText.includes('切换账套'));

    await page.screenshot({ path: 'dropdown-open.png', fullPage: true });
  }

  // Now try to navigate via URL to vouchers directly
  console.log('\n5. Trying direct navigation to vouchers...');
  await page.goto('http://localhost:1420/vouchers');
  await page.waitForTimeout(3000);

  console.log('URL after direct nav:', page.url());
  const voucherText = await page.locator('body').innerText();
  console.log('\nVoucher page content (first 1000 chars):');
  console.log(voucherText.substring(0, 1000));

  await page.screenshot({ path: 'voucher-direct.png', fullPage: true });

  await browser.close();
  console.log('\nTest completed');
}

testSelectAccount().catch(console.error);
