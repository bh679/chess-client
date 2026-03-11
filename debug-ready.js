const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const p1 = await ctx1.newPage();
  const p2 = await ctx2.newPage();

  // Capture console logs
  p1.on('console', msg => console.log('P1 console:', msg.text()));
  p2.on('console', msg => console.log('P2 console:', msg.text()));

  await p1.goto('http://localhost:3012/');
  await p2.goto('http://localhost:3012/');
  await p1.waitForTimeout(500);
  await p2.waitForTimeout(500);

  await p1.click('#new-game');
  await p1.waitForTimeout(400);
  await p1.click('[data-mode="friend"]');
  await p1.waitForTimeout(400);
  await p1.click('#ng-create-room');
  await p1.waitForTimeout(1200);

  const roomCode = await p1.textContent('#mp-room-code');
  console.log('Room code:', roomCode.trim());

  await p2.click('#new-game');
  await p2.waitForTimeout(400);
  await p2.click('[data-mode="friend"]');
  await p2.waitForTimeout(400);
  await p2.fill('#ng-join-code', roomCode.trim());
  await p2.click('#ng-join-room');
  await p2.waitForTimeout(1200);

  // Both click Ready
  await p1.click('#mp-lobby-ready-btn');
  await p1.waitForTimeout(500);
  await p2.click('#mp-lobby-ready-btn');
  await p2.waitForTimeout(2000);

  // Check game state
  const p1Status = await p1.textContent('#status').catch(() => 'N/A');
  const p2Status = await p2.textContent('#status').catch(() => 'N/A');
  console.log('P1 status:', p1Status);
  console.log('P2 status:', p2Status);

  const p1LobbyClass = await p1.getAttribute('#mp-lobby', 'class');
  const p2LobbyClass = await p2.getAttribute('#mp-lobby', 'class');
  console.log('P1 lobby class:', p1LobbyClass);
  console.log('P2 lobby class:', p2LobbyClass);

  const p1GameControls = await p1.getAttribute('#mp-game-controls', 'class');
  console.log('P1 game controls class:', p1GameControls);

  await browser.close();
})();
