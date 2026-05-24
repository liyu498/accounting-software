const { chromium } = require('playwright-core');

async function testWebE2E() {
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

  try {
    // 1. 访问登录页面
    console.log('1. 访问登录页面...');
    await page.goto('http://localhost:1420');
    await page.waitForTimeout(2000);
    console.log('页面标题:', await page.title());

    // 2. 登录
    console.log('\n2. 登录中...');
    await page.locator('input').first().fill('admin');
    await page.locator('input').nth(1).fill('admin123');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);

    console.log('登录后URL:', page.url());

    // 3. 检查页面内容
    const bodyText = await page.locator('body').innerText();
    console.log('\n3. 页面内容检查:');
    console.log('- 包含"会计软件":', bodyText.includes('会计软件'));
    console.log('- 包含"新建凭证":', bodyText.includes('新建凭证'));
    console.log('- 包含"客户":', bodyText.includes('客户'));

    // 4. 截图
    await page.screenshot({ path: 'e2e-after-login.png', fullPage: true });
    console.log('\n4. 截图已保存: e2e-after-login.png');

    // 5. 检查控制台错误
    const errors = consoleMessages.filter(m => m.type === 'error');
    console.log('\n5. 控制台错误数量:', errors.length);
    if (errors.length > 0) {
      errors.slice(0, 3).forEach(e => console.log('  -', e.text.substring(0, 100)));
    }

    console.log('\n✅ 网页端基础测试完成');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  } finally {
    await browser.close();
  }
}

testWebE2E().catch(console.error);
