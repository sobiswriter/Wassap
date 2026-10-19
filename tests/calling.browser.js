// Isolated synthetic microphone + mocked Live/diary transport. No real credentials or paid requests.
async (page) => {
  const appUrl = new URL(page.url()).origin;
  const context = await page.context().browser().newContext({ serviceWorkers: 'block', permissions: ['notifications'], viewport: { width: 390, height: 844 } });
  page = await context.newPage();
  page.setDefaultTimeout(10000);
  const check = (value, message) => { if (!value) throw new Error(message); };
  let awaitSetup;
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  let diaryBody; let audioFrames = 0; const connections = []; let prompt = ''; const contextRequests = []; const studioSummaries = [];
  await context.route('**/api/gemini/live', route => { contextRequests.push(route.request().postDataJSON()); return route.fulfill({ json: { summary: 'The user and Maya last discussed meeting in Kyoto.' } }); });
  await context.route('**/api/gemini/auth', route => route.fulfill({ json: { ok: true } }));
  await context.route('**/api/gemini/diary', async route => { diaryBody = route.request().postDataJSON(); await route.fulfill({ json: { text: 'I loved our call. We remembered Kyoto first and promised to meet by the river at the end.' } }); });
  await context.route('https://generativelanguage.googleapis.com/**', route => { studioSummaries.push(route.request().postDataJSON()); return route.fulfill({ json: { candidates: [{ content: { role: 'model', parts: [{ text: 'The user and Maya last discussed meeting in Kyoto.' }] } }] } }); });
  await context.routeWebSocket('**/api/gemini/live', socket => {
    connections.push(socket);
    socket.onMessage(data => {
      if (typeof data !== 'string') { audioFrames++; return; }
      const message = JSON.parse(data);
      if (message.type === 'start') {
        prompt = message.prompt;
        if (connections.length === 1) {
          awaitSetup = () => socket.send(JSON.stringify({ setupComplete: {} }));
        } else socket.send(JSON.stringify({ setupComplete: {} }));
        socket.send(JSON.stringify({ sessionResumptionUpdate: { newHandle: 'synthetic-resume' } }));
        if (!message.resume) socket.send(JSON.stringify({ serverContent: { inputTranscription: { text: 'Remember Kyoto from our last chat?' }, outputTranscription: { text: 'Of course, I remember the rain.' }, turnComplete: true } }));
      }
    });
  });
  const pickup = async () => {
    await page.waitForFunction(() => document.querySelector('.call-status')?.textContent === 'Ringing…');
    await page.clock.runFor(12050);
    await page.waitForFunction(() => /^\d+:\d{2}$/.test(document.querySelector('.call-status')?.textContent || ''));
  };
  await context.addInitScript(() => {
    const NativeAudio = window.Audio;
    window.Audio = function(src) { const player = new NativeAudio(src); if (src?.endsWith('/sounds/ringback.wav')) window.__ringback = player; return player; };
    window.Audio.prototype = NativeAudio.prototype;
    window.__callNotifications = [];
    navigator.serviceWorker.getRegistration = async () => ({ active: { postMessage() {} },
      showNotification: async (_title, options) => { window.__callNotifications.push({ ...options, closed: false }); },
      getNotifications: async ({ tag }) => window.__callNotifications.filter(note => note.tag === tag && !note.closed).map(note => ({ close: () => { note.closed = true; } })) });
    const fixture = { id: 'call-persona', name: 'Maya', avatar: '/favicon.svg', about: 'A thoughtful friend', role: 'Friend', speechStyle: 'Casual Hinglish', memoryEnabled: true,
      memoryBubbles: [{ id: 'old-memory', chatId: 'call-persona', title: 'Kyoto trip', startDate: '2026-10-16', endDate: '2026-10-16', summary: 'We visited a temple in Kyoto.', createdAt: '2026-10-16' }],
      voiceSettings: { voiceName: 'Fenrir', frequency: 'off', stylePrompt: 'warm and gentle', pitchTone: 'deep', paceSpeed: 'speaking slowly' }, status: 'offline', lastMessage: 'We met in Kyoto.', lastMessageTime: '10:00', messages: [{ id: 'before-call', text: 'We met in Kyoto.', sender: 'me', timestamp: '10:00', date: '2026-10-18' }] };
    if (!localStorage.getItem('whatsapp_chats')) localStorage.setItem('whatsapp_chats', JSON.stringify([fixture]));
    if (!localStorage.getItem('whatsapp_settings')) localStorage.setItem('whatsapp_settings', JSON.stringify({ aiProvider: 'vertex', theme: 'dark', shareTimeContext: true, selectedModel: 'gemini-3.8-flash' }));
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async constraints => {
      window.__micConstraints = constraints;
      if (sessionStorage.getItem('__denyMic')) throw new DOMException('Denied by synthetic test', 'NotAllowedError');
      const audio = new AudioContext(); const source = audio.createOscillator(); const dest = audio.createMediaStreamDestination();
      source.connect(dest); source.start(); await audio.resume(); window.__callTracks = dest.stream.getTracks(); window.__fixtureAudio = audio;
      if (sessionStorage.getItem('__delayMic')) await new Promise(resolve => { window.__releaseMic = resolve; });
      return dest.stream;
    } });
  });
  try {
    await page.goto(appUrl);
    await page.getByRole('button', { name: 'Open chat with Maya', exact: true }).click();
    await page.clock.install();
    await page.getByRole('button', { name: 'Voice call', exact: true }).click();
    await page.getByRole('dialog', { name: 'Voice call with Maya' }).waitFor();
    await page.waitForFunction(() => document.querySelector('.call-status')?.textContent === 'Ringing…');
    await page.waitForFunction(() => window.__ringback && !window.__ringback.paused && window.__ringback.currentTime > 0);
    await page.getByRole('button', { name: 'Audio', exact: true }).click();
    check(await page.evaluate(() => window.__ringback.muted), 'Audio toggle did not mute ringback');
    await page.getByRole('button', { name: 'Audio', exact: true }).click();
    await page.clock.runFor(5500);
    check(!connections.length && !audioFrames, 'Call connected or transmitted microphone before minimum ringback');
    await page.screenshot({ path: 'output/playwright/call-ringing.png' });
    await page.clock.runFor(6650);
    for (let i = 0; i < 30 && !awaitSetup; i++) await new Promise(resolve => setTimeout(resolve, 100));
    check(!!awaitSetup, 'Handshake was not attempted after the ring delay');
    check(await page.evaluate(() => !window.__ringback.loop), 'Ringback should pause between clips');
    // Media playback runs on real time even while the page clock is controlled.
    await page.evaluate(() => { window.__ringback.currentTime = window.__ringback.duration - 0.15; });
    await new Promise(resolve => setTimeout(resolve, 600));
    check(await page.evaluate(() => window.__ringback.paused), 'Ringback did not pause at the end of its clip');
    // Media's ended event runs in real time; the unit timer test checks the exact boundary.
    await page.clock.runFor(1600);
    check(await page.evaluate(() => !window.__ringback.paused && window.__ringback.currentTime < 1), 'Ringback did not repeat after its gap');
    awaitSetup();

    await page.waitForFunction(() => /^\d+:\d{2}$/.test(document.querySelector('.call-status')?.textContent || ''));
    check(await page.evaluate(() => window.__ringback.paused), 'Ringback continued after pickup');
    connections[0].send(JSON.stringify({ goAway: { timeLeft: '30s' } }));
    await page.clock.runFor(35000);
    check(connections.length === 1 && await page.locator('.call-status').innerText() !== 'Call ended', 'A warning or 30-second timer ended the call');
    const burst = Buffer.alloc(4 * 24000 * 2).toString('base64');
    for (let i = 0; i < 3; i++) connections[0].send(JSON.stringify({ serverContent: { modelTurn: { parts: [{ inlineData: { data: burst, mimeType: 'audio/pcm;rate=24000' } }] } } }));
    await page.waitForFunction(() => !!document.querySelector('.call-screen'));
    check(!await page.getByRole('button', { name: 'Return to chat', exact: true }).isVisible(), 'A normal audio burst ended the call');

    check(prompt.includes('A thoughtful friend') && prompt.includes('Kyoto') && prompt.includes('LIVE VOICE CALL'), 'Persona/summary context missing');
    check(!prompt.includes('temple') && !prompt.includes('We met in Kyoto.') && !prompt.includes('Casual Hinglish'), 'Raw chats/memories/persona extras leaked into Live');
    check(contextRequests[0].messages.length === 1 && Object.keys(contextRequests[0]).length === 1, 'Call summary received excessive context');
    check(prompt.includes('warm and gentle, speaking slowly') && !prompt.includes('speaking slowly, deep'), 'Live should preserve delivery without overriding the session voice pitch');
    await page.clock.runFor(500);
    for (let i = 0; i < 30 && !audioFrames; i++) await new Promise(resolve => setTimeout(resolve, 100));
    check(audioFrames > 0, 'Microphone PCM frames missing');
    check(await page.evaluate(() => window.__micConstraints.audio.echoCancellation && window.__micConstraints.audio.noiseSuppression && window.__micConstraints.audio.autoGainControl === false), 'Noise/echo capture constraints incorrect');
    await page.getByRole('button', { name: 'Mute', exact: true }).click();
    check(await page.evaluate(() => window.__callTracks.every(track => !track.enabled)), 'Mute did not disable microphone tracks');
    await page.getByRole('button', { name: 'Minimize call', exact: true }).click();
    await page.getByRole('region', { name: 'Ongoing persona call' }).waitFor();
    check(await page.locator('#root').evaluate(root => !root.inert), 'Minimized call blocks chat');
    await page.getByRole('button', { name: /Maya.*Tap to return/ }).click();
    await page.getByRole('button', { name: 'Mute', exact: true }).click();
    await page.getByRole('button', { name: 'Transcript', exact: true }).click();
    check((await page.getByRole('region', { name: 'Call transcript' }).innerText()).includes('Kyoto'), 'Transcript missing');
    await page.getByRole('button', { name: 'Transcript', exact: true }).click();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      check(await page.locator('.call-screen').evaluate(el => el.scrollWidth <= el.clientWidth), `Call overflows at ${width}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'output/playwright/call-full.png' });
    connections[0].close();
    await page.waitForFunction(() => document.querySelector('.call-status')?.textContent === 'Reconnecting…');
    await page.clock.runFor(1500);
    await page.waitForFunction(() => /^\d+:\d{2}$/.test(document.querySelector('.call-status')?.textContent || ''));
    check(connections.length === 2, 'Call did not resume on a new connection');
    connections.at(-1).send(JSON.stringify({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: Buffer.alloc(48000).toString('base64') } }] } } }));
    await page.locator('.call-speaking').waitFor();
    connections.at(-1).send(JSON.stringify({ serverContent: { interrupted: true } }));
    await page.locator('.call-speaking').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Transcript', exact: true }).click();
    check((await page.getByRole('region', { name: 'Call transcript' }).innerText()).includes('…'), 'Interrupted queued speech was recorded as fully heard');
    await page.getByRole('button', { name: 'Transcript', exact: true }).click();
    connections.at(-1).send(JSON.stringify({ serverContent: { inputTranscription: { text: 'Meet me by the river tomorrow.' }, outputTranscription: { text: 'I promise I will be there.' }, turnComplete: true } }));
    await page.clock.fastForward(62000);
    await page.getByRole('button', { name: 'End call', exact: true }).click();
    check(await page.evaluate(() => window.__callTracks.every(track => track.readyState === 'ended')), 'Hang-up left microphone running');
    await page.getByRole('button', { name: 'Return to chat', exact: true }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('whatsapp_chats')).some(chat => chat.memoryBubbles?.some(memory => memory.callId)));
    check(diaryBody.kind === 'call-summary' && diaryBody.persona.name === 'Maya', 'Call did not request a summary from its own persona');
    check(diaryBody.messageHistory[0].text.includes('Kyoto') && diaryBody.messageHistory[0].text.includes('river tomorrow'), 'Summary omitted beginning/end of call');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('whatsapp_chats')).some(chat => chat.messages.some(message => message.call?.diary === 'saved')));
    await page.reload();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('whatsapp_chats')).find(chat => chat.id === 'call-persona'));
    check(saved.messages.filter(message => message.call).length === 1, 'Call history duplicated');
    const savedCall = saved.messages.find(message => message.call);
    check(savedCall.isEvent && savedCall.text.includes(new Date(savedCall.call.startedAt).toISOString()) && savedCall.text.includes('Call summary:') && savedCall.call.transcript.length >= 4, 'Dated call conversation missing from ordinary chat history');
    check(saved.memoryBubbles.length === 2 && saved.messages.some(message => message.id === 'before-call'), 'Old data lost or diary duplicated');
    check(saved.memoryBubbles.find(memory => memory.callId).title.includes('Call Summary'), 'New call memory is still labeled as a diary');
    await page.getByRole('button', { name: 'Open chat with Maya', exact: true }).click();
    for (const [dark, background, foreground] of [[false, 'rgb(217, 253, 211)', 'rgb(17, 27, 33)'], [true, 'rgb(0, 92, 75)', 'rgb(233, 237, 239)']]) {
      await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark);
      const colors = await page.locator('.call-history-card').first().evaluate(el => ({ background: getComputedStyle(el).backgroundColor, foreground: getComputedStyle(el).color }));
      check(colors.background === background && colors.foreground === foreground, `Call history theme contrast incorrect: ${JSON.stringify(colors)}`);
      if (!dark) await page.screenshot({ path: 'output/playwright/call-history-light.png' });
    }
    // Exercise the real installed SDK's personal-key WebSocket serialization, still fully mocked.
    let studioSetup; let studioAudio = false;
    await context.routeWebSocket('wss://generativelanguage.googleapis.com/**', socket => {
      socket.onMessage(raw => {
        const data = JSON.parse(String(raw));
        if (data.setup) { studioSetup = data.setup; socket.send(JSON.stringify({ setupComplete: {} })); socket.send(JSON.stringify({ serverContent: { inputTranscription: { text: 'Remember the short-call promise.' }, outputTranscription: { text: 'I will remember our promise.' }, turnComplete: true } })); }
        if (data.realtimeInput?.audio || data.realtimeInput?.mediaChunks) studioAudio = true;
      });
    });
    await context.addInitScript(() => {
      if (sessionStorage.getItem('__locked')) localStorage.setItem('whatsapp_settings', JSON.stringify({ aiProvider: 'vertex', theme: 'light' }));
      else if (sessionStorage.getItem('__studio')) localStorage.setItem('whatsapp_settings', JSON.stringify({ aiProvider: 'studio', apiKey: 'synthetic-never-sent', theme: 'dark', selectedLiveModel: 'gemini-3.8-live-extended-thinking' }));
    });
    await page.evaluate(() => sessionStorage.setItem('__studio', '1'));
    await page.reload();
    await page.getByRole('button', { name: 'Open chat with Maya', exact: true }).click();
    await page.getByRole('button', { name: 'Voice call', exact: true }).click();
    await pickup();
    check(studioSetup.model.endsWith('gemini-3.8-live-extended-thinking'), 'Studio SDK did not select Extended Thinking');
    check(studioSetup.generationConfig.thinkingConfig.thinkingLevel === 'LOW', 'Thinking config was not serialized by the installed SDK');
    check(studioSetup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName === 'Fenrir', 'Call ignored the voice-note voice');
    check(studioSetup.realtimeInputConfig.automaticActivityDetection.startOfSpeechSensitivity === 'START_SENSITIVITY_LOW' && studioSetup.realtimeInputConfig.automaticActivityDetection.silenceDurationMs === 900, 'Studio VAD tuning missing');
    for (let i = 0; i < 30 && !studioAudio; i++) await new Promise(resolve => setTimeout(resolve, 100));
    check(studioAudio, 'Studio microphone frames missing');
    await page.getByRole('button', { name: 'End call', exact: true }).click();
    await page.getByRole('button', { name: 'Return to chat', exact: true }).click();
    check(await page.evaluate(() => window.__callTracks.every(track => track.readyState === 'ended')), 'Studio hang-up left microphone running');
    check((await page.evaluate(() => JSON.parse(localStorage.getItem('whatsapp_chats'))[0].memoryBubbles)).length === 2, 'Short call generated a diary');
    await page.getByText('View transcript', { exact: true }).last().click();
    await page.locator('.call-history-details div').filter({ hasText: 'You: Remember the short-call promise' }).waitFor();
    await page.screenshot({ path: 'output/playwright/call-short-transcript.png' });
    check(await page.evaluate(() => JSON.parse(localStorage.getItem('whatsapp_chats'))[0].messages.some(message => message.call?.transcript?.length === 2 && message.text.includes('short-call promise'))), 'Short transcript missing from AI chat history');
    await page.reload();
    await page.getByRole('button', { name: 'Open chat with Maya', exact: true }).click();
    await page.getByText('View transcript', { exact: true }).last().click();
    await page.locator('.call-history-details div').filter({ hasText: 'You: Remember the short-call promise' }).waitFor();
    await page.getByRole('button', { name: 'Voice call', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.call-status')?.textContent === 'Ringing…');
    for (let i = 0; i < 30 && !studioSummaries.some(body => JSON.stringify(body).includes('short-call promise')); i++) await new Promise(resolve => setTimeout(resolve, 50));
    check(studioSummaries.some(body => JSON.stringify(body).includes('short-call promise')), 'Next call context omitted the previous short transcript');
    await page.getByRole('button', { name: 'End call', exact: true }).click();
    check(await page.evaluate(() => window.__callTracks.every(track => track.readyState === 'ended')), 'Ending ringback left microphone running');
    await page.getByRole('button', { name: 'Return to chat', exact: true }).click();
    await page.locator('.call-history-card').filter({ hasText: 'Cancelled' }).waitFor();
    await page.evaluate(() => sessionStorage.setItem('__delayMic', '1'));
    await page.getByRole('button', { name: 'Voice call', exact: true }).click();
    await page.waitForFunction(() => !!window.__releaseMic);
    await page.getByRole('button', { name: 'End call', exact: true }).click();
    await page.evaluate(() => window.__releaseMic());
    await page.waitForFunction(() => window.__callTracks.every(track => track.readyState === 'ended'));
    await page.getByRole('button', { name: 'Return to chat', exact: true }).click();
    await page.evaluate(() => { sessionStorage.removeItem('__delayMic'); sessionStorage.setItem('__denyMic', '1'); });
    await page.getByRole('button', { name: 'Voice call', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Allow microphone access' }).waitFor();
    await page.getByRole('button', { name: 'Return to chat', exact: true }).click();
    await page.getByText('Allow microphone access to start your call.', { exact: true }).waitFor();
    await page.evaluate(() => sessionStorage.removeItem('__denyMic'));
    await page.getByRole('button', { name: 'Voice call', exact: true }).click();
    await pickup();
    await page.waitForFunction(() => window.__callNotifications.some(note => !note.closed));
    await page.evaluate(() => {
      const notification = window.__callNotifications.filter(note => !note.closed).at(-1);
      if (!notification.actions?.some(action => action.action === 'end-call')) throw new Error('End action missing');
      navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'CALL_END', callId: 'stale-call' } }));
      if (window.__callTracks.some(track => track.readyState === 'ended')) throw new Error('Stale notification ended current call');
      navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'CALL_END', callId: notification.data.callId } }));
    });
    await page.getByRole('button', { name: 'Return to chat', exact: true }).waitFor();
    check(await page.evaluate(() => window.__callTracks.every(track => track.readyState === 'ended')), 'Notification End left microphone running');
    await page.getByRole('button', { name: 'Return to chat', exact: true }).click();
    await context.route('https://generativelanguage.googleapis.com/**', route => route.fulfill({ status: 503, json: { error: { message: 'Synthetic context failure' } } }));
    await page.getByRole('button', { name: 'Voice call', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Recent chat context could not be prepared' }).waitFor();
    check(await page.evaluate(() => window.__callTracks.every(track => track.readyState === 'ended')), 'Context failure left microphone running');
    await page.getByRole('button', { name: 'Return to chat', exact: true }).click();
    const callCount = await page.locator('.call-history-card').count();
    await context.route('**/api/gemini/auth', route => route.fulfill({ status: 401, json: { ok: false } }));
    await page.evaluate(() => { sessionStorage.removeItem('__studio'); sessionStorage.setItem('__locked', '1'); });
    await page.reload();
    await page.getByRole('button', { name: 'Open chat with Maya', exact: true }).click();
    await page.getByRole('button', { name: 'Voice call', exact: true }).click();
    await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
    check(await page.locator('.call-history-card').count() === callCount, 'Locked cloud created a failed call');
    check(await page.locator('.call-screen').count() === 0, 'Locked cloud opened microphone/call UI');
    check(!errors.length, `Runtime errors: ${errors.join('; ')}`);
    return 'Both provider transports, PCM capture/playback/interruption, mute, compact mode, context, responsive widths, end cleanup, full-call diary, short-call exclusion and persistence passed.';
  } catch (error) { await page.screenshot({ path: 'output/playwright/calling-test-failure.png' }); throw error; }
  finally { await context.close(); }
}
