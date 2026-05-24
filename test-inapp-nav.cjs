const { chromium } = require('playwright-core');

async function testInAppNav() {
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

  console.log('3. After login - looking for navigation...');

  // Get body text
  const bodyText = await page.locator('body').innerText();

  // Look for "快捷操作" section with "新建凭证" button
  const newVoucherBtn = page.locator('text=新建凭证').first();
  if (await newVoucherBtn.count() > 0) {
    console.log('Found 新建凭证 button, clicking...');
    await newVoucherBtn.click();
    await page.waitForTimeout(3000);

    const afterClickText = await page.locator('body').innerText();
    console.log('\n--- After clicking新建凭证 ---');
    console.log(afterClickText.substring(0, 2000));
    console.log('\nContains 凭证:', afterClickText.includes('凭证'));
    console.log('Contains 保存:', afterClickText.includes('保存'));

    await page.screenshot({ path: 'after-new-voucher.png', fullPage: true });
  }

  // Now look for sidebar navigation
  console.log('\n4. Looking for sidebar...');

  // Get all visible elements
  const sidebar = page.locator('aside, nav, [class*="sidebar"], [class*="nav"]');
  console.log('Sidebar elements found:', await sidebar.count());

  // Check for expanded menu items
  const menuItems = await page.locator('[role="menuitem"], [role="menu"]').all();
  console.log('Menu elements found:', menuItems.length);

  // Try to find any element containing specific navigation text
  const navTexts = ['财务', '业务处理', '报表', '设置', 'AI记账'];
  for (const text of navTexts) {
    const elements = await page.locator(`text=${text}`).all();
    console.log(`"${text}" found ${elements.length} times`);
  }

  await page.screenshot({ path: 'full-page.png', fullPage: true });

  await browser.close();
  console.log('\nTest completed');
}

testInAppNav().catch(console.error);
