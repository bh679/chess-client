const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const p1 = await ctx1.newPage();
  const p2 = await ctx2.newPage();

  await p1.goto('http://localhost:3012/');
  await p2.goto('http://localhost:3012/');
  await p1.waitForTimeout(500);

  // P1 opens multiplayer and creates a room
  await p1.click('#new-game');
  await p1.waitForTimeout(300);
  await p1.click('text=Vs Friend');
  await p1.waitForTimeout(300);
  await p1.click('text=Create Room');
  await p1.waitForTimeout(1000);

  // Get room code
  const roomCode = await p1.textContent('#mp-room-code');
  console.log('Room code:', roomCode.trim());

  // P2 opens multiplayer and joins
  await p2.click('#new-game');
  await p2.waitForTimeout(300);
  await p2.click('text=Vs Friend');
  await p2.waitForTimeout(300);
  await p2.fill('#mp-join-code', roomCode.trim());
  await p2.click('#mp-join-room-btn');
  await p2.waitForTimeout(1000);

  // Check lobby visible on both
  const p1Lobby = await p1.$('#mp-lobby:not(.hidden)');
  const p2Lobby = await p2.$('#mp-lobby:not(.hidden)');
  console.log('P1 in lobby:', !!p1Lobby);
  console.log('P2 in lobby:', !!p2Lobby);

  if (!p1Lobby || !p2Lobby) {
    console.log('FAIL: Not both in lobby');
    await browser.close();
    process.exit(1);
  }
  console.log('SUCCESS: Both players in lobby!');

  // Check X close button exists (no Leave button)
  const closeBtn = await p1.$('#mp-lobby-close');
  const leaveBtn = await p1.$('#mp-lobby-leave');
  console.log('X close button exists:', !!closeBtn);
  console.log('Leave button gone:', !leaveBtn);

  // Test immediate setting change: P1 toggles Chess960
  const tc960Before = await p1.textContent('#mp-lobby-960');
  console.log('P1 960 before:', tc960Before.trim());
  await p1.click('#mp-lobby-960-btn');
  await p1.waitForTimeout(500);

  const tc960P1After = await p1.textContent('#mp-lobby-960');
  const tc960P2After = await p2.textContent('#mp-lobby-960');
  console.log('P1 960 after:', tc960P1After.trim());
  console.log('P2 960 after:', tc960P2After.trim());
  
  const settingApplied = tc960P1After.trim() !== tc960Before.trim() && tc960P2After.trim() === tc960P1After.trim();
  console.log('Setting applied immediately on both sides:', settingApplied);

  // Both click Ready
  await p1.click('#mp-lobby-ready-btn');
  await p2.click('#mp-lobby-ready-btn');
  await p2.waitForTimeout(1500);

  // Check game started
  const p1GameStarted = await p1.$('#mp-lobby.hidden');
  const p2GameStarted = await p2.$('#mp-lobby.hidden');
  console.log('P1 game started:', !!p1GameStarted);
  console.log('P2 game started:', !!p2GameStarted);

  if (p1GameStarted && p2GameStarted) {
    console.log('SUCCESS: Game started after both ready!');
  } else {
    console.log('FAIL: Game did not start');
  }

  await browser.close();
})();
