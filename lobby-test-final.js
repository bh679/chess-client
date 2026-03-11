const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const p1 = await ctx1.newPage();
  const p2 = await ctx2.newPage();

  await p1.goto('http://localhost:3012/');
  await p2.goto('http://localhost:3012/');
  await p1.waitForTimeout(500);
  await p2.waitForTimeout(500);

  // P1: New Game → Vs Friend → Create Room
  await p1.click('#new-game');
  await p1.waitForTimeout(400);
  await p1.click('[data-mode="friend"]');
  await p1.waitForTimeout(400);
  await p1.click('#ng-create-room');
  await p1.waitForTimeout(1200);

  const roomCode = await p1.textContent('#mp-room-code');
  console.log('Room code:', roomCode.trim());

  // P2: New Game → Vs Friend → enter code → Join
  await p2.click('#new-game');
  await p2.waitForTimeout(400);
  await p2.click('[data-mode="friend"]');
  await p2.waitForTimeout(400);
  await p2.fill('#ng-join-code', roomCode.trim());
  await p2.click('#ng-join-room');
  await p2.waitForTimeout(1200);

  // Verify lobby
  const p1LobbyVisible = await p1.isVisible('#mp-lobby');
  const p2LobbyVisible = await p2.isVisible('#mp-lobby');
  console.log('P1 in lobby:', p1LobbyVisible);
  console.log('P2 in lobby:', p2LobbyVisible);
  if (!p1LobbyVisible || !p2LobbyVisible) { console.log('FAIL: lobby'); await browser.close(); process.exit(1); }
  console.log('SUCCESS: Both players in lobby!');

  // Verify X close button, no Leave button
  console.log('X close button exists:', await p1.isVisible('#mp-lobby-close'));
  console.log('Leave button gone:', !(await p1.$('#mp-lobby-leave')));

  // Screenshot: initial lobby
  await p1.screenshot({ path: 'test-results/lobby-initial-p1.png' });
  await p2.screenshot({ path: 'test-results/lobby-initial-p2.png' });

  // Test immediate setting change
  const tc960Before = await p1.textContent('#mp-lobby-960');
  await p1.click('#mp-lobby-960-btn');
  await p1.waitForTimeout(600);
  const tc960P1After = await p1.textContent('#mp-lobby-960');
  const tc960P2After = await p2.textContent('#mp-lobby-960');
  console.log('P1 960 before:', tc960Before.trim(), '→ after:', tc960P1After.trim());
  console.log('P2 960 synced to:', tc960P2After.trim());
  console.log('Setting applied immediately:', tc960P1After.trim() !== tc960Before.trim());
  console.log('Setting synced to P2:', tc960P2After.trim() === tc960P1After.trim());

  await p1.screenshot({ path: 'test-results/lobby-after-change-p1.png' });
  await p2.screenshot({ path: 'test-results/lobby-after-change-p2.png' });

  // Both ready
  await p1.click('#mp-lobby-ready-btn');
  await p1.waitForTimeout(400);
  console.log('P2 sees opp ready:', (await p2.getAttribute('#mp-lobby-ready-opp', 'class')).includes('ready'));
  await p2.screenshot({ path: 'test-results/lobby-p1-ready-p2-view.png' });

  await p2.click('#mp-lobby-ready-btn');
  await p2.waitForTimeout(1500);

  const p1Status = await p1.textContent('#status');
  const p2Status = await p2.textContent('#status');
  const p1ModalHidden = !(await p1.isVisible('#mp-modal'));
  const p2ModalHidden = !(await p2.isVisible('#mp-modal'));
  console.log('P1 status:', p1Status);
  console.log('P2 status:', p2Status);
  console.log('P1 modal closed:', p1ModalHidden);
  console.log('P2 modal closed:', p2ModalHidden);

  if ((p1Status.includes("turn") || p1Status.includes("Turn")) && p1ModalHidden) {
    console.log('SUCCESS: Game started after both ready!');
  } else {
    console.log('FAIL: Game did not start properly');
  }

  await p1.screenshot({ path: 'test-results/game-started-p1.png' });
  await p2.screenshot({ path: 'test-results/game-started-p2.png' });

  await browser.close();
})();
