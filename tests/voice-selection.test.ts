import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectPersonaVoice, personaVoiceStyle, personaLiveStyle } from '../utils/voiceSelection';
import type { PersonaVoiceSettings, CustomVoiceItem } from '../types';

test('voice notes and calls share prebuilt/custom selection precedence', () => {
  const settings = { voiceName: 'Fenrir', enableVoiceDesign: true, designedVoiceId: 'voice_design', enableVoiceReplication: true, replicatedVoiceId: 'voicekey_replica' } as PersonaVoiceSettings;
  assert.equal(selectPersonaVoice(settings).id, 'voice_design');
  settings.enableVoiceDesign = false;
  assert.equal(selectPersonaVoice(settings).id, 'voicekey_replica');
  settings.enableVoiceReplication = false;
  assert.deepEqual(selectPersonaVoice(settings), { id: 'Fenrir', custom: false, item: undefined });
  assert.equal(selectPersonaVoice(undefined).id, 'Aoede');
  assert.equal(selectPersonaVoice({ voiceName: 'voice_saved' } as PersonaVoiceSettings).custom, true);
});

test('voice delivery shares design, pitch, pacing and prompting toggle', () => {
  const settings = { voiceName: 'Aoede', enableVoiceDesign: true, designedVoiceId: 'voice_design', stylePrompt: 'warm', pitchTone: 'deep', paceSpeed: 'speaking slowly' } as PersonaVoiceSettings;
  const voice = selectPersonaVoice(settings, undefined, [{ id: 'voice_design', promptDescription: 'soft British voice' } as CustomVoiceItem]);
  assert.equal(personaVoiceStyle(settings, voice, 'manner: casual'), 'custom vocal design: soft British voice, warm, speaking slowly, deep, casual');
  assert.equal(personaVoiceStyle({ ...settings, enableVoicePrompting: false }, voice, 'casual'), 'custom vocal design: soft British voice');
});

test('Live reference voice is not overridden by duplicate design text, descriptor defaults or pitch', () => {
  const settings = { voiceName: 'Fenrir', enableVoiceDesign: true, designedVoiceId: 'voice_design', stylePrompt: 'soft British voice', pitchTone: 'very high', paceSpeed: 'speaking slowly' } as PersonaVoiceSettings;
  const voice = selectPersonaVoice(settings, undefined, [{ id: 'voice_design', promptDescription: 'soft British voice' } as CustomVoiceItem]);
  assert.equal(personaLiveStyle(settings, voice, 'casual English'), 'speaking slowly, casual English');
  assert.equal(personaLiveStyle({ ...settings, stylePrompt: 'warm' }, voice), 'warm, speaking slowly');
  assert.equal(personaLiveStyle({ ...settings, enableVoicePrompting: false }, voice), '');
  assert.equal(personaLiveStyle({ voiceName: 'Fenrir' } as any, selectPersonaVoice({ voiceName: 'Fenrir' } as any)), '');
});
