import React, { useState } from 'react';
import { X, Lock, CheckCircle2, ShieldCheck } from 'lucide-react';
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

  const handleSelectQuickPin = (quickPin: string) => {
    const userName = PIN_USERS[quickPin];
    if (userName) {
      setErrorMsg('');
      setPin('');
      onSuccess(quickPin, userName);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-200">
        <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-600" />
            <h3 className="font-bold text-sm text-slate-800">เข้าสู่ระบบด้วยรหัส PIN</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
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
                placeholder="เช่น 4217 หรือ 4000"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl text-center text-lg font-mono font-bold tracking-widest outline-none"
                autoFocus
              />
            </div>
            {errorMsg && <p className="text-xs text-rose-600 font-semibold mt-1.5 text-center">{errorMsg}</p>}
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-colors"
          >
            ยืนยันรหัส PIN
          </button>

          {/* Quick preset chips */}
          <div className="pt-3 border-t border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">
              รหัสทดสอบด่วน (Quick Presets)
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => handleSelectQuickPin('4217')}
                className="p-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg text-[11px] font-bold text-center"
              >
                4217 หัวหน้าหน่วย (แอดมิน)
              </button>
              <button
                type="button"
                onClick={() => handleSelectQuickPin('4000')}
                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold text-center"
              >
                4000 หน่วยคัดกรอง
              </button>
              <button
                type="button"
                onClick={() => handleSelectQuickPin('4265')}
                className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-[11px] font-bold text-center"
              >
                4265 อายุรกรรม
              </button>
              <button
                type="button"
                onClick={() => handleSelectQuickPin('4355')}
                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-[11px] font-bold text-center"
              >
                4355 ศัลยกรรม
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
