import React, { useState } from 'react';
import { AlertTriangle, Copy, Check, Lock, X } from 'lucide-react';
import { Button } from '../ui/Button';

interface OneTimeSecretModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  publicKey: string;
  secret: string;
}

export const OneTimeSecretModal: React.FC<OneTimeSecretModalProps> = ({
  isOpen,
  onClose,
  title,
  publicKey,
  secret,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-7 sm:p-8 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-lg hover:bg-slate-100"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3.5 mb-5">
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-600 rounded-2xl flex-shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-[21px] font-bold text-slate-900 leading-tight">{title}</h3>
            <p className="text-[14px] font-semibold text-amber-700 mt-0.5">One-Time Secret Reveal</p>
          </div>
        </div>

        <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-4 mb-6 text-[14px] text-amber-900 leading-relaxed">
          <strong className="font-bold text-amber-950">Important Security Warning:</strong> This private secret will{' '}
          <span className="underline font-bold text-amber-950">NEVER</span> be displayed again and cannot be
          retrieved later. Copy and store it immediately in your secure server environment variables.
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-[14px] font-semibold text-slate-700 mb-1.5">
              Public Client Identifier (Safe in Frontend)
            </label>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono text-[14px] text-indigo-700 break-all select-all font-medium">
              {publicKey}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[14px] font-semibold text-slate-700">
                Private Server Secret (Confidential)
              </label>
              <span className="text-[13px] text-rose-600 font-medium flex items-center">
                <Lock className="w-3.5 h-3.5 mr-1" />
                Never expose in client code
              </span>
            </div>
            <div className="relative">
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 font-mono text-[14px] text-emerald-900 font-semibold break-all select-all pr-24">
                {secret}
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="absolute right-2 top-2 bottom-2 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[14px] font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-5 flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            I have securely saved this secret
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OneTimeSecretModal;
