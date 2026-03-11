const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const p1 = await ctx1.newPage();
  const p2 = await ctx2.newPage();

  await p1.goto('http://localhost:3012/');
  await p2.goto('http://localhost:3012/');
  await p1.waitForTimeout(800);
  await p2.waitForTimeout(800);

  // P1: Click online multiplayer button directly
  await p1.click('#new-game');
  await p1.waitForTimeout(500);

  // Log what's visible after clicking new-game
  const ngModal = await p1.$('#ng-modal:not(.hidden)');
  const mpModal = await p1.$('#mp-modal:not(.hidden)');
  console.log('New game modal visible:', !!ngModal);
  console.log('MP modal visible:', !!mpModal);

  // Find and click Vs Friend
  const buttons = await p1.$$('button');
  for (const btn of buttons) {
    const text = await btn.textContent();
    const visible = await btn.isVisible();
    if (visible) console.log('Visible button:', text.trim());
  }

  await browser.close();
})();
