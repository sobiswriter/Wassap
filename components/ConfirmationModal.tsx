
import React from 'react';

interface ConfirmationModalProps {
    onConfirm: () => void;
    onCancel: () => void;
    title: string;
    message: string;
    confirmLabel: string;
    isDanger?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    onConfirm,
    onCancel,
    title,
    message,
    confirmLabel,
    isDanger = true
}) => {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[5000] animate-in fade-in duration-200 px-4">
            <div className="app-panel rounded-md shadow-2xl max-w-sm w-full p-6 animate-in zoom-in duration-200 border app-border">
                <h3 className="text-[19px] font-medium text-primary mb-4">{title}</h3>
                <p className="text-[14.5px] text-secondary leading-relaxed mb-8">{message}</p>
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-6 py-2 rounded border app-border text-[#00a884] font-medium text-[14px] hover:bg-black/5 transition-colors uppercase"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-6 py-2 rounded text-white font-medium text-[14px] transition-colors shadow-sm uppercase ${isDanger ? 'bg-[#ea0038] hover:bg-[#c4002f]' : 'bg-[#00a884] hover:bg-[#008069]'
                            }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
