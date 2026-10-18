import type { PersonaBackupData } from '../types';

export function parsePersonaBackup(raw: unknown): PersonaBackupData['persona'] {
  const object = (value: unknown): value is Record<string, any> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
  const fail = (): never => { throw new Error('Invalid persona backup: check the names, settings, schedules, and memories.'); };
  if (!object(raw)) return fail();
  const data = raw.persona === undefined ? raw : raw.persona;
  if (!object(data) || typeof data.name !== 'string' || !data.name.trim()) return fail();
  const fields = (value: Record<string, any>, keys: string[], type: string) => {
    if (keys.some(key => value[key] !== undefined && typeof value[key] !== type)) fail();
  };
  fields(data, ['avatar', 'about', 'role', 'speechStyle', 'systemInstruction', 'imageModel', 'voiceModel'], 'string');
  fields(data, ['memoryEnabled'], 'boolean');
  if (data.voiceSettings !== undefined) {
    const voice = data.voiceSettings;
    if (!object(voice)) return fail();
    fields(voice, ['voiceName', 'voiceModel', 'frequency', 'designedVoiceId', 'designedVoiceName', 'replicatedVoiceId', 'replicatedVoiceName', 'replicationStorageMode', 'stylePrompt', 'pitchTone', 'paceSpeed'], 'string');
    fields(voice, ['voiceForVoice', 'enableVoiceDesign', 'enableVoiceReplication', 'enableVoicePrompting'], 'boolean');
    if (voice.frequency !== undefined && !['off', 'occasional', 'frequent', 'always'].includes(voice.frequency)) return fail();
  }
  if (data.humaneSettings !== undefined) {
    if (!object(data.humaneSettings)) return fail();
    fields(data.humaneSettings, ['enabled', 'banRoboticLanguage', 'humanImperfections', 'varyMessageLength', 'moodSliderEnabled'], 'boolean');
    fields(data.humaneSettings, ['varyMessageLengthPrompt'], 'string');
    if (data.humaneSettings.moodValue !== undefined && (!Number.isFinite(data.humaneSettings.moodValue) || data.humaneSettings.moodValue < 0 || data.humaneSettings.moodValue > 100)) return fail();
  }
  const blocks = (items: unknown, trigger = false) => {
    if (!Array.isArray(items)) return fail();
    for (const item of items) {
      if (!object(item) || ['id', 'context', 'startTime', 'endTime'].some(key => typeof item[key] !== 'string')) return fail();
      if (![item.startTime, item.endTime].every(time => /^([01]\d|2[0-3]):[0-5]\d$/.test(time))) return fail();
      if (trigger) fields(item, ['lastTriggered', 'lastTriggerType'], 'string');
    }
  };
  if (data.schedule !== undefined) {
    const schedule = data.schedule;
    if (!object(schedule) || typeof schedule.enabled !== 'boolean') return fail();
    blocks(schedule.weekday);
    blocks(schedule.weekend);
    if (schedule.weekendDays !== undefined && (!Array.isArray(schedule.weekendDays) || schedule.weekendDays.some((day: unknown) => !Number.isInteger(day) || Number(day) < 0 || Number(day) > 6))) return fail();
    if (schedule.holidayDates !== undefined && (!Array.isArray(schedule.holidayDates) || schedule.holidayDates.some((date: unknown) => typeof date !== 'string'))) return fail();
  }
  if (data.automation !== undefined) {
    const automation = data.automation;
    if (!object(automation) || typeof automation.enabled !== 'boolean' || !object(automation.inactivity) || typeof automation.inactivity.enabled !== 'boolean') return fail();
    blocks(automation.timeTriggers, true);
    if (['hours', 'minutes', 'seconds'].some(key => !Number.isFinite(automation.inactivity[key]) || automation.inactivity[key] < 0)) return fail();
    if (automation.lastInactivityTriggered !== undefined && !Number.isFinite(automation.lastInactivityTriggered)) return fail();
    fields(automation, ['lastInactivityType'], 'string');
  }
  if (data.memoryBubbles !== undefined) {
    if (!Array.isArray(data.memoryBubbles)) return fail();
    for (const memory of data.memoryBubbles) {
      if (!object(memory) || ['id', 'chatId', 'title', 'startDate', 'endDate', 'summary', 'createdAt'].some(key => typeof memory[key] !== 'string')) return fail();
      fields(memory, ['updatedAt'], 'string');
    }
  }
  return data as PersonaBackupData['persona'];
}
