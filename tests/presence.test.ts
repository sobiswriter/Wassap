import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, mock } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function fixture() {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const source = app.slice(app.indexOf('  const isBusyChatStatus ='), app.indexOf('  const markUserMessagesDelivered ='));
  const context: any = {
    settingsRef: { current: { enableDynamicOnlinePresence: true, enableTextStacking: true, textStackingDelay: 10 } },
    chatsRef: { current: [{ id: 'maya', status: 'online' }] },
    personaOnlineTimersRef: { current: {} }, personaStatusWatchdogTimersRef: { current: {} },
    personaTurnTokensRef: { current: {} }, personaAbortControllersRef: { current: {} },
    aiResponseTimeoutsRef: { current: {} }, aiRespondingChatsRef: { current: new Set() }, callRef: { current: null },
    window: { setTimeout }, clearTimeout, Date, console, getFormattedTime: () => '12:00',
  };
  context.setChats = (update: any) => { context.chatsRef.current = update(context.chatsRef.current); };
  runInNewContext(ts.transpileModule(source + '\nglobalThis.presence = { schedulePersonaOffline, cancelPersonaOfflineTimer, getPersonaOnlineDuration };', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return context;
}

test('dynamic online duration matches the advertised setting and refreshes after each reply', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const f = fixture();
    assert.equal(f.presence.getPersonaOnlineDuration(), 7500);
    assert.equal(f.presence.getPersonaOnlineDuration(12000), 12000);
    f.presence.schedulePersonaOffline('maya');
    mock.timers.tick(7000);
    assert.equal(f.chatsRef.current[0].status, 'online');
    f.presence.schedulePersonaOffline('maya');
    mock.timers.tick(7499);
    assert.equal(f.chatsRef.current[0].status, 'online');
    mock.timers.tick(1);
    assert.equal(f.chatsRef.current[0].status, 'offline');
    assert.equal(f.chatsRef.current[0].lastSeenTime, '12:00');
    f.settingsRef.current.enableDynamicOnlinePresence = false;
    assert.equal(f.presence.getPersonaOnlineDuration(), 35000);
    f.settingsRef.current.enableDynamicOnlinePresence = true;
    f.settingsRef.current.enableTextStacking = false;
    assert.equal(f.presence.getPersonaOnlineDuration(), 35000);
  } finally { mock.timers.reset(); }
});

test('a queued stack keeps the persona online and an occupied expiry checks again after work ends', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const f = fixture();
    f.aiResponseTimeoutsRef.current.maya = 123;
    f.presence.schedulePersonaOffline('maya');
    mock.timers.tick(7500);
    assert.equal(f.chatsRef.current[0].status, 'online', 'Do not go offline during a queued stack');
    delete f.aiResponseTimeoutsRef.current.maya;
    f.aiRespondingChatsRef.current.add('maya');
    mock.timers.tick(7500);
    assert.equal(f.chatsRef.current[0].status, 'online');
    f.aiRespondingChatsRef.current.delete('maya');
    mock.timers.tick(7500);
    assert.equal(f.chatsRef.current[0].status, 'offline', 'An occupied expiry must not lose the eventual offline transition');
  } finally { mock.timers.reset(); }
});
