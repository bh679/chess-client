const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3012/');
  await page.waitForTimeout(500);
  await page.click('#new-game');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Vs Friend")');
  await page.waitForTimeout(600);
  
  // Check what's visible now
  const mpModal = await page.$('#mp-modal:not(.hidden)');
  const ngModal = await page.$('#ng-modal:not(.hidden)');
  console.log('MP modal visible after Vs Friend:', !!mpModal);
  console.log('NG modal visible after Vs Friend:', !!ngModal);
  
  const visibleBtns = [];
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    if (await btn.isVisible()) {
      visibleBtns.push((await btn.textContent()).trim().substring(0, 50));
    }
  }
  console.log('Visible buttons:', visibleBtns);
  
  // Check mp-menu visibility
  const mpMenu = await page.$('#mp-menu:not(.hidden)');
  console.log('MP menu visible:', !!mpMenu);
  
  await browser.close();
})();
