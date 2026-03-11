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

  // P1: Open new game, click Vs Friend, Create Room
  await p1.click('#new-game');
  await p1.waitForTimeout(400);
  await p1.click('button:has-text("Vs Friend")');
  await p1.waitForTimeout(400);
  await p1.click('#mp-create-room-btn');
  await p1.waitForTimeout(1000);

  const roomCode = await p1.textContent('#mp-room-code');
  console.log('Room code:', roomCode.trim());

  // P2: Open new game, click Vs Friend, enter code, Join
  await p2.click('#new-game');
  await p2.waitForTimeout(400);
  await p2.click('button:has-text("Vs Friend")');
  await p2.waitForTimeout(400);
  await p2.fill('#mp-join-code', roomCode.trim());
  await p2.click('#mp-join-room-btn');
  await p2.waitForTimeout(1000);

  const p1Lobby = await p1.$('#mp-lobby:not(.hidden)');
  const p2Lobby = await p2.$('#mp-lobby:not(.hidden)');
  console.log('P1 in lobby:', !!p1Lobby);
  console.log('P2 in lobby:', !!p2Lobby);
  if (!p1Lobby || !p2Lobby) { await browser.close(); process.exit(1); }
  console.log('SUCCESS: Both players in lobby!');

  // Check X close button exists, no Leave button
  const closeBtn = await p1.$('#mp-lobby-close');
  const leaveBtn = await p1.$('#mp-lobby-leave');
  console.log('X close button exists:', !!closeBtn);
  console.log('Leave button gone:', !leaveBtn);

  // Test immediate setting change: P1 toggles Chess960
  const tc960Before = await p1.textContent('#mp-lobby-960');
  console.log('P1 960 before:', tc960Before.trim());
  await p1.click('#mp-lobby-960-btn');
  await p1.waitForTimeout(600);

  const tc960P1After = await p1.textContent('#mp-lobby-960');
  const tc960P2After = await p2.textContent('#mp-lobby-960');
  console.log('P1 960 after:', tc960P1After.trim());
  console.log('P2 960 after:', tc960P2After.trim());
  console.log('Setting applied on P1:', tc960P1After.trim() !== tc960Before.trim());
  console.log('Setting synced to P2:', tc960P2After.trim() === tc960P1After.trim());

  // Check ready states reset after change
  const p1ReadyClasses = await p1.getAttribute('#mp-lobby-ready-you', 'class');
  console.log('P1 ready indicator (should not be "ready" class):', p1ReadyClasses);

  // Both click Ready
  await p1.click('#mp-lobby-ready-btn');
  await p1.waitForTimeout(300);
  const p1ReadyClassesAfter = await p1.getAttribute('#mp-lobby-ready-you', 'class');
  const p2ReadyOppClasses = await p2.getAttribute('#mp-lobby-ready-opp', 'class');
  console.log('P1 ready indicator after click:', p1ReadyClassesAfter);
  console.log('P2 sees opp ready indicator:', p2ReadyOppClasses);

  await p2.click('#mp-lobby-ready-btn');
  await p2.waitForTimeout(1500);

  const p1LobbyHidden = await p1.$('#mp-lobby.hidden');
  const p2LobbyHidden = await p2.$('#mp-lobby.hidden');
  console.log('P1 game started (lobby hidden):', !!p1LobbyHidden);
  console.log('P2 game started (lobby hidden):', !!p2LobbyHidden);
  if (p1LobbyHidden && p2LobbyHidden) {
    console.log('SUCCESS: Game started after both ready!');
  } else {
    console.log('FAIL: Game did not start');
  }

  await browser.close();
})();
