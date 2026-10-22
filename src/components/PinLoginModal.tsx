import React, { useState, useEffect } from 'react';
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
  const [rememberLogin, setRememberLogin] = useState(true);

  // Reset state whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setErrorMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPin = pin.trim();
    const userName = PIN_USERS[cleanPin];
    if (!userName) {
      setErrorMsg('รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
      return;
    }
    setErrorMsg('');
    setPin('');
    if (rememberLogin) {
      try {
        localStorage.setItem('app_auth_pin', cleanPin);
        localStorage.setItem('app_auth_name', userName);
      } catch {}
    }
    onSuccess(cleanPin, userName);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 to-teal-800 px-5 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-white/10 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight">เข้าสู่ระบบด้วยรหัส PIN ประจำแผนก</h3>
              <p className="text-[11px] text-teal-100/80">ระบบลงทะเบียนแพทย์และโควตาคิว Walk-in</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer transition-colors"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                กรอกรหัส PIN (4 หลัก)
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  maxLength={4}
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setPin(val);
                    setErrorMsg('');
                  }}
                  placeholder="••••"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border-2 border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl text-center text-2xl font-mono font-bold tracking-widest text-slate-800 outline-none transition-all shadow-inner"
                  autoFocus
                  autoComplete="off"
                />
              </div>

              {errorMsg && (
                <p className="text-xs text-rose-600 font-bold mt-2 text-center bg-rose-50 border border-rose-200 p-2 rounded-lg">
                  {errorMsg}
                </p>
              )}
            </div>

            {/* Remember Login option */}
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600 font-medium">
              <input
                type="checkbox"
                checked={rememberLogin}
                onChange={(e) => setRememberLogin(e.target.checked)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span>จดจำการเข้าสู่ระบบบนเครื่องนี้ (ไม่ต้องกรอกรหัสซ้ำเมื่อรีเฟรชหน้าเว็บ)</span>
            </label>

            <button
              type="submit"
              disabled={pin.trim().length !== 4}
              className={`w-full py-2.5 rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all ${
                pin.trim().length === 4
                  ? 'bg-teal-600 hover:bg-teal-700 text-white active:scale-98'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              ยืนยันการเข้าสู่ระบบ
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div className="bg-slate-50 px-5 py-2.5 border-t border-slate-100 text-center shrink-0">
          <p className="text-[11px] text-slate-400">
            รหัสผ่านเป็นความลับเฉพาะเจ้าหน้าที่ประจำแผนก
          </p>
        </div>
      </div>
    </div>
  );
};
