const { chromium } = require('playwright-core');

async function testVoucherPage() {
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

  // Navigate directly to voucher page
  console.log('\n3. Navigating directly to voucher page...');
  await page.goto('http://localhost:1420/vouchers');
  await page.waitForTimeout(3000);

  const bodyText = await page.locator('body').innerText();
  console.log('\n--- Voucher page content ---');
  console.log(bodyText.substring(0, 2000));

  // Check for voucher list
  console.log('\n--- Voucher page checks ---');
  console.log('Contains 凭证:', bodyText.includes('凭证'));
  console.log('Contains 新建:', bodyText.includes('新建'));
  console.log('Contains 审核:', bodyText.includes('审核'));

  await page.screenshot({ path: 'voucher-page.png', fullPage: true });
  console.log('\nScreenshot saved to voucher-page.png');

  // Also try the /voucher route
  console.log('\n4. Trying /voucher route...');
  await page.goto('http://localhost:1420/voucher');
  await page.waitForTimeout(3000);

  const voucherText = await page.locator('body').innerText();
  console.log('Contains 凭证:', voucherText.includes('凭证'));

  await browser.close();
  console.log('\nTest completed');
}

testVoucherPage().catch(console.error);
