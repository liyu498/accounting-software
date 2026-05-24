const { chromium } = require('playwright-core');

async function testHeader() {
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

  console.log('\n3. Analyzing page structure...');

  // Get all visible text lines
  const bodyText = await page.locator('body').innerText();
  const lines = bodyText.split('\n').filter(l => l.trim());

  // Find where 账套所属期 appears
  const zhangtaoIndex = lines.findIndex(l => l.includes('账套所属期'));
  console.log('账套所属期 appears at line index:', zhangtaoIndex);

  // Print surrounding lines
  if (zhangtaoIndex >= 0) {
    console.log('\nContext around 账套所属期:');
    for (let i = Math.max(0, zhangtaoIndex - 3); i < Math.min(lines.length, zhangtaoIndex + 10); i++) {
      console.log(`  ${i}: "${lines[i]}"`);
    }
  }

  // Get the full HTML of the header area
  const headerHtml = await page.locator('header').innerHTML().catch(() => 'No header found');
  console.log('\n--- Header HTML (first 2000 chars) ---');
  console.log(headerHtml.substring(0, 2000));

  // Get buttons in header specifically
  const headerButtons = await page.locator('header button').all();
  console.log('\n--- Header buttons ---');
  for (let i = 0; i < headerButtons.length; i++) {
    const text = await headerButtons[i].innerText().catch(() => '');
    const html = await headerButtons[i].innerHTML().catch(() => '');
    console.log(`Button ${i}: text="${text}", html="${html.substring(0, 100)}"`);
  }

  // Now let's click on the CompanySelector (should be a button with Building2 icon or账套 text)
  // Looking at the header structure, it should be the 3rd element (after 返回首页 and divider)

  // Try to find the账套 selector button - it should have a Building2 icon or账套 name
  const selectorBtn = page.locator('header button').nth(1); // Second button in header (0 is 返回首页)
  const selectorText = await selectorBtn.innerText().catch(() => '');
  console.log('\n2nd header button text:', selectorText);

  if (selectorText.includes('账套') || selectorText.includes('选择')) {
    console.log('Found CompanySelector button!');
    await selectorBtn.click();
    await page.waitForTimeout(1000);

    const dropdownText = await page.locator('body').innerText();
    console.log('\nDropdown open, contains 切换账套:', dropdownText.includes('切换账套'));

    await page.screenshot({ path: 'selector-dropdown.png', fullPage: true });
  }

  await browser.close();
  console.log('\nTest completed');
}

testHeader().catch(console.error);
