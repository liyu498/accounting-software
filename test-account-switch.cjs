const { chromium } = require('playwright-core');

async function testAccountSwitch() {
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
  console.log('1. Navigating to app...');
  await page.goto('http://localhost:1420');
  await page.waitForTimeout(2000);

  // Login
  console.log('2. Logging in...');
  await page.locator('input').first().fill('admin');
  await page.locator('input').nth(1).fill('admin123');
  await page.locator('button').click();
  await page.waitForTimeout(3000);

  // Take screenshot after login
  await page.screenshot({ path: 'step2-after-login.png', fullPage: true });
  console.log('Screenshot after login saved');

  // Check initial state
  const bodyText = await page.locator('body').innerText();
  console.log('\n--- Initial state (after login) ---');
  console.log('账套所属期 visible:', bodyText.includes('账套所属期'));

  // Find and click the CompanySelector dropdown
  console.log('\n3. Looking for账套 selector...');
  const selectorButton = page.locator('button').filter({ hasText: /账套|2024/ }).first();
  const selectorExists = await selectorButton.count() > 0;
  console.log('账套 selector found:', selectorExists);

  if (selectorExists) {
    await selectorButton.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'step3-dropdown.png', fullPage: true });
    console.log('Clicked账套 selector, dropdown should be open');

    // Get dropdown content
    const dropdownText = await page.locator('body').innerText();
    console.log('\n--- Dropdown content (contains) ---');
    console.log('包含 2024年:', dropdownText.includes('2024年'));
    console.log('包含 账套:', dropdownText.includes('账套'));
  }

  // Navigate to voucher list
  console.log('\n4. Navigating to凭证 list...');
  const voucherLink = page.locator('text=会计凭证').first();
  if (await voucherLink.count() > 0) {
    await voucherLink.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'step4-voucher-list.png', fullPage: true });

    const voucherText = await page.locator('body').innerText();
    console.log('\n--- Voucher list content ---');
    console.log('凭证 text found:', voucherText.includes('凭证'));
    console.log('Has pagination:', voucherText.includes('第') && voucherText.includes('页'));
    console.log('First 1000 chars:', voucherText.substring(0, 1000));
  } else {
    console.log('会计凭证 link not found directly, looking for nav...');
    // Look for navigation menu items
    const navItems = await page.locator('nav a, aside a, [role="navigation"] a').allInnerTexts();
    console.log('Navigation items:', navItems);
  }

  // Check console errors
  console.log('\n--- Console Errors ---');
  consoleMessages.filter(m => m.type === 'error').forEach(m => console.log(m.text));

  await browser.close();
  console.log('\nTest completed');
}

testAccountSwitch().catch(console.error);
