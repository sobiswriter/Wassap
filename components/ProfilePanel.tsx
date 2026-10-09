import React, { useState, useEffect, useRef } from 'react';
import { 
  X, ArrowLeft, Camera, Link as LinkIcon, Save, Info, Globe, Check, 
  Users, Trash2, Eraser, Settings, ChevronDown, ChevronRight, 
  Plus, Clock, RefreshCw, UserX, Brain, Edit3, CalendarDays, Smile, Download, Upload,
  Mic, Volume2, Loader2, Play, Sparkles, Wand2, Square, HelpCircle, AlertCircle, Copy
} from 'lucide-react';
import { Chat, MemoryBubble, PersonaSchedule, PersonaScheduleBlock, PersonaTemplate, AppSettings, PersonaVoiceSettings, VoiceNoteFrequency, CustomVoiceItem, PersonaBackupData } from '../types';
import { ConfirmationModal } from './ConfirmationModal';
import { formatDateRangeLabel, getDaysBetween, getLocalDateKey, normalizeDateKey, getAppNow, getAppDateKey } from '../utils/dates';
import { DEFAULT_TEMPLATES, GEMINI_TTS_VOICES, DEFAULT_VOICE_SETTINGS, GEMINI_TTS_VOICE_DETAILS, AVAILABLE_IMAGE_MODELS, DEFAULT_IMAGE_MODEL, AVAILABLE_VOICE_MODELS, DEFAULT_VOICE_MODEL, VOICE_STYLE_PRESETS, DEFAULT_VARY_MESSAGE_LENGTH_PROMPT, VARY_MESSAGE_LENGTH_PRESETS } from '../constants';
import { generateGeminiVoiceNote } from '../services/geminiService';
import { getSavedCustomVoices, saveCustomVoice, deleteCustomVoiceComplete, craftCustomVoice, replicateCustomVoice, VOICE_DESIGN_INSPIRATIONS, isDesignedVoice, isReplicatedVoice, getVoiceAudioPreview } from '../utils/customVoices';
import { convertAudioTo24kMonoWav } from '../utils/audioResampler';

interface ProfilePanelProps {
  chat: Chat;
  allChats: Chat[];
  onClose: () => void;
  onUpdate: (updates: Partial<Chat>) => void;
  onDeleteChat?: () => void;
  onClearChat?: (clearMemories?: boolean) => void;
  onRefreshPersona: (chatId: string) => void;
  onTestAutomation?: (chatId: string, testType: 'inactivity' | 'time', contextOverride?: string) => void;
  settings?: AppSettings;
}

const createDefaultSchedule = (): PersonaSchedule => ({
  enabled: false,
  weekday: [
    { id: `weekday-${Date.now()}-morning`, startTime: '07:00', endTime: '09:00', context: 'getting ready for the day and having breakfast' },
    { id: `weekday-${Date.now()}-work`, startTime: '09:00', endTime: '17:00', context: 'busy with work or daily responsibilities' },
    { id: `weekday-${Date.now()}-evening`, startTime: '18:00', endTime: '22:00', context: 'winding down after the day' }
  ],
  weekend: [
    { id: `weekend-${Date.now()}-morning`, startTime: '09:00', endTime: '11:00', context: 'having a slower morning' },
    { id: `weekend-${Date.now()}-day`, startTime: '12:00', endTime: '18:00', context: 'taking care of personal plans or relaxing' }
  ],
  holidayDates: [],
  weekendDays: [0, 6] // Default: Sunday and Saturday
});

export const ProfilePanel: React.FC<ProfilePanelProps> = ({ 
  chat, allChats, onClose, onUpdate, onDeleteChat, onClearChat, onRefreshPersona, onTestAutomation, settings 
}) => {
  const [formData, setFormData] = useState({
    name: chat.name,
    about: chat.about || (chat.isGroup ? 'Group Description' : 'Hey there! I am using WhatsApp.'),
    role: chat.role || '',
    speechStyle: chat.speechStyle || '',
    systemInstruction: chat.systemInstruction || '',
    avatar: chat.avatar,
    memoryEnabled: chat.memoryEnabled || false,
    memoryBubbles: chat.memoryBubbles || [],
    schedule: chat.schedule || createDefaultSchedule(),
    automation: chat.automation || {
      enabled: false,
      timeTriggers: [],
      inactivity: { enabled: false, hours: 6, minutes: 0, seconds: 0 }
    },
    humaneSettings: chat.humaneSettings ? {
      ...chat.humaneSettings,
      varyMessageLengthPrompt: chat.humaneSettings.varyMessageLengthPrompt || DEFAULT_VARY_MESSAGE_LENGTH_PROMPT
    } : {
      enabled: false,
      banRoboticLanguage: true,
      humanImperfections: false,
      varyMessageLength: false,
      varyMessageLengthPrompt: DEFAULT_VARY_MESSAGE_LENGTH_PROMPT,
      moodSliderEnabled: false,
      moodValue: 50
    },
    voiceSettings: chat.voiceSettings || { ...DEFAULT_VOICE_SETTINGS },
    imageModel: chat.imageModel || ''
  });

  const [customTemplates, setCustomTemplates] = useState<PersonaTemplate[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('whatsapp_custom_templates');
    if (saved) {
      try {
        setCustomTemplates(JSON.parse(saved));
      } catch(e) { console.error(e); }
    }
  }, []);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSentience, setShowSentience] = useState(false);
  const [showHumane, setShowHumane] = useState(false);
  const [showVaryLengthPromptDropdown, setShowVaryLengthPromptDropdown] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [showImageSettings, setShowImageSettings] = useState(false);
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState(chat.avatar);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearMemoriesAlso, setClearMemoriesAlso] = useState(false);
  const [memoryStartDate, setMemoryStartDate] = useState(getLocalDateKey());
  const [memoryEndDate, setMemoryEndDate] = useState(getLocalDateKey());
  const [memoryTitle, setMemoryTitle] = useState('');
  const [memorySummary, setMemorySummary] = useState('');
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editMemoryTitle, setEditMemoryTitle] = useState('');
  const [editMemorySummary, setEditMemorySummary] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFormData({
      name: chat.name,
      about: chat.about || (chat.isGroup ? 'Group Description' : 'Hey there! I am using WhatsApp.'),
      role: chat.role || '',
      speechStyle: chat.speechStyle || '',
      systemInstruction: chat.systemInstruction || '',
      avatar: chat.avatar,
      memoryEnabled: chat.memoryEnabled || false,
      memoryBubbles: chat.memoryBubbles || [],
      schedule: chat.schedule || createDefaultSchedule(),
      automation: chat.automation || {
        enabled: false,
        timeTriggers: [],
        inactivity: { enabled: false, hours: 6, minutes: 0, seconds: 0 }
      },
      humaneSettings: chat.humaneSettings ? {
        ...chat.humaneSettings,
        varyMessageLengthPrompt: chat.humaneSettings.varyMessageLengthPrompt || DEFAULT_VARY_MESSAGE_LENGTH_PROMPT
      } : {
        enabled: false,
        banRoboticLanguage: true,
        humanImperfections: false,
        varyMessageLength: false,
        varyMessageLengthPrompt: DEFAULT_VARY_MESSAGE_LENGTH_PROMPT,
        moodSliderEnabled: false,
        moodValue: 50
      },
      voiceSettings: chat.voiceSettings || { ...DEFAULT_VOICE_SETTINGS },
      imageModel: chat.imageModel || ''
    });
    
    // Normalize existing data if it used minHours
    setFormData(prev => {
      if (prev.automation?.inactivity && ('minHours' in prev.automation.inactivity)) {
         const oldInactivity: any = prev.automation.inactivity;
         return {
           ...prev,
           automation: {
             ...prev.automation,
             inactivity: {
               enabled: oldInactivity.enabled,
               hours: oldInactivity.hours ?? oldInactivity.minHours ?? 6,
               minutes: oldInactivity.minutes ?? 0,
               seconds: oldInactivity.seconds ?? 0
             }
           }
         };
      }
      return prev;
    });
    setUrlValue(chat.avatar);
    setEditingMemoryId(null);
  }, [chat]);

  // Custom Voices & Modals State
  const [customVoices, setCustomVoices] = useState<CustomVoiceItem[]>([]);
  const [showVoiceDesignInfo, setShowVoiceDesignInfo] = useState(false);
  const [showVoiceReplicationInfo, setShowVoiceReplicationInfo] = useState(false);
  const [showVoicePromptingInfo, setShowVoicePromptingInfo] = useState(false);

  // Feature A (Voice Design) Crafting State
  const [showCraftVoicePanel, setShowCraftVoicePanel] = useState(false);
  const [craftName, setCraftName] = useState('');
  const [craftPrompt, setCraftPrompt] = useState('');
  const [craftGender, setCraftGender] = useState<'FEMALE' | 'MALE'>('FEMALE');
  const [craftLanguage, setCraftLanguage] = useState('en-US');
  const [isCraftingVoice, setIsCraftingVoice] = useState(false);
  const [craftError, setCraftError] = useState<string | null>(null);
  const [craftedSuccessVoice, setCraftedSuccessVoice] = useState<CustomVoiceItem | null>(null);
  const [showCraftSuccessModal, setShowCraftSuccessModal] = useState(false);
  const [isTestingVoiceNote, setIsTestingVoiceNote] = useState(false);

  // Feature B (Voice Replication) Cloning State
  const [showReplicatePanel, setShowReplicatePanel] = useState(false);
  const [replicateName, setReplicateName] = useState('');
  // Reference Audio (10-30s)
  const [isRecordingReplication, setIsRecordingReplication] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [replicationAudioB64, setReplicationAudioB64] = useState<string | null>(null);
  const [replicationAudioUrl, setReplicationAudioUrl] = useState<string | null>(null);
  // Consent Audio
  const [isRecordingConsent, setIsRecordingConsent] = useState(false);
  const [consentRecordingDuration, setConsentRecordingDuration] = useState(0);
  const [consentAudioB64, setConsentAudioB64] = useState<string | null>(null);
  const [consentAudioUrl, setConsentAudioUrl] = useState<string | null>(null);
  const [hasCopiedConsentPhrase, setHasCopiedConsentPhrase] = useState(false);

  const [isReplicatingVoice, setIsReplicatingVoice] = useState(false);
  const [replicateError, setReplicateError] = useState<string | null>(null);

  // Audio Preview & Media Recorder State
  const [playingPreviewVoiceId, setPlayingPreviewVoiceId] = useState<string | null>(null);
  const activeAudioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const replicationFileInputRef = useRef<HTMLInputElement>(null);

  const mediaRecorderConsentRef = useRef<MediaRecorder | null>(null);
  const consentAudioChunksRef = useRef<Blob[]>([]);
  const consentRecordingTimerRef = useRef<any>(null);
  const consentFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const refreshVoices = () => {
      setCustomVoices(getSavedCustomVoices());
    };
    refreshVoices();
    window.addEventListener('wassap_custom_voices_updated', refreshVoices);
    window.addEventListener('storage', refreshVoices);
    return () => {
      window.removeEventListener('wassap_custom_voices_updated', refreshVoices);
      window.removeEventListener('storage', refreshVoices);
    };
  }, []);

  const playAudioPreview = (audioUrl: string, voiceId?: string) => {
    if (activeAudioPreviewRef.current) {
      activeAudioPreviewRef.current.pause();
      const prevVoice = playingPreviewVoiceId;
      activeAudioPreviewRef.current = null;
      setPlayingPreviewVoiceId(null);
      if (prevVoice === voiceId) {
        return;
      }
    }

    try {
      const audio = new Audio(audioUrl);
      activeAudioPreviewRef.current = audio;
      if (voiceId) setPlayingPreviewVoiceId(voiceId);

      audio.onended = () => {
        setPlayingPreviewVoiceId(null);
        activeAudioPreviewRef.current = null;
      };
      audio.onerror = () => {
        setPlayingPreviewVoiceId(null);
        activeAudioPreviewRef.current = null;
      };
      audio.play().catch(e => {
        console.error("Audio playback error:", e);
        setPlayingPreviewVoiceId(null);
        activeAudioPreviewRef.current = null;
      });
    } catch (err) {
      console.error("Audio initialize error:", err);
      setPlayingPreviewVoiceId(null);
    }
  };

  const startRecordingReplicationAudio = async () => {
    try {
      setReplicateError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const rawBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        try {
          const wavRes = await convertAudioTo24kMonoWav(rawBlob);
          setReplicationAudioB64(wavRes.base64Wav);
          setReplicationAudioUrl(wavRes.dataUrl);
        } catch (err: any) {
          console.error("Audio resampling failed:", err);
          setReplicateError("Failed to convert audio to 24kHz WAV: " + (err.message || err));
        }
      };

      mediaRecorder.start(250);
      setIsRecordingReplication(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Microphone access failed:", err);
      setReplicateError("Could not access microphone: " + (err.message || err));
    }
  };

  const stopRecordingReplicationAudio = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecordingReplication(false);
  };

  const handleReplicationFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReplicateError(null);
    try {
      const wavRes = await convertAudioTo24kMonoWav(file);
      setReplicationAudioB64(wavRes.base64Wav);
      setReplicationAudioUrl(wavRes.dataUrl);
      if (!replicateName.trim()) {
        const suggestedName = file.name.replace(/\.[^/.]+$/, '').slice(0, 30);
        setReplicateName(suggestedName);
      }
    } catch (err: any) {
      console.error("Audio file conversion failed:", err);
      setReplicateError("Could not process audio file: " + (err.message || err));
    }
  };

  const GOOGLE_CONSENT_STATEMENT = "I am the owner of this voice and have consented to the creation of a synthetic model of my voice through the use of Google Cloud.";

  const handleCopyConsentPhrase = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(GOOGLE_CONSENT_STATEMENT);
      setHasCopiedConsentPhrase(true);
      setTimeout(() => setHasCopiedConsentPhrase(false), 2000);
    }
  };

  const startRecordingConsentAudio = async () => {
    try {
      setReplicateError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      consentAudioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderConsentRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) consentAudioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const rawBlob = new Blob(consentAudioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        try {
          const wavRes = await convertAudioTo24kMonoWav(rawBlob);
          setConsentAudioB64(wavRes.base64Wav);
          setConsentAudioUrl(wavRes.dataUrl);
        } catch (err: any) {
          console.error("Consent audio resampling failed:", err);
          setReplicateError("Failed to convert consent audio to 24kHz WAV: " + (err.message || err));
        }
      };

      mediaRecorder.start(250);
      setIsRecordingConsent(true);
      setConsentRecordingDuration(0);
      consentRecordingTimerRef.current = setInterval(() => {
        setConsentRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Microphone access failed for consent recording:", err);
      setReplicateError("Could not access microphone: " + (err.message || err));
    }
  };

  const stopRecordingConsentAudio = () => {
    if (mediaRecorderConsentRef.current && mediaRecorderConsentRef.current.state !== 'inactive') {
      mediaRecorderConsentRef.current.stop();
    }
    if (consentRecordingTimerRef.current) {
      clearInterval(consentRecordingTimerRef.current);
      consentRecordingTimerRef.current = null;
    }
    setIsRecordingConsent(false);
  };

  const handleConsentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReplicateError(null);
    try {
      const wavRes = await convertAudioTo24kMonoWav(file);
      setConsentAudioB64(wavRes.base64Wav);
      setConsentAudioUrl(wavRes.dataUrl);
    } catch (err: any) {
      console.error("Consent audio file conversion failed:", err);
      setReplicateError("Could not process consent audio file: " + (err.message || err));
    }
  };

  const handleTestDesignedVoiceNote = async (voiceOverride?: CustomVoiceItem) => {
    setIsTestingVoiceNote(true);
    try {
      const activeVoice = voiceOverride?.id || formData.voiceSettings?.designedVoiceId || formData.voiceSettings?.voiceName || 'Aoede';
      const promptToUse = voiceOverride?.promptDescription || customVoices.find(v => v.id === activeVoice)?.promptDescription;
      const testText = `Hey! Just trying out my new voice on Wassap. Can you hear me clearly? <chuckle>`;
      
      const testVoiceSettings: PersonaVoiceSettings = {
        ...(formData.voiceSettings || DEFAULT_VOICE_SETTINGS),
        enableVoiceDesign: true,
        designedVoiceId: activeVoice,
        designedVoiceName: voiceOverride?.name || formData.voiceSettings?.designedVoiceName,
        stylePrompt: promptToUse || formData.voiceSettings?.stylePrompt
      };

      const res = await generateGeminiVoiceNote(
        testText,
        activeVoice,
        settings,
        {
          name: formData.name,
          speechStyle: formData.speechStyle,
          role: formData.role
        },
        testVoiceSettings
      );
      if (res.ok && res.audioDataUrl) {
        playAudioPreview(res.audioDataUrl, 'test-voice-note');
      } else {
        alert(res.error || "Failed to generate test voice note.");
      }
    } catch (err: any) {
      alert("Error generating test voice note: " + (err?.message || err));
    } finally {
      setIsTestingVoiceNote(false);
    }
  };

  const handleExecuteCraftVoice = async () => {
    if (!craftPrompt.trim()) {
      setCraftError("Please provide a prompt describing the voice you want to craft.");
      return;
    }
    const nameToUse = craftName.trim() || `Custom Voice ${Date.now().toString().slice(-4)}`;
    setIsCraftingVoice(true);
    setCraftError(null);

    try {
      const res = await craftCustomVoice({
        displayName: nameToUse,
        prompt: craftPrompt.trim(),
        gender: craftGender,
        languageCode: craftLanguage
      });

      if (res.ok && res.voice) {
        const freshVoices = getSavedCustomVoices();
        const voiceExists = freshVoices.some(v => v.id === res.voice!.id);
        const allVoices = voiceExists ? freshVoices : [res.voice, ...freshVoices];
        setCustomVoices(allVoices);
        const updatedVoiceSettings: PersonaVoiceSettings = {
          ...(formData.voiceSettings || DEFAULT_VOICE_SETTINGS),
          enableVoiceDesign: true,
          enableVoiceReplication: false,
          designedVoiceId: res.voice.id,
          designedVoiceName: res.voice.name,
          stylePrompt: res.voice.promptDescription || formData.voiceSettings?.stylePrompt
        };
        setFormData(p => ({ ...p, voiceSettings: updatedVoiceSettings }));
        onUpdate({ voiceSettings: updatedVoiceSettings });
        setShowCraftVoicePanel(false);
        setCraftPrompt('');
        setCraftName('');
        setCraftedSuccessVoice(res.voice);
        setShowCraftSuccessModal(true);
      } else {
        setCraftError(res.error || "Failed to craft voice with Vertex AI.");
      }
    } catch (err: any) {
      setCraftError(err?.message || "Crafting error.");
    } finally {
      setIsCraftingVoice(false);
    }
  };

  const handleExecuteReplication = async () => {
    if (!replicationAudioB64) {
      setReplicateError("Please record or upload a reference voice sample (10-30s) first.");
      return;
    }
    if (!consentAudioB64) {
      setReplicateError("Please record or upload the consent recording of the speaker reading the required statement.");
      return;
    }
    const nameToUse = replicateName.trim() || `${formData.name}'s Replicated Voice`;
    setIsReplicatingVoice(true);
    setReplicateError(null);

    try {
      const res = await replicateCustomVoice({
        displayName: nameToUse,
        sourceAudioBase64: replicationAudioB64,
        consentAudioBase64: consentAudioB64,
        previewAudioUrl: replicationAudioUrl || undefined,
        store: true,
        model: formData.voiceSettings?.voiceModel || settings?.selectedVoiceModel || DEFAULT_VOICE_MODEL
      });

      if (res.ok && res.voice) {
        setCustomVoices(getSavedCustomVoices());
        const updatedVoiceSettings: PersonaVoiceSettings = {
          ...(formData.voiceSettings || DEFAULT_VOICE_SETTINGS),
          enableVoiceReplication: true,
          replicatedVoiceId: res.voice.id,
          replicatedVoiceName: res.voice.name
        };
        setFormData(p => ({ ...p, voiceSettings: updatedVoiceSettings }));
        onUpdate({ voiceSettings: updatedVoiceSettings });
        setShowReplicatePanel(false);
        setReplicationAudioB64(null);
        setReplicationAudioUrl(null);
        setConsentAudioB64(null);
        setConsentAudioUrl(null);
        setReplicateName('');
      } else {
        setReplicateError(res.error || "Failed to replicate voice with Vertex AI.");
      }
    } catch (err: any) {
      setReplicateError(err?.message || "Replication error.");
    } finally {
      setIsReplicatingVoice(false);
    }
  };

  const handleDeleteCustomVoice = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this custom voice from your saved voices?")) {
      await deleteCustomVoiceComplete(id);
      setCustomVoices(getSavedCustomVoices());
      let needUpdate = false;
      const updatedVoiceSettings = { ...(formData.voiceSettings || DEFAULT_VOICE_SETTINGS) };
      if (updatedVoiceSettings.designedVoiceId === id) {
        updatedVoiceSettings.designedVoiceId = undefined;
        updatedVoiceSettings.designedVoiceName = undefined;
        needUpdate = true;
      }
      if (updatedVoiceSettings.replicatedVoiceId === id) {
        updatedVoiceSettings.replicatedVoiceId = undefined;
        updatedVoiceSettings.replicatedVoiceName = undefined;
        needUpdate = true;
      }
      if (needUpdate) {
        setFormData(p => ({ ...p, voiceSettings: updatedVoiceSettings }));
        onUpdate({ voiceSettings: updatedVoiceSettings });
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setFormData(prev => ({ ...prev, avatar: base64 }));
        onUpdate({ avatar: base64 });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApplyUrl = () => {
    if (urlValue) {
      setFormData(prev => ({ ...prev, avatar: urlValue }));
      onUpdate({ avatar: urlValue });
      setShowUrlInput(false);
    }
  };

  const handleSave = () => {
    onUpdate(formData);
  };

  const handleExportPersonaBackup = () => {
    const backupData: PersonaBackupData = {
      version: 1,
      type: 'wassap-persona-backup',
      exportedAt: new Date().toISOString(),
      persona: {
        name: formData.name,
        avatar: formData.avatar,
        about: formData.about,
        role: formData.role,
        speechStyle: formData.speechStyle,
        systemInstruction: formData.systemInstruction,
        voiceSettings: formData.voiceSettings,
        schedule: formData.schedule,
        automation: formData.automation,
        humaneSettings: formData.humaneSettings,
        memoryEnabled: formData.memoryEnabled,
        memoryBubbles: formData.memoryBubbles,
        imageModel: formData.imageModel,
        voiceModel: formData.voiceModel,
      }
    };

    const dataStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(formData.name || 'Persona').replace(/\s+/g, '_')}_Profile_Settings.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const memoryFileInputRef = useRef<HTMLInputElement>(null);

  const handleExportMemories = () => {
    if (formData.memoryBubbles.length === 0) {
      alert("No memories to export.");
      return;
    }
    const dataStr = JSON.stringify(formData.memoryBubbles, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${chat.name.replace(/\s+/g, '_')}_Memories.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportMemories = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const importedMemories: MemoryBubble[] = JSON.parse(content);
        
        if (!Array.isArray(importedMemories)) {
          alert("Invalid memory file format.");
          return;
        }

        const existingIds = new Set(formData.memoryBubbles.map(m => m.id));
        const newMemories = importedMemories.filter(m => !existingIds.has(m.id));

        if (newMemories.length === 0) {
          alert("No new memories found to import.");
        } else {
          setFormData(prev => ({
            ...prev,
            memoryBubbles: [...prev.memoryBubbles, ...newMemories]
          }));
          alert(`Successfully imported ${newMemories.length} memories!`);
        }
      } catch (err) {
        console.error("Failed to parse imported memories", err);
        alert("Failed to parse the memory file. Ensure it is a valid JSON file.");
      }
      
      if (memoryFileInputRef.current) memoryFileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleCreateMemory = () => {
    const normalizedStart = normalizeDateKey(memoryStartDate);
    const normalizedEnd = normalizeDateKey(memoryEndDate);
    if (normalizedEnd < normalizedStart) {
      alert('End date cannot be before start date.');
      return;
    }
    if (getDaysBetween(normalizedStart, normalizedEnd) > 31) {
      alert('A memory recollection can span up to 31 days at a time.');
      return;
    }
    if (!memorySummary.trim()) {
      alert('Write a memory note here, or use a chat date divider to auto-compress messages.');
      return;
    }

    const newMemory: MemoryBubble = {
      id: `memory-${Date.now()}`,
      chatId: chat.id,
      title: memoryTitle.trim() || `${formData.name} - ${formatDateRangeLabel(normalizedStart, normalizedEnd)}`,
      startDate: normalizedStart,
      endDate: normalizedEnd,
      summary: memorySummary.trim(),
      createdAt: new Date().toISOString()
    };

    setFormData(prev => ({
      ...prev,
      memoryBubbles: [...prev.memoryBubbles, newMemory]
    }));
    setMemoryTitle('');
    setMemorySummary('');
  };

  const handleUpdateMemory = (memory: MemoryBubble) => {
    setFormData(prev => ({
      ...prev,
      memoryBubbles: prev.memoryBubbles.map(item =>
        item.id === memory.id
          ? { ...item, title: editMemoryTitle.trim() || item.title, summary: editMemorySummary.trim(), updatedAt: new Date().toISOString() }
          : item
      )
    }));
    setEditingMemoryId(null);
  };

  const handleDeleteMemory = (memoryId: string) => {
    setFormData(prev => ({
      ...prev,
      memoryBubbles: prev.memoryBubbles.filter(memory => memory.id !== memoryId)
    }));
  };

  const updateScheduleBlock = (kind: 'weekday' | 'weekend', blockId: string, updates: Partial<PersonaScheduleBlock>) => {
    setFormData(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [kind]: prev.schedule[kind].map(block => block.id === blockId ? { ...block, ...updates } : block)
      }
    }));
  };

  const addScheduleBlock = (kind: 'weekday' | 'weekend') => {
    const newBlock: PersonaScheduleBlock = {
      id: `${kind}-${Date.now()}`,
      startTime: '09:00',
      endTime: '10:00',
      context: kind === 'weekday' ? 'doing something from their normal weekday routine' : 'spending time in a weekend or holiday mood'
    };
    setFormData(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [kind]: [...prev.schedule[kind], newBlock]
      }
    }));
  };

  const deleteScheduleBlock = (kind: 'weekday' | 'weekend', blockId: string) => {
    setFormData(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [kind]: prev.schedule[kind].filter(block => block.id !== blockId)
      }
    }));
  };

  const renderScheduleBlocks = (kind: 'weekday' | 'weekend', title: string) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="text-[calc(var(--msg-font-size)-0.5px)] font-medium text-primary">{title}</h5>
        <button
          onClick={() => addScheduleBlock(kind)}
          className="flex items-center gap-1 text-[calc(var(--msg-font-size)-2px)] text-[#21c063] font-medium hover:bg-black/5 rounded px-2 py-1"
        >
          <Plus size={14} /> Add
        </button>
      </div>
      {formData.schedule[kind].length === 0 ? (
        <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">No schedule blocks yet.</p>
      ) : formData.schedule[kind].map(block => (
        <div key={block.id} className="p-3 bg-white dark:bg-[#202c33] border app-border rounded space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={block.startTime}
              onChange={(e) => updateScheduleBlock(kind, block.id, { startTime: e.target.value })}
              className="bg-transparent border-b app-border text-[calc(var(--msg-font-size)-2px)] text-primary outline-none"
            />
            <span className="text-secondary">to</span>
            <input
              type="time"
              value={block.endTime}
              onChange={(e) => updateScheduleBlock(kind, block.id, { endTime: e.target.value })}
              className="bg-transparent border-b app-border text-[calc(var(--msg-font-size)-2px)] text-primary outline-none"
            />
            <button onClick={() => deleteScheduleBlock(kind, block.id)} className="ml-auto p-1.5 text-secondary hover:text-red-500 hover:bg-black/5 rounded">
              <Trash2 size={15} />
            </button>
          </div>
          <textarea
            value={block.context}
            onChange={(e) => updateScheduleBlock(kind, block.id, { context: e.target.value })}
            rows={2}
            placeholder="What is this persona probably doing?"
            className="w-full bg-black/5 dark:bg-black/20 border app-border rounded p-2 text-[calc(var(--msg-font-size)-1.5px)] outline-none resize-none text-primary"
          />
        </div>
      ))}
    </div>
  );

  const labelClass = "text-[calc(var(--msg-font-size)-0.5px)] text-[#008069] font-medium block mb-2 uppercase tracking-tight";
  const inputClass = "w-full outline-none text-[calc(var(--msg-font-size)+1.5px)] border-b app-border focus:border-[#21c063] pb-1.5 transition-all bg-transparent text-primary py-1";

  const groupMembers = chat.isGroup
    ? chat.memberIds?.map(id => allChats.find(c => c.id === id)).filter(Boolean) as Chat[]
    : [];

  return (
    <div className="fixed inset-0 z-[3500] md:static md:w-[400px] md:h-full md:z-auto app-header border-l app-border flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden">
      {showDeleteModal && (
        <ConfirmationModal
          title={chat.isGroup ? "Exit group?" : "Delete this persona?"}
          message={chat.isGroup ? `Are you sure you want to exit and delete "${chat.name}"?` : `Are you sure you want to delete "${chat.name}"? This will remove the contact and all associated message history.`}
          confirmLabel={chat.isGroup ? "Exit" : "Delete"}
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={() => {
            onDeleteChat?.();
            setShowDeleteModal(false);
          }}
        />
      )}

      {showClearModal && (
        <ConfirmationModal
          title="Clear chat history?"
          message={`Are you sure you want to clear all messages in "${chat.name}"? This action cannot be undone.`}
          confirmLabel="Clear Chat"
          onCancel={() => setShowClearModal(false)}
          onConfirm={() => {
            onClearChat?.(clearMemoriesAlso);
            if (clearMemoriesAlso) {
              setFormData(prev => ({ ...prev, memoryBubbles: [] }));
            }
            setShowClearModal(false);
          }}
        >
          {chat.memoryBubbles && chat.memoryBubbles.length > 0 && (
            <label className="flex items-center gap-2.5 text-[calc(var(--msg-font-size)-1px)] text-secondary cursor-pointer select-none mt-2 p-2.5 rounded bg-black/5 dark:bg-white/5 border app-border">
              <input
                type="checkbox"
                checked={clearMemoriesAlso}
                onChange={(e) => setClearMemoriesAlso(e.target.checked)}
                className="rounded border-gray-400 text-[#00a884] focus:ring-[#00a884] w-4 h-4 cursor-pointer"
              />
              <span>Also clear persona's saved memory bubbles & diary entries ({chat.memoryBubbles.length})</span>
            </label>
          )}
        </ConfirmationModal>
      )}

      {/* Voice Design Info Modal */}
      {showVoiceDesignInfo && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[5000] p-4 animate-in fade-in duration-200">
          <div className="app-panel rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in duration-200 border app-border space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b app-border pb-3">
              <div className="flex items-center gap-2.5 text-primary font-semibold text-lg">
                <Sparkles size={20} className="text-[#21c063]" />
                <span>Voice Design Guide</span>
              </div>
              <button 
                onClick={() => setShowVoiceDesignInfo(false)}
                className="p-1 text-secondary hover:text-primary rounded-full hover:bg-black/5 dark:hover:bg-white/5"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-[calc(var(--msg-font-size)-1px)] text-secondary leading-relaxed">
              <p>
                <strong className="text-primary">What is Voice Design?</strong><br />
                Powered by Gemini 3.8's <code className="text-[#21c063] font-mono">VOICE_TYPE_PROMPTED</code> engine, Voice Design crafts completely novel, custom vocal personas from natural language descriptions.
              </p>
              <div className="p-3 bg-black/5 dark:bg-white/5 rounded-lg space-y-1.5">
                <span className="font-semibold text-primary block text-xs uppercase tracking-wider">💡 Prompting Tips:</span>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li><strong>Specify age & accent:</strong> e.g., <em>"A Scottish astronomer in his late 60s"</em>.</li>
                  <li><strong>Describe vocal texture:</strong> e.g., <em>"raspy baritone"</em>, <em>"soft breathy cadence"</em>, <em>"crisp articulation"</em>.</li>
                  <li><strong>Set emotional timbre:</strong> e.g., <em>"wry and amused"</em>, <em>"warm motherly presence"</em>.</li>
                </ul>
              </div>
              <p>
                <strong className="text-primary">Saved in Browser:</strong><br />
                All designed voices are safely stored in your browser's local storage. Once crafted, you can assign the voice to any persona across all your Wassap chats.
              </p>
              <p>
                <strong className="text-primary">Togglable:</strong><br />
                You can toggle Voice Design on or off anytime. When off, the persona seamlessly uses their base studio voice.
              </p>
            </div>
            <button
              onClick={() => setShowVoiceDesignInfo(false)}
              className="w-full bg-[#21c063] hover:bg-[#008069] text-white py-2.5 rounded-lg font-medium text-sm transition-colors uppercase"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {/* Voice Replication Info Modal */}
      {showVoiceReplicationInfo && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[5000] p-4 animate-in fade-in duration-200">
          <div className="app-panel rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in duration-200 border app-border space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b app-border pb-3">
              <div className="flex items-center gap-2.5 text-primary font-semibold text-lg">
                <Mic size={20} className="text-blue-500" />
                <span>Voice Replication Guide</span>
              </div>
              <button 
                onClick={() => setShowVoiceReplicationInfo(false)}
                className="p-1 text-secondary hover:text-primary rounded-full hover:bg-black/5 dark:hover:bg-white/5"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-[calc(var(--msg-font-size)-1px)] text-secondary leading-relaxed">
              <p>
                <strong className="text-primary">What is Voice Replication?</strong><br />
                Gemini 3.8's acoustic replication engine clones any voice timbre and cadence from a brief reference audio sample (10 to 30 seconds).
              </p>
              <div className="p-3 bg-black/5 dark:bg-white/5 rounded-lg space-y-1.5">
                <span className="font-semibold text-primary block text-xs uppercase tracking-wider">🎙️ How It Works:</span>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li><strong>1. Reference Audio:</strong> Provide 10 to 30 seconds of clean, natural speech of the voice you wish to clone.</li>
                  <li><strong>2. Spoken Consent:</strong> Record or upload the speaker reading Google Cloud's verification statement word-for-word. Google's API verifies this to ensure voice ownership.</li>
                  <li><strong>Auto-Resampling:</strong> Wassap automatically resamples both files to 24kHz mono PCM WAV in the browser.</li>
                </ul>
              </div>
              <p>
                <strong className="text-primary">Browser Storage & Cross-Persona Reuse:</strong><br />
                Cloned voices are stored in your browser's local storage and can be assigned to any persona across all your Wassap chats anytime.
              </p>
              <p>
                <strong className="text-primary">Need 100% Consent-Free Custom Voices?</strong><br />
                Use <strong className="text-[#21c063]">Voice Design</strong>! Voice Design generates brand-new custom voices directly from natural language prompts without any consent audio.
              </p>
            </div>
            <button
              onClick={() => setShowVoiceReplicationInfo(false)}
              className="w-full bg-[#21c063] hover:bg-[#008069] text-white py-2.5 rounded-lg font-medium text-sm transition-colors uppercase"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {/* Voice Prompting Info Modal */}
      {showVoicePromptingInfo && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[5000] p-4 animate-in fade-in duration-200">
          <div className="app-panel rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in duration-200 border app-border space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b app-border pb-3">
              <div className="flex items-center gap-2.5 text-primary font-semibold text-lg">
                <Volume2 size={20} className="text-purple-500" />
                <span>Voice Prompting Guide</span>
              </div>
              <button 
                onClick={() => setShowVoicePromptingInfo(false)}
                className="p-1 text-secondary hover:text-primary rounded-full hover:bg-black/5 dark:hover:bg-white/5"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-[calc(var(--msg-font-size)-1px)] text-secondary leading-relaxed">
              <p>
                <strong className="text-primary">Single-Pass Acting Directives:</strong><br />
                Directives, tempo, and pitch are applied alongside the persona prompt in a single API pass without multiple round-trip delays.
              </p>
              <div className="p-3 bg-black/5 dark:bg-white/5 rounded-lg space-y-1.5">
                <span className="font-semibold text-primary block text-xs uppercase tracking-wider">🎭 Inline Vocal Bursts:</span>
                <p className="text-xs">You can include natural human tags in the persona's style or messages:</p>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-xs text-[#21c063]">
                  <span>&lt;laugh&gt;</span>
                  <span>&lt;sigh&gt;</span>
                  <span>&lt;gasp&gt;</span>
                  <span>&lt;whisper&gt;</span>
                  <span>&lt;cough&gt;</span>
                  <span>&lt;yawn&gt;</span>
                </div>
              </div>
              <p>
                <strong className="text-primary">Togglable:</strong><br />
                Toggle this feature off anytime to revert to neutral, standard studio pacing and delivery.
              </p>
            </div>
            <button
              onClick={() => setShowVoicePromptingInfo(false)}
              className="w-full bg-[#21c063] hover:bg-[#008069] text-white py-2.5 rounded-lg font-medium text-sm transition-colors uppercase"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {/* Craft Voice Success Modal */}
      {showCraftSuccessModal && craftedSuccessVoice && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[5000] p-4 animate-in fade-in duration-200">
          <div className="app-panel rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in duration-200 border app-border space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b app-border pb-3">
              <div className="flex items-center gap-2.5 text-primary font-semibold text-lg">
                <Sparkles size={20} className="text-[#21c063]" />
                <span>Voice Crafted Successfully!</span>
              </div>
              <button 
                onClick={() => {
                  setShowCraftSuccessModal(false);
                  setCraftedSuccessVoice(null);
                }}
                className="p-1 text-secondary hover:text-primary rounded-full hover:bg-black/5 dark:hover:bg-white/5"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-[calc(var(--msg-font-size)-1px)]">
              <div className="p-3 bg-[#21c063]/10 border border-[#21c063]/30 rounded-lg flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#21c063]/20 flex items-center justify-center text-[#21c063] shrink-0 font-bold">
                  ✓
                </div>
                <div>
                  <h4 className="font-semibold text-primary">{craftedSuccessVoice.name}</h4>
                  <p className="text-xs text-secondary capitalize">
                    {craftedSuccessVoice.gender?.toLowerCase() || 'Custom'} · {craftedSuccessVoice.type === 'prompted' ? 'Designed Voice' : 'Cloned Voice'}
                  </p>
                </div>
              </div>

              {craftedSuccessVoice.promptDescription && (
                <div className="p-3 bg-black/5 dark:bg-white/5 rounded-lg space-y-1">
                  <span className="text-[11px] font-semibold text-secondary uppercase tracking-wider block">Prompt Directive</span>
                  <p className="text-xs text-primary italic">"{craftedSuccessVoice.promptDescription}"</p>
                </div>
              )}

              <p className="text-xs text-secondary leading-relaxed">
                This custom voice has been saved to your browser and automatically activated for <strong className="text-primary">{formData.name}</strong>. Gemini 3.8 TTS will synthesize audio using this tailored vocal profile.
              </p>

              {(() => {
                const previewUrl = craftedSuccessVoice.sampleAudioDataUrl || getVoiceAudioPreview(craftedSuccessVoice.id);
                return previewUrl ? (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-black/5 dark:bg-white/5">
                    <button
                      type="button"
                      onClick={() => playAudioPreview(previewUrl, craftedSuccessVoice.id)}
                      className="p-2 bg-[#21c063] text-white rounded-lg hover:bg-[#008069] transition-colors flex items-center gap-1.5 text-xs font-medium"
                    >
                      {playingPreviewVoiceId === craftedSuccessVoice.id ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                      <span>{playingPreviewVoiceId === craftedSuccessVoice.id ? "Stop Sample" : "Play Quick Sample"}</span>
                    </button>
                    <span className="text-[11px] text-secondary">Pre-rendered voice preview</span>
                  </div>
                ) : null;
              })()}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t app-border">
              <button
                type="button"
                disabled={isTestingVoiceNote}
                onClick={() => handleTestDesignedVoiceNote(craftedSuccessVoice)}
                className="w-full sm:flex-1 bg-[#00a884] hover:bg-[#008f6f] text-white py-2.5 px-3 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isTestingVoiceNote ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Generating Voice Note...</span>
                  </>
                ) : (
                  <>
                    <Play size={14} fill="currentColor" />
                    <span>Test Voice Note as {formData.name}</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCraftSuccessModal(false);
                  setCraftedSuccessVoice(null);
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-primary rounded-lg font-medium text-xs transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="h-[60px] app-panel flex items-center px-4 md:px-5 shrink-0 border-b app-border pt-[max(env(safe-area-inset-top),10px)] md:pt-0">
        <div className="flex items-center gap-3 md:gap-6">
          <button
            onClick={onClose}
            className="p-1.5 -ml-1 text-secondary hover:text-primary rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:scale-90 transition-transform cursor-pointer"
            title="Close"
          >
            <ArrowLeft size={20} className="md:hidden" />
            <X size={20} className="hidden md:block" />
          </button>
          <h2 className="text-[calc(var(--msg-font-size)+1.5px)] font-medium text-primary">{chat.isGroup ? 'Group info' : 'Contact info'}</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Avatar Section */}
        <div className="app-panel flex flex-col items-center py-7 shadow-sm border-b app-border relative overflow-hidden">
          <div className="relative group cursor-pointer mb-5">
            <img src={formData.avatar} alt={formData.name} className="w-48 h-48 rounded-full object-cover shadow-md border-4 border-white dark:border-[#222d34]" />
            <div className="absolute inset-0 bg-black/40 rounded-full flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity gap-2">
              <div className="flex gap-4">
                <div onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center hover:text-[#21c063] cursor-pointer">
                  <Camera size={20} />
                  <span className="text-[calc(var(--msg-font-size)-4.5px)] uppercase font-bold mt-1">Upload</span>
                </div>
                <div onClick={() => setShowUrlInput(!showUrlInput)} className="flex flex-col items-center hover:text-[#21c063] cursor-pointer">
                  <LinkIcon size={20} />
                  <span className="text-[calc(var(--msg-font-size)-4.5px)] uppercase font-bold mt-1">Link</span>
                </div>
              </div>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
          </div>

          {showUrlInput && (
            <div className="w-full px-10 mb-5">
              <div className="flex items-center gap-2 border-b border-[#21c063] pb-1">
                <Globe size={16} className="text-[#21c063] shrink-0" />
                <input
                  type="text"
                  className="flex-1 outline-none text-[calc(var(--msg-font-size)-0.5px)] bg-transparent text-primary px-1 font-medium"
                  placeholder="Paste image URL here..."
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyUrl()}
                />
                <button onClick={handleApplyUrl} className="text-[#21c063]"><Check size={18} strokeWidth={3} /></button>
              </div>
            </div>
          )}

          <h3 className="text-[calc(var(--msg-font-size)+5.5px)] text-primary font-normal">{formData.name}</h3>
          <p className="text-secondary text-[calc(var(--msg-font-size)-0.5px)] mt-1">{chat.isGroup ? `Group · ${groupMembers.length + 1} participants` : (chat.status || 'online')}</p>
        </div>

        {/* Basic Info Section */}
        <div className="mt-2 app-panel px-6 py-6 shadow-sm space-y-7 border-b app-border">
          <div className="relative">
            <label className={labelClass}>{chat.isGroup ? 'Group Name' : 'Name'}</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div className="relative">
            <label className={labelClass}>{chat.isGroup ? 'Group Description' : 'About'}</label>
            <input
              type="text"
              value={formData.about}
              onChange={(e) => setFormData(prev => ({ ...prev, about: e.target.value }))}
              className={inputClass}
            />
          </div>
        </div>

        {/* Persona Details Section */}
        {!chat.isGroup && (
          <div className="mt-2 app-panel px-6 py-6 shadow-sm space-y-7 border-b app-border">
            <div className="relative">
              <label className={labelClass}>Role / Title</label>
              <input
                type="text"
                placeholder="e.g. CEO, Big Brother, Chef"
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div className="relative">
              <label className={labelClass}>Speech Style</label>
              <input
                type="text"
                placeholder="e.g. Slang, Formal, Poetic"
                value={formData.speechStyle}
                onChange={(e) => setFormData(prev => ({ ...prev, speechStyle: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[calc(var(--msg-font-size)-0.5px)] text-[#008069] font-medium block uppercase tracking-tight">Persona Notes</label>
                <div className="flex gap-2">
                  <select 
                    className="text-[calc(var(--msg-font-size)-2px)] bg-transparent border app-border rounded px-1 text-secondary outline-none cursor-pointer max-w-[140px]"
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const allTemplates = [...DEFAULT_TEMPLATES, ...customTemplates];
                      const tpl = allTemplates.find(t => t.id === e.target.value);
                      if (tpl) {
                        setFormData(prev => ({ ...prev, systemInstruction: tpl.prompt }));
                      }
                      e.target.value = '';
                    }}
                  >
                    <option value="">Templates...</option>
                    <optgroup label="Default">
                      {DEFAULT_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </optgroup>
                    {customTemplates.length > 0 && (
                      <optgroup label="Custom">
                        {customTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </optgroup>
                    )}
                  </select>
                  <button 
                    onClick={() => {
                      const name = prompt("Enter a name for this custom template:");
                      if (name && formData.systemInstruction) {
                        const newTpl = { id: `custom-${Date.now()}`, name, prompt: formData.systemInstruction };
                        const updated = [...customTemplates, newTpl];
                        setCustomTemplates(updated);
                        localStorage.setItem('whatsapp_custom_templates', JSON.stringify(updated));
                      }
                    }}
                    className="text-[calc(var(--msg-font-size)-2px)] bg-[#21c063] text-white px-2 py-0.5 rounded hover:bg-[#008f6f]"
                  >
                    Save
                  </button>
                </div>
              </div>
              <textarea
                value={formData.systemInstruction}
                onChange={(e) => setFormData(prev => ({ ...prev, systemInstruction: e.target.value }))}
                className="w-full min-h-[140px] outline-none text-[calc(var(--msg-font-size)+0.5px)] resize-none bg-[#f9f9f9] dark:bg-[#2a3942] p-3 rounded border app-border focus:border-[#21c063] transition-all text-primary leading-relaxed shadow-sm"
                placeholder="Detailed instructions for the AI behavior..."
              />
            </div>
          </div>
        )}

        {/* Participants for Group */}
        {chat.isGroup && (
           <div className="mt-2 app-panel shadow-sm overflow-hidden border-b app-border">
            <div className="px-6 py-4 border-b app-border flex items-center justify-between">
              <h4 className="text-[calc(var(--msg-font-size)-0.5px)] text-[#008069] font-medium uppercase tracking-tight">
                {groupMembers.length + 1} Participants
              </h4>
              <Users size={16} className="text-secondary" />
            </div>
            <div className="divide-y app-border">
              <div className="px-6 py-3 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-[#202c33] flex items-center justify-center text-[#21c063] font-bold shrink-0">You</div>
                <span className="text-[calc(var(--msg-font-size)+0.5px)] text-primary">You</span>
                <span className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary ml-auto">Group Admin</span>
              </div>
              {groupMembers.map(member => (
                <div key={member.id} className="px-6 py-3 flex items-center gap-4">
                  <img src={member.avatar} className="w-10 h-10 rounded-full object-cover shrink-0" alt="" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[calc(var(--msg-font-size)+0.5px)] text-primary">{member.name}</p>
                    <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary truncate">{member.about || 'Available'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sentience / Memory Section */}
        {!chat.isGroup && (
          <div className="mt-2 app-panel shadow-sm border-b app-border">
            <div
              className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-black/5 transition-colors"
              onClick={() => setShowSentience(!showSentience)}
            >
              <div className="flex items-center gap-3">
                <Brain size={20} className="text-secondary" />
                <h4 className="text-[calc(var(--msg-font-size)+0.5px)] text-primary font-medium">Sentience: Memories</h4>
              </div>
              {showSentience ? <ChevronDown size={20} className="text-secondary" /> : <ChevronRight size={20} className="text-secondary" />}
            </div>

            {showSentience && (
              <div className="px-6 py-6 space-y-6 border-t app-border bg-gray-50/50 dark:bg-black/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[length:var(--msg-font-size)] font-medium text-primary">Memory Bubbles</p>
                    <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">Enable /rem recall for this persona only</p>
                  </div>
                  <div
                    onClick={() => setFormData(prev => ({ ...prev, memoryEnabled: !prev.memoryEnabled }))}
                    className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${formData.memoryEnabled ? 'bg-[#21c063]' : 'bg-gray-400'}`}
                  >
                    <div className={`absolute top-[2px] w-4 h-4 bg-white rounded-full shadow-sm transition-all ${formData.memoryEnabled ? 'left-[22px]' : 'left-[2px]'}`} />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[#21c063]">
                    <Plus size={16} />
                    <h5 className="text-[calc(var(--msg-font-size)-0.5px)] font-medium">Add Manual Memory</h5>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={memoryStartDate}
                      onChange={(e) => setMemoryStartDate(e.target.value)}
                      className="bg-white dark:bg-[#202c33] border app-border rounded px-2 py-2 text-[calc(var(--msg-font-size)-2px)] outline-none text-primary"
                    />
                    <input
                      type="date"
                      value={memoryEndDate}
                      onChange={(e) => setMemoryEndDate(e.target.value)}
                      className="bg-white dark:bg-[#202c33] border app-border rounded px-2 py-2 text-[calc(var(--msg-font-size)-2px)] outline-none text-primary"
                    />
                  </div>
                  <input
                    value={memoryTitle}
                    onChange={(e) => setMemoryTitle(e.target.value)}
                    placeholder="Memory title"
                    className="w-full bg-white dark:bg-[#202c33] border app-border rounded px-3 py-2 text-[calc(var(--msg-font-size)-1.5px)] outline-none text-primary"
                  />
                  <textarea
                    value={memorySummary}
                    onChange={(e) => setMemorySummary(e.target.value)}
                    placeholder="Write the memory note. Use a chat date chip to auto-compress messages."
                    rows={4}
                    className="w-full bg-white dark:bg-[#202c33] border app-border rounded px-3 py-2 text-[calc(var(--msg-font-size)-1.5px)] outline-none resize-none text-primary"
                  />
                  <button
                    onClick={handleCreateMemory}
                    className="w-full bg-[#21c063] hover:bg-[#008f6f] text-white font-medium py-2 rounded transition-colors flex items-center justify-center gap-2 text-[calc(var(--msg-font-size)-1.5px)]"
                  >
                    <Save size={16} /> Add Memory
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between pl-1">
                    <p className="text-[calc(var(--msg-font-size)-3.5px)] font-bold text-secondary uppercase tracking-widest">Saved Memories</p>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={handleExportMemories}
                        className="p-1 hover:bg-black/5 rounded text-secondary transition-colors"
                        title="Export Memories"
                      >
                        <Download size={14} />
                      </button>
                      <button 
                        onClick={() => memoryFileInputRef.current?.click()}
                        className="p-1 hover:bg-black/5 rounded text-secondary transition-colors"
                        title="Import Memories"
                      >
                        <Upload size={14} />
                      </button>
                      <input 
                        type="file" 
                        ref={memoryFileInputRef} 
                        onChange={handleImportMemories} 
                        accept=".json,.txt" 
                        className="hidden" 
                      />
                    </div>
                  </div>
                  {formData.memoryBubbles.length === 0 ? (
                    <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">No memories saved for this persona yet.</p>
                  ) : formData.memoryBubbles.map(memory => (
                    <div key={memory.id} className="p-3 bg-white dark:bg-[#202c33] border app-border rounded space-y-2">
                      {editingMemoryId === memory.id ? (
                        <>
                          <input
                            value={editMemoryTitle}
                            onChange={(e) => setEditMemoryTitle(e.target.value)}
                            className="w-full bg-transparent border-b app-border pb-1 text-[calc(var(--msg-font-size)-1.5px)] outline-none text-primary"
                          />
                          <textarea
                            value={editMemorySummary}
                            onChange={(e) => setEditMemorySummary(e.target.value)}
                            rows={4}
                            className="w-full bg-black/5 dark:bg-black/20 border app-border rounded p-2 text-[calc(var(--msg-font-size)-1.5px)] outline-none resize-none text-primary"
                          />
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingMemoryId(null)} className="px-3 py-1 text-secondary hover:bg-black/10 rounded text-[calc(var(--msg-font-size)-2px)]">Cancel</button>
                            <button onClick={() => handleUpdateMemory(memory)} className="px-3 py-1 bg-[#21c063] text-white rounded text-[calc(var(--msg-font-size)-2px)]">Save</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[calc(var(--msg-font-size)-1px)] text-primary font-medium truncate">{memory.title}</p>
                              <p className="text-[calc(var(--msg-font-size)-3px)] text-secondary">{formatDateRangeLabel(memory.startDate, memory.endDate)}</p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => {
                                  setEditingMemoryId(memory.id);
                                  setEditMemoryTitle(memory.title);
                                  setEditMemorySummary(memory.summary);
                                }}
                                className="p-1.5 text-secondary hover:text-[#21c063] hover:bg-black/5 rounded"
                              >
                                <Edit3 size={15} />
                              </button>
                              <button onClick={() => handleDeleteMemory(memory.id)} className="p-1.5 text-secondary hover:text-red-500 hover:bg-black/5 rounded">
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                          <p className="text-[calc(var(--msg-font-size)-2px)] text-secondary whitespace-pre-wrap line-clamp-5">{memory.summary}</p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Persona Schedule Section */}
        {!chat.isGroup && (
          <div className="mt-2 app-panel shadow-sm border-b app-border">
            <div
              className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-black/5 transition-colors"
              onClick={() => setShowSchedule(!showSchedule)}
            >
              <div className="flex items-center gap-3">
                <CalendarDays size={20} className="text-secondary" />
                <h4 className="text-[calc(var(--msg-font-size)+0.5px)] text-primary font-medium">Sentience: Persona Schedule</h4>
              </div>
              {showSchedule ? <ChevronDown size={20} className="text-secondary" /> : <ChevronRight size={20} className="text-secondary" />}
            </div>

            {showSchedule && (
              <div className="px-6 py-6 space-y-6 border-t app-border bg-gray-50/50 dark:bg-black/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[length:var(--msg-font-size)] font-medium text-primary">Use Schedule Context</p>
                    <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">Adds subtle daily-life context to replies</p>
                  </div>
                  <div
                    onClick={() => setFormData(prev => ({ ...prev, schedule: { ...prev.schedule, enabled: !prev.schedule.enabled } }))}
                    className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${formData.schedule.enabled ? 'bg-[#21c063]' : 'bg-gray-400'}`}
                  >
                    <div className={`absolute top-[2px] w-4 h-4 bg-white rounded-full shadow-sm transition-all ${formData.schedule.enabled ? 'left-[22px]' : 'left-[2px]'}`} />
                  </div>
                </div>

                <div className={`space-y-6 transition-opacity ${formData.schedule.enabled ? 'opacity-100' : 'opacity-50'}`}>
                  {renderScheduleBlocks('weekday', 'Weekday Routine')}
                  {renderScheduleBlocks('weekend', 'Weekend & Holiday Routine')}

                  <div className="space-y-3">
                    <label className="text-[calc(var(--msg-font-size)-3px)] text-secondary uppercase font-bold">Weekend Days</label>
                    <div className="flex flex-wrap gap-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => {
                        const isWeekend = (formData.schedule.weekendDays || [0, 6]).includes(index);
                        return (
                          <button
                            key={day}
                            onClick={() => {
                              const current = formData.schedule.weekendDays || [0, 6];
                              const next = current.includes(index)
                                ? current.filter(i => i !== index)
                                : [...current, index];
                              setFormData(prev => ({
                                ...prev,
                                schedule: { ...prev.schedule, weekendDays: next }
                              }));
                            }}
                            className={`px-3 py-1.5 rounded-full text-[calc(var(--msg-font-size)-2.5px)] font-medium transition-all border ${
                              isWeekend 
                                ? 'bg-[#21c063] text-white border-[#21c063] shadow-sm' 
                                : 'bg-white dark:bg-[#202c33] text-secondary border-app-border hover:bg-black/5'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[calc(var(--msg-font-size)-3px)] text-secondary uppercase font-bold">Holiday Dates</label>
                    <input
                      value={(formData.schedule.holidayDates || []).join(', ')}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        schedule: {
                          ...prev.schedule,
                          holidayDates: e.target.value.split(',').map(date => normalizeDateKey(date.trim(), '')).filter(Boolean)
                        }
                      }))}
                      placeholder="YYYY-MM-DD, YYYY-MM-DD"
                      className="w-full bg-white dark:bg-[#202c33] border app-border rounded px-3 py-2 text-[calc(var(--msg-font-size)-1.5px)] outline-none text-primary"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Humane / Mood Section */}
        {!chat.isGroup && (
          <div className="mt-2 app-panel shadow-sm border-b app-border">
            <div
              className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-black/5 transition-colors"
              onClick={() => setShowHumane(!showHumane)}
            >
              <div className="flex items-center gap-3">
                <Smile size={20} className="text-secondary" />
                <h4 className="text-[calc(var(--msg-font-size)+0.5px)] text-primary font-medium">Sentience: Humane Settings</h4>
              </div>
              {showHumane ? <ChevronDown size={20} className="text-secondary" /> : <ChevronRight size={20} className="text-secondary" />}
            </div>

            {showHumane && (
              <div className="px-6 py-6 space-y-6 border-t app-border bg-gray-50/50 dark:bg-black/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[length:var(--msg-font-size)] font-medium text-primary">Enable Humane Personality</p>
                    <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">Make the AI feel more human-like</p>
                  </div>
                  <div
                    onClick={() => setFormData(p => ({ ...p, humaneSettings: { ...p.humaneSettings!, enabled: !p.humaneSettings!.enabled } }))}
                    className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${formData.humaneSettings?.enabled ? 'bg-[#21c063]' : 'bg-gray-400'}`}
                  >
                    <div className={`absolute top-[2px] w-4 h-4 bg-white rounded-full shadow-sm transition-all ${formData.humaneSettings?.enabled ? 'left-[22px]' : 'left-[2px]'}`} />
                  </div>
                </div>

                <div className={`space-y-6 transition-opacity ${formData.humaneSettings?.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  
                  {/* Ban Robotic Language */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-[calc(var(--msg-font-size)-0.5px)] font-medium text-primary">Ban Robotic Language</h5>
                      <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">Block corporate AI tropes, sycophancy & interview end-questions</p>
                    </div>
                    <div
                      onClick={() => setFormData(p => ({ ...p, humaneSettings: { ...p.humaneSettings!, banRoboticLanguage: !p.humaneSettings!.banRoboticLanguage } }))}
                      className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${formData.humaneSettings?.banRoboticLanguage ? 'bg-[#21c063]' : 'bg-gray-400'}`}
                    >
                      <div className={`absolute top-[2px] w-3 h-3 bg-white rounded-full shadow-sm transition-all ${formData.humaneSettings?.banRoboticLanguage ? 'left-[18px]' : 'left-[2px]'}`} />
                    </div>
                  </div>

                  {/* Human Imperfections */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-[calc(var(--msg-font-size)-0.5px)] font-medium text-primary">Human Imperfections</h5>
                      <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">Casual texting flow, lowercase starts, contractions & slang</p>
                    </div>
                    <div
                      onClick={() => setFormData(p => ({ ...p, humaneSettings: { ...p.humaneSettings!, humanImperfections: !p.humaneSettings!.humanImperfections } }))}
                      className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${formData.humaneSettings?.humanImperfections ? 'bg-[#21c063]' : 'bg-gray-400'}`}
                    >
                      <div className={`absolute top-[2px] w-3 h-3 bg-white rounded-full shadow-sm transition-all ${formData.humaneSettings?.humanImperfections ? 'left-[18px]' : 'left-[2px]'}`} />
                    </div>
                  </div>

                  {/* Vary Message Length */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="text-[calc(var(--msg-font-size)-0.5px)] font-medium text-primary">Vary Message Length</h5>
                          <button
                            type="button"
                            onClick={() => setShowVaryLengthPromptDropdown(!showVaryLengthPromptDropdown)}
                            className="inline-flex items-center gap-1 text-[11px] text-[#00a884] dark:text-[#25d366] hover:underline cursor-pointer"
                            title="View and edit message pacing prompt"
                          >
                            <span>Prompt</span>
                            {showVaryLengthPromptDropdown ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          </button>
                        </div>
                        <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">Natural WhatsApp pacing: quick quips & dynamic 1-2 line bursts</p>
                      </div>
                      <div
                        onClick={() => {
                          const nextVal = !formData.humaneSettings?.varyMessageLength;
                          setFormData(p => ({
                            ...p,
                            humaneSettings: {
                              ...p.humaneSettings!,
                              varyMessageLength: nextVal,
                              varyMessageLengthPrompt: p.humaneSettings?.varyMessageLengthPrompt || DEFAULT_VARY_MESSAGE_LENGTH_PROMPT
                            }
                          }));
                          if (nextVal) {
                            setShowVaryLengthPromptDropdown(true);
                          }
                        }}
                        className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${formData.humaneSettings?.varyMessageLength ? 'bg-[#21c063]' : 'bg-gray-400'}`}
                      >
                        <div className={`absolute top-[2px] w-3 h-3 bg-white rounded-full shadow-sm transition-all ${formData.humaneSettings?.varyMessageLength ? 'left-[18px]' : 'left-[2px]'}`} />
                      </div>
                    </div>

                    {/* Dropdown Menu to View & Edit Vary Message Length Prompt */}
                    {showVaryLengthPromptDropdown && (
                      <div className="p-3.5 rounded-lg bg-black/5 dark:bg-white/5 border app-border space-y-3 transition-all">
                        <div className="flex items-center justify-between">
                          <label className="text-[12px] font-semibold text-primary">Pacing Directive Preset</label>
                          <button
                            type="button"
                            onClick={() => setFormData(p => ({
                              ...p,
                              humaneSettings: {
                                ...p.humaneSettings!,
                                varyMessageLengthPrompt: DEFAULT_VARY_MESSAGE_LENGTH_PROMPT
                              }
                            }))}
                            className="text-[11px] text-secondary hover:text-primary transition-colors hover:underline"
                          >
                            Reset to default
                          </button>
                        </div>

                        <select
                          className="w-full text-xs p-2 rounded-md bg-white dark:bg-[#1f2c34] border app-border text-primary focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                          value={(() => {
                            const cur = formData.humaneSettings?.varyMessageLengthPrompt || DEFAULT_VARY_MESSAGE_LENGTH_PROMPT;
                            const found = VARY_MESSAGE_LENGTH_PRESETS.find(pr => pr.prompt.trim() === cur.trim());
                            return found ? found.id : 'custom';
                          })()}
                          onChange={(e) => {
                            const presetId = e.target.value;
                            const preset = VARY_MESSAGE_LENGTH_PRESETS.find(p => p.id === presetId);
                            if (preset && preset.prompt) {
                              setFormData(p => ({
                                ...p,
                                humaneSettings: {
                                  ...p.humaneSettings!,
                                  varyMessageLengthPrompt: preset.prompt
                                }
                              }));
                            }
                          }}
                        >
                          {VARY_MESSAGE_LENGTH_PRESETS.map(pr => (
                            <option key={pr.id} value={pr.id}>{pr.label}</option>
                          ))}
                          <option value="custom">Custom (User Defined)</option>
                        </select>

                        <div className="space-y-1">
                          <span className="text-[11px] text-secondary">Custom Prompt Instructions:</span>
                          <textarea
                            rows={5}
                            value={formData.humaneSettings?.varyMessageLengthPrompt ?? DEFAULT_VARY_MESSAGE_LENGTH_PROMPT}
                            onChange={(e) => setFormData(p => ({
                              ...p,
                              humaneSettings: {
                                ...p.humaneSettings!,
                                varyMessageLengthPrompt: e.target.value
                              }
                            }))}
                            className="w-full text-[11.5px] font-mono p-2.5 rounded-md bg-white dark:bg-[#1f2c34] border app-border text-primary focus:outline-none focus:ring-1 focus:ring-[#00a884] resize-y leading-relaxed"
                            placeholder="Enter custom prompt instructions for message pacing..."
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Mood Slider */}
                  <div className="pt-2 border-t app-border space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="text-[calc(var(--msg-font-size)-0.5px)] font-medium text-primary">Mood Control</h5>
                        <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">Real-time emotional state & warmth control (0–100)</p>
                      </div>
                      <div
                        onClick={() => setFormData(p => ({ ...p, humaneSettings: { ...p.humaneSettings!, moodSliderEnabled: !p.humaneSettings!.moodSliderEnabled } }))}
                        className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${formData.humaneSettings?.moodSliderEnabled ? 'bg-[#21c063]' : 'bg-gray-400'}`}
                      >
                        <div className={`absolute top-[2px] w-3 h-3 bg-white rounded-full shadow-sm transition-all ${formData.humaneSettings?.moodSliderEnabled ? 'left-[18px]' : 'left-[2px]'}`} />
                      </div>
                    </div>

                    {formData.humaneSettings?.moodSliderEnabled && (
                      <div className="space-y-2">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={formData.humaneSettings?.moodValue}
                          onChange={(e) => setFormData(p => ({ ...p, humaneSettings: { ...p.humaneSettings!, moodValue: parseInt(e.target.value) } }))}
                          className="w-full accent-[#21c063] h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                        />
                        <div className="text-center font-medium text-[calc(var(--msg-font-size)-1px)] text-primary">
                          {(() => {
                            const val = formData.humaneSettings?.moodValue || 50;
                            if (val <= 15) return "Very Annoyed / Curt (0–15)";
                            if (val <= 35) return "Grumpy / Low Energy (16–35)";
                            if (val <= 50) return "Indifferent / Cool (36–50)";
                            if (val <= 65) return "Tranquil / Balanced (51–65)";
                            if (val <= 80) return "Warm / Affectionate (66–80)";
                            if (val <= 92) return "Excited / Bubbly (81–92)";
                            return "Thrilled / Ecstatic (93–100)";
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            )}
          </div>
        )}

        {/* Voice Note Settings Section */}
        {!chat.isGroup && (
          <div className="mt-2 app-panel shadow-sm border-b app-border">
            <div
              className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-black/5 transition-colors"
              onClick={() => setShowVoiceSettings(!showVoiceSettings)}
            >
              <div className="flex items-center gap-3">
                <Mic size={20} className="text-[#21c063]" />
                <div>
                  <h4 className="text-[calc(var(--msg-font-size)+0.5px)] text-primary font-medium">Voice Settings</h4>
                  <p className="text-[calc(var(--msg-font-size)-3px)] text-secondary">
                    {(() => {
                      if (formData.voiceSettings?.frequency === 'off') return 'Off · Plain text only';
                      let activeVoiceLabel = formData.voiceSettings?.voiceName || 'Aoede';
                      if (formData.voiceSettings?.enableVoiceDesign && formData.voiceSettings?.designedVoiceId) {
                        activeVoiceLabel = `${formData.voiceSettings?.designedVoiceName || 'Designed Voice'} (Prompted)`;
                      } else if (formData.voiceSettings?.enableVoiceReplication && formData.voiceSettings?.replicatedVoiceId) {
                        activeVoiceLabel = `${formData.voiceSettings?.replicatedVoiceName || 'Replicated Voice'} (Cloned)`;
                      }
                      const freq = formData.voiceSettings?.frequency || 'off';
                      const modelLabel = formData.voiceSettings?.voiceModel
                        ? (AVAILABLE_VOICE_MODELS.find(m => m.id === formData.voiceSettings?.voiceModel)?.label?.split(' ')[0] + ' ' + AVAILABLE_VOICE_MODELS.find(m => m.id === formData.voiceSettings?.voiceModel)?.label?.split(' ')[1] || formData.voiceSettings?.voiceModel)
                        : 'App Default';
                      return `${activeVoiceLabel} · ${freq} · ${modelLabel}`;
                    })()}
                  </p>
                </div>
              </div>
              {showVoiceSettings ? <ChevronDown size={20} className="text-secondary" /> : <ChevronRight size={20} className="text-secondary" />}
            </div>

            {showVoiceSettings && (() => {
              const activeVoiceModel = formData.voiceSettings?.voiceModel || settings?.selectedVoiceModel || DEFAULT_VOICE_MODEL;
              const is38VoiceModel = activeVoiceModel.includes('3.8');
              return (
                <div className="px-6 py-6 space-y-6 border-t app-border bg-gray-50/50 dark:bg-black/10">
                {/* Voice Generation Model (Dropdown) */}
                <div className="space-y-2">
                  <div>
                    <label className="text-[calc(var(--msg-font-size)-0.5px)] font-medium text-primary">Voice Generation Model</label>
                    <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">
                      Choose which voice engine this persona uses (Gemini 3.8 Flash-Lite TTS default)
                    </p>
                  </div>

                  <select
                    value={formData.voiceSettings?.voiceModel || ''}
                    onChange={(e) => {
                      const newModel = e.target.value;
                      const updatedVoiceSettings: PersonaVoiceSettings = {
                        ...(formData.voiceSettings || DEFAULT_VOICE_SETTINGS),
                        voiceModel: newModel
                      };
                      setFormData(p => ({
                        ...p,
                        voiceSettings: updatedVoiceSettings
                      }));
                      onUpdate({ voiceSettings: updatedVoiceSettings });
                    }}
                    className="w-full bg-white dark:bg-[#202c33] border app-border rounded-lg px-3 py-2.5 text-[calc(var(--msg-font-size)-1px)] outline-none text-primary cursor-pointer shadow-sm"
                  >
                    <option value="">
                      Use App Default ({AVAILABLE_VOICE_MODELS.find(m => m.id === (settings?.selectedVoiceModel || DEFAULT_VOICE_MODEL))?.label || 'Gemini 3.8 Flash TTS'})
                    </option>
                    {AVAILABLE_VOICE_MODELS.map(model => (
                      <option key={model.id} value={model.id}>{model.label}</option>
                    ))}
                  </select>
                </div>

                {/* Gemini 3.8 Exclusivity Notice (if non-3.8 model selected) */}
                {!is38VoiceModel ? (
                  <div className="p-3.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[calc(var(--msg-font-size)-2px)] text-secondary space-y-1">
                    <div className="flex items-center gap-2 font-semibold text-primary">
                      <Sparkles size={16} className="text-blue-500 shrink-0" />
                      <span>Gemini 3.8 Voice Studio Suite</span>
                    </div>
                    <p>
                      Voice Design (prompted custom voices), Instant Voice Replication (acoustic cloning), and single-pass vocal acting directives are exclusive to Gemini 3.8 voice models. Switch Voice Generation Model above to <strong>Gemini 3.8 Flash TTS</strong> or <strong>Gemini 3.8 Flash-Lite TTS</strong> to unlock them!
                    </p>
                  </div>
                ) : (
                  <>
                    {/* FEATURE A: VOICE DESIGN (Togglable) */}
                    <div className="space-y-3 p-3.5 bg-black/[0.02] dark:bg-white/[0.03] border app-border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles size={18} className="text-[#21c063]" />
                          <div>
                            <div className="flex items-center gap-2">
                              <label className="text-[calc(var(--msg-font-size)-0.5px)] font-medium text-primary">Voice Design</label>
                              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#21c063]/10 text-[#21c063] border border-[#21c063]/20">Prompted</span>
                            </div>
                            <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">Craft custom vocal personas from natural language</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowVoiceDesignInfo(true)}
                            className="p-1 text-secondary hover:text-primary rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                            title="Voice Design Guide"
                          >
                            <HelpCircle size={16} />
                          </button>
                          {/* Toggle Switch */}
                          <div
                            onClick={() => {
                              const newEnabled = !(formData.voiceSettings?.enableVoiceDesign ?? false);
                              const updatedVoiceSettings: PersonaVoiceSettings = {
                                ...(formData.voiceSettings || DEFAULT_VOICE_SETTINGS),
                                enableVoiceDesign: newEnabled,
                                ...(newEnabled ? { enableVoiceReplication: false } : {})
                              };
                              setFormData(p => ({ ...p, voiceSettings: updatedVoiceSettings }));
                              onUpdate({ voiceSettings: updatedVoiceSettings });
                            }}
                            className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors shrink-0 ${
                              (formData.voiceSettings?.enableVoiceDesign ?? false) ? 'bg-[#21c063]' : 'bg-gray-400'
                            }`}
                          >
                            <div
                              className={`absolute top-[2px] w-4 h-4 bg-white rounded-full shadow-sm transition-all ${
                                (formData.voiceSettings?.enableVoiceDesign ?? false) ? 'left-[22px]' : 'left-[2px]'
                              }`}
                            />
                          </div>
                        </div>
                      </div>

                      {formData.voiceSettings?.enableVoiceDesign && (() => {
                        const designedVoices = customVoices.filter(v => isDesignedVoice(v));
                        const currentSelectedVoice = customVoices.find(v => v.id === formData.voiceSettings?.designedVoiceId);
                        const isPlayingSelected = currentSelectedVoice && (playingPreviewVoiceId === currentSelectedVoice.id);
                        const selectedAudioPreview = currentSelectedVoice 
                          ? (currentSelectedVoice.sampleAudioDataUrl || getVoiceAudioPreview(currentSelectedVoice.id)) 
                          : undefined;

                        return (
                          <div className="space-y-3 pt-2.5 border-t app-border animate-in fade-in duration-200">
                            {/* Header: Library count + Reset option */}
                            <div className="flex items-center justify-between gap-2 pb-0.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[11px] font-medium text-secondary whitespace-nowrap">
                                  Saved Voices
                                </span>
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-[#21c063]/15 text-[#00a884] whitespace-nowrap">
                                  {designedVoices.length} saved
                                </span>
                              </div>
                              {formData.voiceSettings?.designedVoiceId && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updatedVoiceSettings: PersonaVoiceSettings = {
                                      ...(formData.voiceSettings || DEFAULT_VOICE_SETTINGS),
                                      designedVoiceId: undefined,
                                      designedVoiceName: undefined
                                    };
                                    setFormData(p => ({ ...p, voiceSettings: updatedVoiceSettings }));
                                    onUpdate({ voiceSettings: updatedVoiceSettings });
                                  }}
                                  className="text-[11px] text-secondary hover:text-red-500 transition-colors whitespace-nowrap font-medium shrink-0"
                                  title="Reset to default voice"
                                >
                                  Reset to default
                                </button>
                              )}
                            </div>

                            {/* Dropdown Selector */}
                            <div className="space-y-1">
                              <select
                                value={formData.voiceSettings?.designedVoiceId || ''}
                                onChange={(e) => {
                                  const selectedId = e.target.value;
                                  if (!selectedId) {
                                    const updatedVoiceSettings: PersonaVoiceSettings = {
                                      ...(formData.voiceSettings || DEFAULT_VOICE_SETTINGS),
                                      designedVoiceId: undefined,
                                      designedVoiceName: undefined
                                    };
                                    setFormData(p => ({ ...p, voiceSettings: updatedVoiceSettings }));
                                    onUpdate({ voiceSettings: updatedVoiceSettings });
                                    return;
                                  }
                                  const selected = customVoices.find(v => v.id === selectedId);
                                  if (selected) {
                                    const updatedVoiceSettings: PersonaVoiceSettings = {
                                      ...(formData.voiceSettings || DEFAULT_VOICE_SETTINGS),
                                      enableVoiceDesign: true,
                                      enableVoiceReplication: false,
                                      designedVoiceId: selected.id,
                                      designedVoiceName: selected.name || (selected as any).displayName || 'Designed Voice',
                                      stylePrompt: selected.promptDescription || formData.voiceSettings?.stylePrompt
                                    };
                                    setFormData(p => ({ ...p, voiceSettings: updatedVoiceSettings }));
                                    onUpdate({ voiceSettings: updatedVoiceSettings });
                                  }
                                }}
                                className="w-full bg-white dark:bg-[#111b21] border app-border focus:border-[#00a884] rounded-lg px-3 py-2 text-xs outline-none text-primary cursor-pointer shadow-sm transition-colors"
                              >
                                <option value="">
                                  {designedVoices.length === 0 ? "-- No designed voices in library --" : "-- Choose a designed voice --"}
                                </option>
                                {designedVoices.map(v => (
                                  <option key={v.id} value={v.id}>
                                    {v.name || (v as any).displayName || 'Custom Voice'} ({v.gender ? (v.gender.charAt(0).toUpperCase() + v.gender.slice(1)) : 'Designed'})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Active Selected Voice Card */}
                            {currentSelectedVoice ? (
                              <div className="p-3 rounded-xl border border-[#00a884]/40 bg-[#00a884]/5 dark:bg-[#00a884]/10 space-y-2.5 animate-in fade-in duration-150">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-full bg-[#00a884] text-white flex items-center justify-center shrink-0 shadow-sm">
                                      <Wand2 size={15} />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-xs font-semibold text-primary truncate max-w-[150px]">
                                          {currentSelectedVoice.name || (currentSelectedVoice as any).displayName || 'Designed Voice'}
                                        </span>
                                        {currentSelectedVoice.gender && (
                                          <span className={`text-[9.5px] font-semibold px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                                            currentSelectedVoice.gender.toLowerCase() === 'female'
                                              ? 'bg-pink-500/10 text-pink-600 dark:text-pink-400'
                                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                          }`}>
                                            {currentSelectedVoice.gender}
                                          </span>
                                        )}
                                        <span className="text-[9.5px] font-bold text-[#00a884] bg-[#00a884]/20 px-1.5 py-0.2 rounded-full">
                                          Active
                                        </span>
                                      </div>
                                      <p className="text-[10.5px] text-secondary">
                                        Assigned to {formData.name || 'this contact'}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Quick Action Icons */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    {selectedAudioPreview && (
                                      <button
                                        type="button"
                                        onClick={() => playAudioPreview(selectedAudioPreview, currentSelectedVoice.id)}
                                        className={`p-1.5 rounded-full transition-colors ${
                                          isPlayingSelected
                                            ? 'bg-[#00a884] text-white'
                                            : 'text-[#00a884] hover:bg-[#00a884]/10'
                                        }`}
                                        title={isPlayingSelected ? "Stop sample preview" : "Audition voice sample"}
                                      >
                                        {isPlayingSelected ? <Square size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={(e) => handleDeleteCustomVoice(currentSelectedVoice.id, e)}
                                      className="p-1.5 text-secondary hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                                      title="Delete voice from library"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>

                                {currentSelectedVoice.promptDescription && (
                                  <div className="p-2 rounded-lg bg-black/[0.03] dark:bg-white/[0.03] border-l-2 border-[#00a884]">
                                    <p className="text-[11px] text-secondary italic leading-relaxed">
                                      "{currentSelectedVoice.promptDescription}"
                                    </p>
                                  </div>
                                )}

                                {/* WhatsApp Green Test Button */}
                                <button
                                  type="button"
                                  disabled={isTestingVoiceNote}
                                  onClick={() => handleTestDesignedVoiceNote(currentSelectedVoice)}
                                  className="w-full flex items-center justify-center gap-2 text-xs text-white bg-[#00a884] hover:bg-[#008f6f] py-2 px-3 rounded-lg font-medium shadow-sm transition-all disabled:opacity-50"
                                >
                                  {isTestingVoiceNote ? (
                                    <>
                                      <Loader2 size={14} className="animate-spin" />
                                      <span>Generating Test Note...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Play size={14} fill="currentColor" />
                                      <span>Test Voice Note as {formData.name || 'Persona'}</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            ) : (
                              <div className="p-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700/80 text-center space-y-1 bg-black/[0.01] dark:bg-white/[0.01]">
                                <p className="text-xs font-medium text-primary">
                                  {designedVoices.length > 0 ? "No Voice Selected" : "No Designed Voices Saved"}
                                </p>
                                <p className="text-[11px] text-secondary">
                                  {designedVoices.length > 0
                                    ? "Select a voice from the dropdown above to activate it for " + (formData.name || 'this persona') + "."
                                    : "Craft your first custom voice below. Once created, it can be freely reused on any persona."}
                                </p>
                              </div>
                            )}

                            {/* Toggle Craft Panel Button */}
                            <button
                              type="button"
                              onClick={() => setShowCraftVoicePanel(!showCraftVoicePanel)}
                              className="w-full flex items-center justify-center gap-1.5 text-xs text-[#21c063] font-medium py-2 hover:bg-[#21c063]/10 rounded-lg border border-[#21c063]/30 transition-colors"
                            >
                              {showCraftVoicePanel ? (
                                <>
                                  <X size={14} />
                                  <span>Close Craft Panel</span>
                                </>
                              ) : (
                                <>
                                  <Plus size={14} />
                                  <span>Craft New Voice</span>
                                </>
                              )}
                            </button>

                            {/* Collapsible Crafting Form */}
                            {showCraftVoicePanel && (
                            <div className="p-3 bg-white dark:bg-[#202c33] border app-border rounded-lg space-y-3 animate-in zoom-in-95 duration-150">
                              <h6 className="text-xs font-semibold text-primary">Craft New Custom Voice</h6>

                              <div className="space-y-1">
                                <span className="text-[11px] text-secondary">Voice Name:</span>
                                <input
                                  type="text"
                                  value={craftName}
                                  onChange={(e) => setCraftName(e.target.value)}
                                  placeholder="e.g. Victorian Butler, Cyberpunk AI..."
                                  className="w-full bg-transparent border app-border rounded px-2.5 py-1.5 text-xs outline-none text-primary"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <span className="text-[11px] text-secondary">Gender:</span>
                                  <select
                                    value={craftGender}
                                    onChange={(e) => setCraftGender(e.target.value as any)}
                                    className="w-full bg-white dark:bg-[#111b21] border app-border rounded px-2 py-1.5 text-xs outline-none text-primary"
                                  >
                                    <option value="FEMALE">Female</option>
                                    <option value="MALE">Male</option>
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[11px] text-secondary">Language:</span>
                                  <select
                                    value={craftLanguage}
                                    onChange={(e) => setCraftLanguage(e.target.value)}
                                    className="w-full bg-white dark:bg-[#111b21] border app-border rounded px-2 py-1.5 text-xs outline-none text-primary"
                                  >
                                    <option value="en-US">English (US)</option>
                                    <option value="en-GB">English (UK)</option>
                                    <option value="es-ES">Spanish (ES)</option>
                                    <option value="ja-JP">Japanese (JA)</option>
                                    <option value="hi-IN">Hindi (IN)</option>
                                    <option value="fr-FR">French (FR)</option>
                                    <option value="de-DE">German (DE)</option>
                                  </select>
                                </div>
                              </div>

                              {/* Inspiration chips */}
                              <div className="space-y-1.5">
                                <span className="text-[10px] text-secondary font-medium uppercase tracking-wider">Inspirations:</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {VOICE_DESIGN_INSPIRATIONS.map((insp, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => {
                                        setCraftName(insp.title);
                                        setCraftPrompt(insp.prompt);
                                        setCraftGender(insp.gender === 'male' ? 'MALE' : 'FEMALE');
                                        setCraftLanguage(insp.languageCode);
                                      }}
                                      className="text-[10px] px-2 py-1 bg-black/5 dark:bg-white/5 hover:bg-[#21c063]/10 hover:text-[#21c063] rounded border app-border transition-colors text-secondary"
                                    >
                                      {insp.title}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-1">
                                <span className="text-[11px] text-secondary">Natural Language Description:</span>
                                <textarea
                                  rows={3}
                                  value={craftPrompt}
                                  onChange={(e) => setCraftPrompt(e.target.value)}
                                  placeholder="Describe age, accent, pitch, timbre, vocal texture, pace..."
                                  className="w-full bg-transparent border app-border rounded p-2 text-xs outline-none text-primary resize-none"
                                />
                              </div>

                              {craftError && (
                                <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-[11px] text-red-500 flex items-center gap-1.5">
                                  <AlertCircle size={14} className="shrink-0" />
                                  <span>{craftError}</span>
                                </div>
                              )}

                              <button
                                type="button"
                                disabled={isCraftingVoice || !craftPrompt.trim()}
                                onClick={handleExecuteCraftVoice}
                                className="w-full bg-[#21c063] hover:bg-[#008069] text-white py-2 rounded font-medium text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                              >
                                {isCraftingVoice ? (
                                  <>
                                    <Loader2 size={14} className="animate-spin" />
                                    <span>Synthesizing Voice via Vertex AI...</span>
                                  </>
                                ) : (
                                  <>
                                    <Wand2 size={14} />
                                    <span>Synthesize & Save Voice</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                    {/* FEATURE B: VOICE REPLICATION (Togglable) */}
                    <div className="space-y-3 p-3.5 bg-black/[0.02] dark:bg-white/[0.03] border app-border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Mic size={18} className="text-blue-500" />
                          <div>
                            <div className="flex items-center gap-2">
                              <label className="text-[calc(var(--msg-font-size)-0.5px)] font-medium text-primary">Voice Replication</label>
                              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">Cloning</span>
                            </div>
                            <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">Clone any voice from a 10-30s audio sample</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowVoiceReplicationInfo(true)}
                            className="p-1 text-secondary hover:text-primary rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                            title="Voice Replication Guide"
                          >
                            <HelpCircle size={16} />
                          </button>
                          {/* Toggle Switch */}
                          <div
                            onClick={() => {
                              const newEnabled = !(formData.voiceSettings?.enableVoiceReplication ?? false);
                              const updatedVoiceSettings: PersonaVoiceSettings = {
                                ...(formData.voiceSettings || DEFAULT_VOICE_SETTINGS),
                                enableVoiceReplication: newEnabled,
                                ...(newEnabled ? { enableVoiceDesign: false } : {})
                              };
                              setFormData(p => ({ ...p, voiceSettings: updatedVoiceSettings }));
                              onUpdate({ voiceSettings: updatedVoiceSettings });
                            }}
                            className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors shrink-0 ${
                              (formData.voiceSettings?.enableVoiceReplication ?? false) ? 'bg-[#21c063]' : 'bg-gray-400'
                            }`}
                          >
                            <div
                              className={`absolute top-[2px] w-4 h-4 bg-white rounded-full shadow-sm transition-all ${
                                (formData.voiceSettings?.enableVoiceReplication ?? false) ? 'left-[22px]' : 'left-[2px]'
                              }`}
                            />
                          </div>
                        </div>
                      </div>

                      {formData.voiceSettings?.enableVoiceReplication && (() => {
                        const replicatedVoices = customVoices.filter(v => isReplicatedVoice(v));
                        return (
                          <div className="space-y-3 pt-2 border-t app-border animate-in fade-in duration-200">
                            {/* Select saved replicated voice */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] text-secondary font-medium">Saved Cloned Voice:</span>
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-500/15 text-blue-500">
                                  {replicatedVoices.length} saved
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <select
                                  value={formData.voiceSettings?.replicatedVoiceId || ''}
                                  onChange={(e) => {
                                    const selectedId = e.target.value;
                                    const selected = customVoices.find(v => v.id === selectedId);
                                    const updatedVoiceSettings: PersonaVoiceSettings = {
                                      ...(formData.voiceSettings || DEFAULT_VOICE_SETTINGS),
                                      replicatedVoiceId: selectedId || undefined,
                                      replicatedVoiceName: selected?.name || (selected as any)?.displayName || undefined
                                    };
                                    setFormData(p => ({ ...p, voiceSettings: updatedVoiceSettings }));
                                    onUpdate({ voiceSettings: updatedVoiceSettings });
                                  }}
                                  className="w-full bg-white dark:bg-[#111b21] border app-border focus:border-blue-500 rounded-lg px-3 py-2 text-xs outline-none text-primary cursor-pointer shadow-sm transition-colors"
                                >
                                  <option value="">-- Choose a cloned voice ({replicatedVoices.length} available) --</option>
                                  {replicatedVoices.map(v => (
                                    <option key={v.id} value={v.id}>
                                      {v.name || (v as any).displayName || 'Cloned Voice'}
                                    </option>
                                  ))}
                                </select>

                              {formData.voiceSettings?.replicatedVoiceId && (
                                <>
                                  {(() => {
                                    const currentVoice = customVoices.find(v => v.id === formData.voiceSettings?.replicatedVoiceId);
                                    if (currentVoice?.sampleAudioDataUrl) {
                                      return (
                                        <button
                                          type="button"
                                          onClick={() => playAudioPreview(currentVoice.sampleAudioDataUrl!, currentVoice.id)}
                                          className="p-2 text-[#21c063] hover:bg-[#21c063]/10 rounded-lg transition-colors shrink-0"
                                          title={playingPreviewVoiceId === currentVoice.id ? "Stop sample preview" : "Listen to reference audio"}
                                        >
                                          {playingPreviewVoiceId === currentVoice.id ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                                        </button>
                                      );
                                    }
                                    return null;
                                  })()}
                                  <button
                                    type="button"
                                    onClick={(e) => handleDeleteCustomVoice(formData.voiceSettings!.replicatedVoiceId!, e)}
                                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                                    title="Delete this saved voice"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                            </div>

                            {formData.voiceSettings?.replicatedVoiceId && (
                              <button
                                type="button"
                                disabled={isTestingVoiceNote}
                                onClick={() => {
                                  const repVoice = customVoices.find(v => v.id === formData.voiceSettings?.replicatedVoiceId);
                                  handleTestDesignedVoiceNote(repVoice);
                                }}
                                className="w-full flex items-center justify-center gap-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 py-1.5 px-3 rounded-lg font-medium shadow-sm transition-all disabled:opacity-50"
                              >
                                {isTestingVoiceNote ? (
                                  <>
                                    <Loader2 size={14} className="animate-spin" />
                                    <span>Generating Test Note...</span>
                                  </>
                                ) : (
                                  <>
                                    <Play size={14} fill="currentColor" />
                                    <span>Test Cloned Voice as {formData.name || 'Persona'}</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>

                          {/* Toggle Clone Panel Button */}
                          <button
                            type="button"
                            onClick={() => setShowReplicatePanel(!showReplicatePanel)}
                            className="w-full flex items-center justify-center gap-1.5 text-xs text-blue-500 font-medium py-1.5 hover:bg-blue-500/10 rounded-lg border border-blue-500/20 transition-colors"
                          >
                            <Plus size={14} />
                            {showReplicatePanel ? "Close Clone Panel" : "Clone New Voice"}
                          </button>

                          {/* Collapsible Cloning Form */}
                          {showReplicatePanel && (
                            <div className="p-3 bg-white dark:bg-[#202c33] border app-border rounded-lg space-y-3.5 animate-in zoom-in-95 duration-150">
                              <div className="flex items-center justify-between border-b app-border pb-1.5">
                                <h6 className="text-xs font-semibold text-primary">Clone New Voice (Replication)</h6>
                                <span className="text-[10px] text-blue-500 font-medium">Vertex AI Voices</span>
                              </div>

                              <div className="space-y-1">
                                <span className="text-[11px] text-secondary font-medium">Voice Name:</span>
                                <input
                                  type="text"
                                  value={replicateName}
                                  onChange={(e) => setReplicateName(e.target.value)}
                                  placeholder="e.g. My Voice Clone, Persona Voice..."
                                  className="w-full bg-transparent border app-border rounded px-2.5 py-1.5 text-xs outline-none text-primary shadow-sm"
                                />
                              </div>

                              {/* SECTION 1: REFERENCE VOICE SAMPLE */}
                              <div className="space-y-2 p-2.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border app-border">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] text-primary font-semibold flex items-center gap-1.5">
                                    <span>1. Reference Voice Sample (10–30s)</span>
                                  </span>
                                  {replicationAudioUrl && (
                                    <span className="text-[10px] text-[#21c063] font-medium flex items-center gap-1">
                                      <Check size={12} /> Ready
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-secondary">
                                  Clean speech of the voice you want to clone without background music or noise.
                                </p>

                                <div className="grid grid-cols-2 gap-2">
                                  {/* Mic Button */}
                                  {!isRecordingReplication ? (
                                    <button
                                      type="button"
                                      onClick={startRecordingReplicationAudio}
                                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded border app-border hover:bg-black/5 dark:hover:bg-white/5 text-xs text-primary transition-colors shadow-sm"
                                    >
                                      <Mic size={14} className="text-red-500" />
                                      <span>Record Mic</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={stopRecordingReplicationAudio}
                                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded bg-red-500 text-white text-xs font-medium animate-pulse shadow-sm"
                                    >
                                      <Square size={12} fill="currentColor" />
                                      <span>Stop ({recordingDuration}s)</span>
                                    </button>
                                  )}

                                  {/* Upload File Button */}
                                  <input
                                    type="file"
                                    ref={replicationFileInputRef}
                                    accept="audio/*,.wav,.mp3,.m4a,.webm,.ogg"
                                    onChange={handleReplicationFileUpload}
                                    className="hidden"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => replicationFileInputRef.current?.click()}
                                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded border app-border hover:bg-black/5 dark:hover:bg-white/5 text-xs text-primary transition-colors shadow-sm"
                                  >
                                    <Upload size={14} className="text-blue-500" />
                                    <span>Upload File</span>
                                  </button>
                                </div>

                                {/* Audio Sample Preview */}
                                {replicationAudioUrl && (
                                  <div className="flex items-center justify-between p-2 rounded bg-white dark:bg-[#111b21] border app-border">
                                    <div className="flex items-center gap-2 text-xs text-primary">
                                      <Check size={14} className="text-[#21c063]" />
                                      <span className="text-[11px]">Reference Sample (24kHz WAV)</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => playAudioPreview(replicationAudioUrl)}
                                      className="p-1 text-[#21c063] hover:bg-[#21c063]/10 rounded transition-colors"
                                      title="Play reference audio"
                                    >
                                      <Play size={14} fill="currentColor" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* SECTION 2: SPOKEN CONSENT VERIFICATION */}
                              <div className="space-y-2.5 p-2.5 rounded-lg bg-blue-500/[0.04] dark:bg-blue-500/[0.06] border border-blue-500/20">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1.5">
                                    <span>2. Spoken Consent Verification</span>
                                  </span>
                                  {consentAudioUrl && (
                                    <span className="text-[10px] text-[#21c063] font-medium flex items-center gap-1">
                                      <Check size={12} /> Verified Ready
                                    </span>
                                  )}
                                </div>
                                
                                <p className="text-[10px] text-secondary leading-snug">
                                  Google Cloud requires the speaker to recite this exact statement word-for-word to verify voice ownership:
                                </p>

                                {/* Quote & Copy Block */}
                                <div className="p-2.5 bg-white dark:bg-[#111b21] border app-border rounded-lg space-y-2">
                                  <p className="text-[11px] text-primary italic font-serif leading-relaxed select-all">
                                    "{GOOGLE_CONSENT_STATEMENT}"
                                  </p>
                                  <div className="flex justify-end">
                                    <button
                                      type="button"
                                      onClick={handleCopyConsentPhrase}
                                      className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-600 font-medium px-2 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                                    >
                                      {hasCopiedConsentPhrase ? (
                                        <>
                                          <Check size={12} className="text-[#21c063]" />
                                          <span className="text-[#21c063]">Copied to clipboard</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy size={12} />
                                          <span>Copy Statement</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  {/* Consent Mic Button */}
                                  {!isRecordingConsent ? (
                                    <button
                                      type="button"
                                      onClick={startRecordingConsentAudio}
                                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded border app-border bg-white dark:bg-[#111b21] hover:bg-black/5 dark:hover:bg-white/5 text-xs text-primary transition-colors shadow-sm"
                                    >
                                      <Mic size={14} className="text-red-500" />
                                      <span>Record Consent</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={stopRecordingConsentAudio}
                                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded bg-red-500 text-white text-xs font-medium animate-pulse shadow-sm"
                                    >
                                      <Square size={12} fill="currentColor" />
                                      <span>Stop ({consentRecordingDuration}s)</span>
                                    </button>
                                  )}

                                  {/* Consent File Upload */}
                                  <input
                                    type="file"
                                    ref={consentFileInputRef}
                                    accept="audio/*,.wav,.mp3,.m4a,.webm,.ogg"
                                    onChange={handleConsentFileUpload}
                                    className="hidden"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => consentFileInputRef.current?.click()}
                                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded border app-border bg-white dark:bg-[#111b21] hover:bg-black/5 dark:hover:bg-white/5 text-xs text-primary transition-colors shadow-sm"
                                  >
                                    <Upload size={14} className="text-blue-500" />
                                    <span>Upload Consent</span>
                                  </button>
                                </div>

                                {/* Consent Audio Preview */}
                                {consentAudioUrl && (
                                  <div className="flex items-center justify-between p-2 rounded bg-white dark:bg-[#111b21] border app-border">
                                    <div className="flex items-center gap-2 text-xs text-primary">
                                      <Check size={14} className="text-[#21c063]" />
                                      <span className="text-[11px]">Consent Audio (24kHz WAV)</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => playAudioPreview(consentAudioUrl)}
                                      className="p-1 text-[#21c063] hover:bg-[#21c063]/10 rounded transition-colors"
                                      title="Play consent recording"
                                    >
                                      <Play size={14} fill="currentColor" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {replicateError && (
                                <div className="p-2.5 rounded bg-red-500/10 border border-red-500/20 text-[11px] text-red-500 flex items-start gap-1.5 leading-snug">
                                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                                  <span>{replicateError}</span>
                                </div>
                              )}

                              <button
                                type="button"
                                disabled={isReplicatingVoice || !replicationAudioB64 || !consentAudioB64}
                                onClick={handleExecuteReplication}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm"
                              >
                                {isReplicatingVoice ? (
                                  <>
                                    <Loader2 size={14} className="animate-spin" />
                                    <span>Replicating Voice via Vertex AI...</span>
                                  </>
                                ) : (
                                  <>
                                    <Mic size={14} />
                                    <span>Replicate & Save Voice</span>
                                  </>
                                )}
                              </button>

                              {(!replicationAudioB64 || !consentAudioB64) && (
                                <p className="text-[10px] text-secondary text-center">
                                  {!replicationAudioB64 && !consentAudioB64
                                    ? "Provide both a reference speech sample and the consent recording to begin."
                                    : !replicationAudioB64
                                    ? "Almost ready: please provide the reference voice sample above."
                                    : "Almost ready: please provide the spoken consent recording above."}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                    {/* FEATURE C: ADVANCED VOICE PROMPTING & ACTING (Togglable) */}
                    <div className="space-y-3 p-3.5 bg-black/[0.02] dark:bg-white/[0.03] border app-border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Volume2 size={18} className="text-purple-500" />
                          <div>
                            <div className="flex items-center gap-2">
                              <label className="text-[calc(var(--msg-font-size)-0.5px)] font-medium text-primary">Voice Prompting & Acting</label>
                              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500 border border-purple-500/20">Single-Pass</span>
                            </div>
                            <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">Turn-level emotional directives & vocal bursts</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowVoicePromptingInfo(true)}
                            className="p-1 text-secondary hover:text-primary rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                            title="Voice Prompting Guide"
                          >
                            <HelpCircle size={16} />
                          </button>
                          {/* Toggle Switch */}
                          <div
                            onClick={() => {
                              const newEnabled = !(formData.voiceSettings?.enableVoicePrompting ?? true);
                              const updatedVoiceSettings: PersonaVoiceSettings = {
                                ...(formData.voiceSettings || DEFAULT_VOICE_SETTINGS),
                                enableVoicePrompting: newEnabled
                              };
                              setFormData(p => ({ ...p, voiceSettings: updatedVoiceSettings }));
                              onUpdate({ voiceSettings: updatedVoiceSettings });
                            }}
                            className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors shrink-0 ${
                              (formData.voiceSettings?.enableVoicePrompting ?? true) ? 'bg-[#21c063]' : 'bg-gray-400'
                            }`}
                          >
                            <div
                              className={`absolute top-[2px] w-4 h-4 bg-white rounded-full shadow-sm transition-all ${
                                (formData.voiceSettings?.enableVoicePrompting ?? true) ? 'left-[22px]' : 'left-[2px]'
                              }`}
                            />
                          </div>
                        </div>
                      </div>

                      {formData.voiceSettings?.enableVoicePrompting !== false ? (
                        <div className="space-y-3 pt-2 border-t app-border animate-in fade-in duration-200">
                          {/* Style Presets */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-secondary">Emotional Acting Style Preset:</span>
                              {formData.voiceSettings?.stylePrompt && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updatedVoiceSettings: PersonaVoiceSettings = {
                                      ...(formData.voiceSettings || DEFAULT_VOICE_SETTINGS),
                                      stylePrompt: ''
                                    };
                                    setFormData(p => ({ ...p, voiceSettings: updatedVoiceSettings }));
                                    onUpdate({ voiceSettings: updatedVoiceSettings });
                                  }}
                                  className="text-[10px] text-secondary hover:text-primary transition-colors hover:underline"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                            <select
                              value={(() => {
                                const cur = (formData.voiceSettings?.stylePrompt || '').trim();
                                if (!cur) return 'default';
                                const match = VOICE_STYLE_PRESETS.find(p => p.prompt.trim() === cur);
                                return match ? match.id : 'custom';
                              })()}
                              onChange={(e) => {
                                const presetId = e.target.value;
                                const preset = VOICE_STYLE_PRESETS.find(p => p.id === presetId);
                                const newStyle = preset ? preset.prompt : (formData.voiceSettings?.stylePrompt || '');
                                const updatedVoiceSettings: PersonaVoiceSettings = {
                                  ...(formData.voiceSettings || DEFAULT_VOICE_SETTINGS),
                                  stylePrompt: newStyle
                                };
                                setFormData(p => ({ ...p, voiceSettings: updatedVoiceSettings }));
                                onUpdate({ voiceSettings: updatedVoiceSettings });
                              }}
                              className="w-full bg-white dark:bg-[#202c33] border app-border rounded-lg px-3 py-2 text-[calc(var(--msg-font-size)-1px)] outline-none text-primary cursor-pointer shadow-sm"
                            >
                              {VOICE_STYLE_PRESETS.map(preset => (
                                <option key={preset.id} value={preset.id}>{preset.label}</option>
                              ))}
                              <option value="custom">Custom (User Defined Style)</option>
                            </select>
                          </div>

                          {/* Custom Style Directives Prompt */}
                          <div className="space-y-1">
                            <span className="text-[11px] text-secondary">Custom Acting Directives Prompt:</span>
                            <textarea
                              rows={2}
                              value={formData.voiceSettings?.stylePrompt || ''}
                              onChange={(e) => {
                                const updatedVoiceSettings: PersonaVoiceSettings = {
                                  ...(formData.voiceSettings || DEFAULT_VOICE_SETTINGS),
                                  stylePrompt: e.target.value
                                };
                                setFormData(p => ({ ...p, voiceSettings: updatedVoiceSettings }));
                                onUpdate({ voiceSettings: updatedVoiceSettings });
                              }}
                              placeholder="e.g. native american accent, sarcastic and dry, whispered gently, cheerful Southern drawl..."
                              className="w-full bg-white dark:bg-[#202c33] border app-border rounded-md p-2 text-[calc(var(--msg-font-size)-2px)] outline-none resize-none text-primary font-mono"
                            />
                          </div>

                          {/* Speech Pacing / Speed */}
                          <div className="space-y-1">
                            <span className="text-[11px] text-secondary">Speech Delivery Cadence:</span>
                            <select
                              value={formData.voiceSettings?.paceSpeed || 'default'}
                              onChange={(e) => {
                                const updatedVoiceSettings: PersonaVoiceSettings = {
                                  ...(formData.voiceSettings || DEFAULT_VOICE_SETTINGS),
                                  paceSpeed: e.target.value
                                };
                                setFormData(p => ({ ...p, voiceSettings: updatedVoiceSettings }));
                                onUpdate({ voiceSettings: updatedVoiceSettings });
                              }}
                              className="w-full bg-white dark:bg-[#202c33] border app-border rounded-lg px-3 py-2 text-[calc(var(--msg-font-size)-1px)] outline-none text-primary cursor-pointer shadow-sm"
                            >
                              <option value="default">Normal / Conversational Pace (Default)</option>
                              <option value="speaking slowly">Speaking Slowly & Deliberately</option>
                              <option value="speaking rapidly">Speaking Rapidly / Fast-Paced</option>
                            </select>
                          </div>

                          {/* Pitch Tone */}
                          <div className="space-y-1">
                            <span className="text-[11px] text-secondary">Pitch & Vocal Tone:</span>
                            <select
                              value={formData.voiceSettings?.pitchTone || 'default'}
                              onChange={(e) => {
                                const updatedVoiceSettings: PersonaVoiceSettings = {
                                  ...(formData.voiceSettings || DEFAULT_VOICE_SETTINGS),
                                  pitchTone: e.target.value === 'default' ? undefined : e.target.value
                                };
                                setFormData(p => ({ ...p, voiceSettings: updatedVoiceSettings }));
                                onUpdate({ voiceSettings: updatedVoiceSettings });
                              }}
                              className="w-full bg-white dark:bg-[#202c33] border app-border rounded-lg px-3 py-2 text-[calc(var(--msg-font-size)-1px)] outline-none text-primary cursor-pointer shadow-sm"
                            >
                              <option value="default">Natural Baseline Pitch (Default)</option>
                              <option value="slightly higher pitch, bright">Slightly Higher Pitch / Bright Tone</option>
                              <option value="deep pitch, lower resonance">Deep Pitch / Lower Resonance</option>
                            </select>
                          </div>

                          <div className="p-2.5 rounded bg-[#21c063]/10 border border-[#21c063]/20 text-[11px] text-secondary leading-relaxed">
                            <span className="font-semibold text-primary">💡 Gemini 3.8 Acting:</span> Style directives and inline vocal burst tags (<code className="text-[#21c063] font-mono">&lt;laugh&gt;</code>, <code className="text-[#21c063] font-mono">&lt;sigh&gt;</code>, <code className="text-[#21c063] font-mono">&lt;gasp&gt;</code>, <code className="text-[#21c063] font-mono">&lt;whisper&gt;</code>) are synthesized in a single API pass alongside your message.
                          </div>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded bg-black/5 dark:bg-white/5 border app-border text-[11px] text-secondary">
                          Acting directives and vocal bursts are bypassed. Voice notes will use a neutral studio delivery.
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Assigned Voice (Dropdown) with Live Preview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-[calc(var(--msg-font-size)-0.5px)] font-medium text-primary">Assigned Studio Voice</label>
                      <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">Select from 30 expressive vocal personas</p>
                    </div>

                    {/* Preview Voice Button */}
                    <button
                      type="button"
                      disabled={isPreviewingVoice}
                      onClick={async () => {
                        setIsPreviewingVoice(true);
                        try {
                          const activeModel = formData.voiceSettings?.voiceModel || settings?.selectedVoiceModel || DEFAULT_VOICE_MODEL;
                          const is38 = activeModel.includes('3.8');
                          const sampleText = is38
                            ? `Hey there! This is ${formData.name}. <laugh> I can now send you ultra-realistic voice notes directly on WhatsApp!`
                            : `Hey! This is ${formData.name}. [laughs] I can now send you voice notes right here on WhatsApp!`;

                          const res = await generateGeminiVoiceNote(
                            sampleText,
                            formData.voiceSettings?.voiceName || 'Aoede',
                            settings,
                            {
                              name: formData.name,
                              speechStyle: formData.speechStyle,
                              role: formData.role
                            },
                            formData.voiceSettings
                          );
                          if (res.ok && res.audioDataUrl) {
                            playAudioPreview(res.audioDataUrl);
                          } else {
                            alert(res.error || "Unable to generate voice preview. Check API key/Vertex connection.");
                          }
                        } catch (err: any) {
                          alert("Preview failed: " + (err?.message || err));
                        } finally {
                          setIsPreviewingVoice(false);
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#21c063]/10 hover:bg-[#21c063]/20 text-[#21c063] rounded-lg text-[calc(var(--msg-font-size)-2px)] font-semibold transition-colors disabled:opacity-50"
                    >
                      {isPreviewingVoice ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
                      <span>Preview</span>
                    </button>
                  </div>

                  {/* Priority Status Notification */}
                  {formData.voiceSettings?.enableVoiceDesign && formData.voiceSettings?.designedVoiceId ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#21c063]/10 border border-[#21c063]/20 text-[11px] text-[#21c063] font-medium">
                      <Sparkles size={14} className="shrink-0" />
                      <span>Custom Designed Voice active: <strong>{formData.voiceSettings.designedVoiceName || 'Designed Voice'}</strong>. (Prebuilt voice will be used if toggled off)</span>
                    </div>
                  ) : formData.voiceSettings?.enableVoiceReplication && formData.voiceSettings?.replicatedVoiceId ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-500 font-medium">
                      <Mic size={14} className="shrink-0" />
                      <span>Custom Replicated Voice active: <strong>{formData.voiceSettings.replicatedVoiceName || 'Replicated Voice'}</strong>. (Prebuilt voice will be used if toggled off)</span>
                    </div>
                  ) : null}

                  <select
                    value={formData.voiceSettings?.voiceName || 'Aoede'}
                    onChange={(e) => {
                      const newVoice = e.target.value;
                      const updatedVoiceSettings: PersonaVoiceSettings = {
                        ...(formData.voiceSettings || DEFAULT_VOICE_SETTINGS),
                        voiceName: newVoice
                      };
                      setFormData(p => ({
                        ...p,
                        voiceSettings: updatedVoiceSettings
                      }));
                      onUpdate({ voiceSettings: updatedVoiceSettings });
                    }}
                    className="w-full bg-white dark:bg-[#202c33] border app-border rounded-lg px-3 py-2.5 text-[calc(var(--msg-font-size)-1px)] outline-none text-primary cursor-pointer shadow-sm"
                  >
                    <optgroup label="Female Voices (14)">
                      {GEMINI_TTS_VOICES.female.map(v => {
                        const detail = GEMINI_TTS_VOICE_DETAILS[v];
                        return (
                          <option key={v} value={v}>
                            {v} — {detail?.trait || 'Female'}
                          </option>
                        );
                      })}
                    </optgroup>
                    <optgroup label="Male Voices (16)">
                      {GEMINI_TTS_VOICES.male.map(v => {
                        const detail = GEMINI_TTS_VOICE_DETAILS[v];
                        return (
                          <option key={v} value={v}>
                            {v} — {detail?.trait || 'Male'}
                          </option>
                        );
                      })}
                    </optgroup>
                  </select>
                </div>

                {/* Voice Note Frequency (Dropdown) */}
                <div className="space-y-2">
                  <div>
                    <label className="text-[calc(var(--msg-font-size)-0.5px)] font-medium text-primary">Voice Note Frequency</label>
                    <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">How often this persona sends voice notes instead of text</p>
                  </div>

                  <select
                    value={formData.voiceSettings?.frequency || 'off'}
                    onChange={(e) => {
                      const newFreq = e.target.value as VoiceNoteFrequency;
                      const updatedVoiceSettings: PersonaVoiceSettings = {
                        ...(formData.voiceSettings || DEFAULT_VOICE_SETTINGS),
                        frequency: newFreq
                      };
                      setFormData(p => ({
                        ...p,
                        voiceSettings: updatedVoiceSettings
                      }));
                      onUpdate({ voiceSettings: updatedVoiceSettings });
                    }}
                    className="w-full bg-white dark:bg-[#202c33] border app-border rounded-lg px-3 py-2.5 text-[calc(var(--msg-font-size)-1px)] outline-none text-primary cursor-pointer shadow-sm"
                  >
                    <option value="off">Off (Never send voice notes; plain text only)</option>
                    <option value="occasional">Occasional (~10% chance of replying via voice note)</option>
                    <option value="frequent">Frequent (~30% chance of replying via voice note)</option>
                    <option value="always">Always Voice (100% of messages are voice notes)</option>
                  </select>
                </div>

                {/* Voice-for-Voice Mirroring (Toggle Switch) */}
                <div className="flex items-center justify-between pt-2 border-t app-border">
                  <div>
                    <h5 className="text-[calc(var(--msg-font-size)-0.5px)] font-medium text-primary">"Voice-for-Voice" Mirroring</h5>
                    <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">
                      Reply with a voice note whenever you send one (unless Frequency is Off)
                    </p>
                  </div>
                  <div
                    onClick={() => {
                      const newMirror = !(formData.voiceSettings?.voiceForVoice ?? true);
                      const updatedVoiceSettings: PersonaVoiceSettings = {
                        ...(formData.voiceSettings || DEFAULT_VOICE_SETTINGS),
                        voiceForVoice: newMirror
                      };
                      setFormData(p => ({
                        ...p,
                        voiceSettings: updatedVoiceSettings
                      }));
                      onUpdate({ voiceSettings: updatedVoiceSettings });
                    }}
                    className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors shrink-0 ml-3 ${
                      (formData.voiceSettings?.voiceForVoice ?? true) ? 'bg-[#21c063]' : 'bg-gray-400'
                    }`}
                  >
                    <div
                      className={`absolute top-[2px] w-4 h-4 bg-white rounded-full shadow-sm transition-all ${
                        (formData.voiceSettings?.voiceForVoice ?? true) ? 'left-[22px]' : 'left-[2px]'
                      }`}
                    />
                  </div>
                </div>

              </div>
              );
            })()}
          </div>
        )}

        {/* Photo Generation Settings Section */}
        {!chat.isGroup && (
          <div className="mt-2 app-panel shadow-sm border-b app-border">
            <div
              className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-black/5 transition-colors"
              onClick={() => setShowImageSettings(!showImageSettings)}
            >
              <div className="flex items-center gap-3">
                <Camera size={20} className="text-[#21c063]" />
                <div>
                  <h4 className="text-[calc(var(--msg-font-size)+0.5px)] text-primary font-medium">In-Chat Photo Generation (@img)</h4>
                  <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">
                    {formData.imageModel
                      ? (AVAILABLE_IMAGE_MODELS.find(m => m.id === formData.imageModel)?.label || formData.imageModel)
                      : `App Default (${AVAILABLE_IMAGE_MODELS.find(m => m.id === (settings?.selectedImageModel || DEFAULT_IMAGE_MODEL))?.label || 'Fast'})`}
                  </p>
                </div>
              </div>
              {showImageSettings ? <ChevronDown size={20} className="text-secondary" /> : <ChevronRight size={20} className="text-secondary" />}
            </div>

            {showImageSettings && (
              <div className="px-6 py-5 space-y-4 border-t app-border bg-gray-50/50 dark:bg-black/10">
                <div className="space-y-2">
                  <div>
                    <label className="text-[calc(var(--msg-font-size)-0.5px)] font-medium text-primary">Image Generation Model</label>
                    <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">
                      Choose which model this persona uses when triggered with @img
                    </p>
                  </div>

                  <select
                    value={formData.imageModel || ''}
                    onChange={(e) => {
                      const newModel = e.target.value;
                      setFormData(p => ({ ...p, imageModel: newModel }));
                      onUpdate({ imageModel: newModel });
                    }}
                    className="w-full bg-white dark:bg-[#202c33] border app-border rounded-lg px-3 py-2.5 text-[calc(var(--msg-font-size)-1px)] outline-none text-primary cursor-pointer shadow-sm"
                  >
                    <option value="">Use App Default Setting</option>
                    {AVAILABLE_IMAGE_MODELS.map(model => (
                      <option key={model.id} value={model.id}>{model.label}</option>
                    ))}
                  </select>
                </div>

                <div className="p-3 bg-black/5 dark:bg-white/5 rounded-lg text-[calc(var(--msg-font-size)-2.5px)] text-secondary leading-relaxed">
                  <p className="font-medium text-primary mb-1">📸 How @img works:</p>
                  <p>Send a message containing <code className="bg-[#21c063]/10 text-[#21c063] px-1 py-0.5 rounded font-mono">@img</code> in this chat. The persona will automatically evaluate the conversation context, generate an unposed authentic photo (or selfie using their avatar as reference), and send it with an in-character caption!</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Advanced / Automation Section */}
        {!chat.isGroup && (
          <div className="mt-2 app-panel shadow-sm border-b app-border">
            <div 
              className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-black/5 transition-colors"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <div className="flex items-center gap-3">
                <Settings size={20} className="text-secondary" />
                <h4 className="text-[calc(var(--msg-font-size)+0.5px)] text-primary font-medium">Advanced Features: Automation</h4>
              </div>
              {showAdvanced ? <ChevronDown size={20} className="text-secondary" /> : <ChevronRight size={20} className="text-secondary" />}
            </div>
            
            {showAdvanced && (
              <div className="px-6 py-6 space-y-6 border-t app-border bg-gray-50/50 dark:bg-black/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[length:var(--msg-font-size)] font-medium text-primary">Enable Automation</p>
                    <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">Allow AI to initiate conversations</p>
                  </div>
                  <div
                    onClick={() => setFormData(p => ({ ...p, automation: { ...p.automation, enabled: !p.automation.enabled } }))}
                    className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${formData.automation.enabled ? 'bg-[#21c063]' : 'bg-gray-400'}`}
                  >
                    <div className={`absolute top-[2px] w-4 h-4 bg-white rounded-full shadow-sm transition-all ${formData.automation.enabled ? 'left-[22px]' : 'left-[2px]'}`} />
                  </div>
                </div>

                <div className={`space-y-6 transition-opacity ${formData.automation.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  {/* Inactivity Pulse */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-secondary" />
                        <h5 className="text-[calc(var(--msg-font-size)-0.5px)] font-medium text-primary">Inactivity Check-ins</h5>
                      </div>
                      <div
                        onClick={() => setFormData(p => ({ ...p, automation: { ...p.automation, inactivity: { ...p.automation.inactivity, enabled: !p.automation.inactivity.enabled } } }))}
                        className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${formData.automation.inactivity.enabled ? 'bg-[#21c063]' : 'bg-gray-400'}`}
                      >
                        <div className={`absolute top-[2px] w-3 h-3 bg-white rounded-full shadow-sm transition-all ${formData.automation.inactivity.enabled ? 'left-[18px]' : 'left-[2px]'}`} />
                      </div>
                    </div>
                    {formData.automation.inactivity.enabled && (
                      <div className="flex items-center gap-2 text-[calc(var(--msg-font-size)-1.5px)] text-secondary bg-white dark:bg-[#202c33] p-3 rounded border app-border">
                        <span>Trigger after:</span>
                        <input 
                          type="number" 
                          min="0"
                          value={formData.automation.inactivity.hours} 
                          onChange={e => setFormData(p => ({ ...p, automation: { ...p.automation, inactivity: { ...p.automation.inactivity, hours: parseInt(e.target.value) || 0 } } }))}
                          className="w-10 bg-transparent text-center border-b app-border text-primary outline-none"
                        />
                        <span>hr</span>
                        <input 
                          type="number" 
                          min="0"
                          max="59"
                          value={formData.automation.inactivity.minutes} 
                          onChange={e => setFormData(p => ({ ...p, automation: { ...p.automation, inactivity: { ...p.automation.inactivity, minutes: parseInt(e.target.value) || 0 } } }))}
                          className="w-10 bg-transparent text-center border-b app-border text-primary outline-none"
                        />
                        <span>min</span>
                        <input 
                          type="number" 
                          min="0"
                          max="59"
                          value={formData.automation.inactivity.seconds} 
                          onChange={e => setFormData(p => ({ ...p, automation: { ...p.automation, inactivity: { ...p.automation.inactivity, seconds: parseInt(e.target.value) || 0 } } }))}
                          className="w-10 bg-transparent text-center border-b app-border text-primary outline-none"
                        />
                        <span>sec</span>
                      </div>
                    )}
                  </div>

                  {/* Time Triggers */}
                  <div className="space-y-3">
                    <h5 className="text-[calc(var(--msg-font-size)-0.5px)] font-medium text-primary">Time-Based Greetings</h5>
                    <div className="space-y-3">
                      {(() => {
                        const now = getAppNow(settings);
                        const todayDateStr = getAppDateKey(settings);
                        const currentTimeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
                        const hasAlreadyTalkedToday = formData.automation.timeTriggers.some(trigger => trigger.lastTriggered === todayDateStr);
                        
                        const processedTriggers = formData.automation.timeTriggers.map(t => {
                          const isTriggeredToday = t.lastTriggered === todayDateStr;
                          const isMissed = !isTriggeredToday && currentTimeStr > t.endTime;
                          return { ...t, isTriggeredToday, isMissed };
                        });

                        const missedTriggers = processedTriggers
                          .filter(t => t.isMissed)
                          .sort((a, b) => b.endTime.localeCompare(a.endTime));
                        const latestMissedId = missedTriggers[0]?.id;

                        const pastTriggers = processedTriggers
                          .filter(t => t.isTriggeredToday || t.isMissed)
                          .sort((a, b) => b.endTime.localeCompare(a.endTime));
                        
                        const upcomingTriggers = processedTriggers
                          .filter(t => !t.isTriggeredToday && !t.isMissed)
                          .sort((a, b) => a.startTime.localeCompare(b.startTime));

                        const renderTrigger = (t: any) => {
                          const isNormal = t.lastTriggerType === 'normal';
                          const isCatchup = t.lastTriggerType === 'catchup';
                          
                          let stateLabel = "Awaiting window";
                          let stateColor = "text-secondary border-app-border";
                          let badgeColor = "bg-secondary";
                          let Icon = Clock;

                          if (t.isTriggeredToday) {
                            if (isNormal) {
                              stateLabel = "Completed on time";
                              stateColor = "border-[#21c063]/50 bg-[#21c063]/5 shadow-[#21c063]/10";
                              badgeColor = "bg-[#21c063]";
                              Icon = Check;
                            } else if (isCatchup) {
                              stateLabel = "Caught up (was missed)";
                              stateColor = "border-orange-500/50 bg-orange-500/5 shadow-orange-500/10";
                              badgeColor = "bg-orange-500";
                              Icon = Clock;
                            }
                          } else if (t.isMissed) {
                            if (hasAlreadyTalkedToday || t.id !== latestMissedId) {
                              stateLabel = "Skipped (already caught up)";
                              stateColor = "border-indigo-500/30 bg-indigo-500/5";
                              badgeColor = "bg-indigo-500";
                              Icon = Clock;
                            } else {
                              stateLabel = "Missed (waiting for engine)";
                              stateColor = "border-red-500/30 bg-red-500/5";
                              badgeColor = "bg-red-500";
                              Icon = X;
                            }
                          }

                          const originalIndex = formData.automation.timeTriggers.findIndex(trig => trig.id === t.id);

                          return (
                            <div key={t.id} className={`flex flex-col gap-2 p-3 bg-white dark:bg-[#202c33] border rounded relative transition-all ${stateColor}`}>
                              {(t.isTriggeredToday || t.isMissed) && (
                                 <div className={`absolute top-0 right-0 -mt-2.5 -mr-2 ${badgeColor} text-white text-[calc(var(--msg-font-size)-4.5px)] font-bold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 border-2 border-white dark:border-[#202c33]`}>
                                   <Icon size={10} strokeWidth={3} /> {stateLabel}
                                 </div>
                              )}
                              <div className="flex items-center justify-between">
                                <input 
                                  type="text" 
                                  value={t.context}
                                  onChange={e => {
                                    const trigs = [...formData.automation.timeTriggers];
                                    trigs[originalIndex].context = e.target.value;
                                    delete trigs[originalIndex].lastTriggered;
                                    setFormData(p => ({ ...p, automation: { ...p.automation, timeTriggers: trigs } }));
                                  }}
                                  className="outline-none text-[calc(var(--msg-font-size)-1.5px)] font-medium bg-transparent text-primary w-full"
                                  placeholder="e.g. Morning Greeting"
                                />
                                <div className="flex items-center gap-3 ml-2 shrink-0">
                                  <Globe 
                                    size={14} 
                                    className="text-blue-500 cursor-pointer hover:scale-110 transition-transform" 
                                    onClick={() => onTestAutomation?.(chat.id, 'time', t.context)} 
                                    title="Test manually" 
                                  />
                                  <Trash2 size={16} className="text-red-400 cursor-pointer hover:scale-110 transition-transform" onClick={() => {
                                    const trigs = formData.automation.timeTriggers.filter((_, idx) => idx !== originalIndex);
                                    setFormData(p => ({ ...p, automation: { ...p.automation, timeTriggers: trigs } }));
                                  }} />
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-[calc(var(--msg-font-size)-2.5px)] text-secondary">
                                <span>Window:</span>
                                <input type="time" value={t.startTime} onChange={e => {
                                  const trigs = [...formData.automation.timeTriggers];
                                  trigs[originalIndex].startTime = e.target.value;
                                  delete trigs[originalIndex].lastTriggered;
                                  delete trigs[originalIndex].lastTriggerType;
                                  setFormData(p => ({ ...p, automation: { ...p.automation, timeTriggers: trigs } }));
                                }} className="bg-transparent border-b app-border" />
                                <span>to</span>
                                <input type="time" value={t.endTime} onChange={e => {
                                  const trigs = [...formData.automation.timeTriggers];
                                  trigs[originalIndex].endTime = e.target.value;
                                  delete trigs[originalIndex].lastTriggered;
                                  delete trigs[originalIndex].lastTriggerType;
                                  setFormData(p => ({ ...p, automation: { ...p.automation, timeTriggers: trigs } }));
                                }} className="bg-transparent border-b app-border" />
                              </div>
                            </div>
                          );
                        };

                        return (
                          <div className="space-y-4">
                            {pastTriggers.length > 0 && (
                              <div className="space-y-3">
                                <p className="text-[calc(var(--msg-font-size)-3.5px)] font-bold text-secondary uppercase tracking-widest pl-1">Past Interactions</p>
                                {pastTriggers.map(renderTrigger)}
                              </div>
                            )}
                            {upcomingTriggers.length > 0 && (
                              <div className="space-y-3 pt-2">
                                <p className="text-[calc(var(--msg-font-size)-3.5px)] font-bold text-secondary uppercase tracking-widest pl-1">Upcoming Greetings</p>
                                {upcomingTriggers.map(renderTrigger)}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      <button 
                        onClick={() => {
                          const newTrig = { id: Date.now().toString(), context: 'New Greeting', startTime: '08:00', endTime: '09:00' };
                          setFormData(p => ({ ...p, automation: { ...p.automation, timeTriggers: [...p.automation.timeTriggers, newTrig] } }));
                        }}
                        className="w-full flex items-center justify-center gap-2 text-[calc(var(--msg-font-size)-1.5px)] text-[#21c063] font-medium py-2 hover:bg-black/5 rounded transition-colors"
                      >
                        <Plus size={16} /> Add Trigger
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Persona Backup Section */}
        {!chat.isGroup && (
          <div className="mx-6 mb-2 p-4 rounded-xl bg-white/70 dark:bg-white/5 border app-border space-y-2.5 shadow-sm">
            <div className="flex items-center gap-2">
              <Download size={18} className="text-[#00a884]" />
              <h4 className="text-[calc(var(--msg-font-size))] font-semibold text-primary">Persona Backup & Export</h4>
            </div>
            <p className="text-[calc(var(--msg-font-size)-3px)] text-secondary leading-relaxed">
              Export {chat.name}'s profile, backstories, schedule, automations, and voice settings to a local JSON file. 100% private (chats are not included). You can import this file into any Wassap instance from App Settings.
            </p>
            <button
              type="button"
              onClick={handleExportPersonaBackup}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-[#00a884]/10 hover:bg-[#00a884]/20 text-[#00a884] border border-[#00a884]/30 text-[calc(var(--msg-font-size)-1.5px)] font-semibold transition-all active:scale-95"
              title="Save this persona's profile & settings to a local file"
            >
              <Download size={15} /> Export Persona Backup
            </button>
          </div>
        )}

        {/* Action Buttons Section */}
        <div className="p-6 space-y-4">
          {!chat.isGroup && (
            <button 
              onClick={() => {
                if (window.confirm("This will clear the typing status and reset any internal session locks. Continue?")) {
                  onRefreshPersona(chat.id);
                }
              }}
              className="w-full flex items-center justify-center gap-2 text-[calc(var(--msg-font-size)-0.5px)] text-indigo-600 dark:text-indigo-400 font-medium py-3 border border-indigo-500/20 bg-indigo-500/5 rounded-lg hover:bg-indigo-500/10 transition-colors shadow-sm"
            >
              <RefreshCw size={16} /> Refresh & Debug Persona
            </button>
          )}

          <button
            onClick={handleSave}
            className="w-full bg-[#21c063] text-white py-3 rounded-lg flex items-center justify-center gap-2 font-medium hover:bg-[#005c4b] transition-colors shadow-sm active:scale-95 uppercase text-[calc(var(--msg-font-size)-0.5px)]"
          >
            <Save size={18} />
            Save Changes
          </button>

          <button
            onClick={() => setShowClearModal(true)}
            className="w-full text-primary py-3 rounded-lg flex items-center justify-center gap-2 font-medium hover:bg-black/5 transition-colors active:scale-95 text-[calc(var(--msg-font-size)-0.5px)] border app-border"
          >
            <Eraser size={18} className="text-secondary" />
            Clear Chat History
          </button>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full text-red-500 py-3 rounded-lg flex items-center justify-center gap-2 font-medium hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors active:scale-95 text-[calc(var(--msg-font-size)-0.5px)] border border-red-500/20"
          >
            <Trash2 size={18} />
            {chat.isGroup ? 'Exit & Delete Group' : 'Delete Persona & Chat'}
          </button>
        </div>
      </div>
    </div>
  );
};
