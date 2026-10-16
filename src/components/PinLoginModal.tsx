import React, { useState } from 'react';
import { X, Lock, ShieldCheck } from 'lucide-react';
import { PIN_USERS } from '../services/dataStorage';

interface PinLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (pin: string, userName: string) => void;
}

export const PinLoginModal: React.FC<PinLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pin.trim();
    const userName = PIN_USERS[cleanPin];
    if (!userName) {
      setErrorMsg('รหัส PIN ไม่ถูกต้อง! ไม่มีสิทธิ์ทำรายการ');
      return;
    }
    setErrorMsg('');
    setPin('');
    onSuccess(cleanPin, userName);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-200">
        <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-600" />
            <h3 className="font-bold text-sm text-slate-800">เข้าสู่ระบบด้วยรหัส PIN</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              กรอกรหัสประจำแผนก (4 หลัก)
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="password"
                maxLength={4}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="กรอกรหัส PIN 4 หลัก"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl text-center text-lg font-mono font-bold tracking-widest outline-none transition-all"
                autoFocus
                autoComplete="off"
              />
            </div>
            {errorMsg && (
              <p className="text-xs text-rose-600 font-semibold mt-1.5 text-center">
                {errorMsg}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={pin.trim().length !== 4}
            className={`w-full py-2.5 rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all ${
              pin.trim().length === 4
                ? 'bg-teal-600 hover:bg-teal-700 text-white'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            ยืนยันรหัส PIN
          </button>
        </form>
      </div>
    </div>
  );
};
