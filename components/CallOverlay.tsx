import './call.css';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownLeft, ArrowUpRight, Mic, MicOff, Phone, Volume2, VolumeX, Video, UserPlus, MessageSquare, Bell } from 'lucide-react';
import { PersonaCall, type CallSnapshot } from '../services/liveCall';
import { formatCallDuration, shouldSummarizeCall } from '../utils/calls';

export const CallOverlay: React.FC<{ call: PersonaCall; onClose: () => void }> = ({ call, onClose }) => {
  const [state, setState] = useState<CallSnapshot>(call.snapshot);
  const [minimized, setMinimized] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [notice, setNotice] = useState('');
  const panel = useRef<HTMLDivElement>(null);
  const collapse = useRef<HTMLButtonElement>(null);
  useEffect(() => call.subscribe(setState), [call]);
  useEffect(() => {
    const root = document.getElementById('root');
    const oldFocus = document.activeElement as HTMLElement;
    if (root && !minimized) root.inert = true;
    if (!minimized) collapse.current?.focus();
    return () => { if (root) root.inert = false; oldFocus?.focus?.(); };
  }, [minimized]);
  useEffect(() => {
    const open = () => setMinimized(false);
    const back = (event: Event) => { if (!minimized) { event.preventDefault(); setMinimized(true); } };
    const key = (event: KeyboardEvent) => {
      if (minimized) return;
      if (event.key === 'Escape') { event.preventDefault(); setMinimized(true); }
      if (event.key === 'Tab') {
        const nodes = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]');
        if (!nodes?.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('wassap:call-open', open);
    window.addEventListener('wassap:back', back);
    window.addEventListener('keydown', key, true);
    return () => { window.removeEventListener('wassap:call-open', open); window.removeEventListener('wassap:back', back); window.removeEventListener('keydown', key, true); };
  }, [minimized]);
  const ended = state.status === 'ended';
  const status = ended ? state.error ? 'Call ended' : 'Call ended · ' + formatCallDuration(state.seconds) : state.status === 'active' ? formatCallDuration(state.seconds) : state.status === 'reconnecting' ? 'Reconnecting…' : state.status === 'ringing' ? 'Ringing…' : 'Connecting…';
  const end = () => { call.end(); setMinimized(false); };
  if (minimized) return createPortal(
    <div className="call-mini" role="region" aria-label="Ongoing persona call">
      <button type="button" className="call-mini-icon" aria-label={state.muted ? 'Unmute microphone' : 'Mute microphone'} onClick={() => call.toggleMute()}>{state.muted ? <MicOff size={21} /> : <Mic size={21} />}</button>
      <button type="button" className="call-mini-title" onClick={() => setMinimized(false)}><span><ArrowUpRight size={16} /> {call.chat.name}</span><small>{status} · Tap to return</small></button>
      <button type="button" className="call-mini-icon call-end" aria-label={ended ? 'Close call' : 'End call'} onClick={ended ? onClose : end}><Phone size={22} style={{ transform: 'rotate(135deg)' }} /></button>
    </div>, document.body);
  return createPortal(
    <div className="call-backdrop" ref={panel} role="dialog" aria-modal="true" aria-label={`Voice call with ${call.chat.name}`}>
      <div className="call-screen">
        <header className="call-header">
          <button ref={collapse} type="button" className="call-round call-collapse" aria-label="Minimize call" onClick={() => setMinimized(true)}><ArrowDownLeft size={25} /></button>
          <div className="call-heading"><h1>{call.chat.name}</h1><p>Private AI conversation</p></div>
          <button type="button" className="call-round" disabled aria-label="Group calls unavailable" title="Group calls are not available"><UserPlus size={25} /></button>
        </header>
        <div className="call-status" role="status">{status}</div>
        <main className="call-person">
          <div className={`call-avatar ${state.speaking ? 'call-speaking' : ''}`}><img src={call.chat.avatar} alt="" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} /><span aria-hidden="true">{call.chat.name[0]}</span></div>
          <div className="call-presence" aria-hidden="true"><i /><i /><i /><i /><i /></div>
          {state.error && <p className="call-feedback" role="alert">{state.error}</p>}
          {notice && <p className="call-feedback" role="status">{notice}</p>}
        </main>
        {showTranscript && <section className="call-transcript" aria-label="Call transcript" tabIndex={0}>{state.turns.length ? state.turns.map((turn, i) => <p key={i}><strong>{turn.speaker === 'me' ? 'You' : call.chat.name}</strong> {turn.text}{turn.interrupted ? ' …' : ''}</p>) : <p>Your conversation will appear here.</p>}</section>}
        <footer className="call-controls">
          {ended ? <><p className="call-ended-note">{shouldSummarizeCall({ duration: state.seconds, turns: state.turns }) ? 'Your call summary is being prepared. You can return to chat.' : state.turns.length ? 'Your transcript will appear in the call card.' : 'Your conversation stays with you.'}</p><button type="button" className="call-return" onClick={onClose}>Return to chat</button></> : <div className="call-control-grid">
            <button type="button" aria-pressed={state.sound} onClick={() => call.toggleSound()}><span className={`call-round ${!state.sound ? 'call-selected' : ''}`}>{state.sound ? <Volume2 /> : <VolumeX />}</span><span>Audio</span></button>
            <button type="button" disabled title="Voice calls only"><span className="call-round"><Video /></span><span>Video</span></button>
            <button type="button" aria-pressed={state.muted} onClick={() => call.toggleMute()}><span className={`call-round ${state.muted ? 'call-selected' : ''}`}>{state.muted ? <MicOff /> : <Mic />}</span><span>Mute</span></button>
            <button type="button" aria-pressed={showTranscript} onClick={() => setShowTranscript(value => !value)}><span className="call-round"><MessageSquare /></span><span>Transcript</span></button>
            <button type="button" onClick={() => { if (!('Notification' in window)) { setNotice('Notifications are unavailable in this browser.'); return; } void Notification.requestPermission().then(result => setNotice(result === 'granted' ? 'Call notifications enabled. They include an End call action on supported devices.' : 'Enable notifications in your browser settings.')); }}><span className="call-round"><Bell /></span><span>Notify</span></button>
            <button type="button" onClick={end} aria-label="End call"><span className="call-round call-end"><Phone style={{ transform: 'rotate(135deg)' }} /></span><span>End</span></button>
          </div>}
          {call.voiceNotice && <p className="call-voice-note">{call.voiceNotice}</p>}
          <p className="call-disclosure">Audio is processed by your selected AI provider.</p>
        </footer>
      </div>
    </div>, document.body);
}
