import React from 'react';
import { MessageSquarePlus } from 'lucide-react';

interface MobileActionFABProps {
  onAddPersona: () => void;
  onMetaAIClick: () => void;
}

export const MobileActionFAB: React.FC<MobileActionFABProps> = ({ onAddPersona, onMetaAIClick }) => (
  <div className="mobile-chat-fab fixed right-4 z-40 flex flex-col items-end gap-3 md:hidden">
    <button type="button" onClick={onMetaAIClick} aria-label="Ask Meta AI" className="w-11 h-11 rounded-xl app-panel border app-border shadow-sm flex items-center justify-center touch-btn">
      <span className="meta-ai-ring" aria-hidden="true" />
    </button>
    <button type="button" onClick={onAddPersona} aria-label="New chat" className="w-14 h-14 rounded-2xl bg-[#21c063] text-white dark:text-[#0b1014] shadow-md flex items-center justify-center touch-btn">
      <MessageSquarePlus size={27} strokeWidth={1.9} />
    </button>
  </div>
);
