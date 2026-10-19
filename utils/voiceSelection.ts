import type { CustomVoiceItem, PersonaVoiceSettings } from '../types';
import { getVoiceDescriptor } from '../constants';

export function selectPersonaVoice(settings?: PersonaVoiceSettings, fallback?: string, voices: CustomVoiceItem[] = []) {
  const id = settings?.enableVoiceDesign && settings.designedVoiceId ? settings.designedVoiceId
    : settings?.enableVoiceReplication && settings.replicatedVoiceId ? settings.replicatedVoiceId
    : fallback || settings?.voiceName || 'Aoede';
  const custom = !!((settings?.enableVoiceDesign && settings.designedVoiceId) || (settings?.enableVoiceReplication && settings.replicatedVoiceId)
    || id.startsWith('voice_') || id.startsWith('voicekey_'));
  return { id, custom, item: voices.find(voice => voice.id === id) };
}

export function personaVoiceStyle(settings: PersonaVoiceSettings | undefined, voice: ReturnType<typeof selectPersonaVoice>, speechStyle?: string) {
  const descriptor = getVoiceDescriptor(voice.id);
  const parts = voice.item?.promptDescription ? [`custom vocal design: ${voice.item.promptDescription}`] : [];
  if (settings?.enableVoicePrompting !== false) {
    parts.push(settings?.stylePrompt || (!voice.custom ? descriptor?.stylePrompt || descriptor?.trait || 'natural and expressive' : ''));
    if (settings?.paceSpeed !== 'default') parts.push(settings?.paceSpeed || '');
    parts.push(settings?.pitchTone || '', speechStyle?.replace(/^manner:\s*/i, '') || '');
  }
  return parts.filter(Boolean).join(', ');
}

export function personaTtsStyle(settings: PersonaVoiceSettings | undefined, voice: ReturnType<typeof selectPersonaVoice>, speechStyle?: string) {
  if (settings?.enableVoicePrompting === false) return '';
  return [settings?.stylePrompt || (!voice.custom ? getVoiceDescriptor(voice.id)?.stylePrompt : ''),
    settings?.paceSpeed !== 'default' ? settings?.paceSpeed : '', settings?.pitchTone,
    speechStyle?.replace(/^manner:\s*/i, '')].filter(Boolean).join(', ');
}
