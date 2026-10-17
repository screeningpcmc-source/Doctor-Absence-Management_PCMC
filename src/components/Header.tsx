import React from 'react';
import {
  Calendar,
  List,
  BarChart2,
  ClipboardList,
  Settings,
  Plus,
  Lock,
  Unlock,
  Stethoscope,
  RefreshCw,
  Share2,
} from 'lucide-react';
import { User } from 'firebase/auth';

interface HeaderProps {
  currentView: string;
  onSelectView: (view: string) => void;
  authPin: string;
  authName: string;
  onOpenPinLogin: () => void;
  onPinLogout: () => void;
  onOpenAddModal: () => void;
  googleUser: User | null;
  onOpenGoogleModal: () => void;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
  isSyncing: boolean;
  onSyncWorkspace: () => void;
  spreadsheetUrl?: string | null;
  hasGASConfigured?: boolean;
  onShareLink?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onSelectView,
  authPin,
  authName,
  onOpenPinLogin,
  onPinLogout,
  onOpenAddModal,
  googleUser,
  onOpenGoogleModal,
  onGoogleSignIn,
  onGoogleSignOut,
  isSyncing,
  onSyncWorkspace,
  spreadsheetUrl,
  hasGASConfigured,
  onShareLink,
}) => {
  const isAdmin = authPin === '4217';

  return (
    <header className="bg-white border-b border-slate-200 px-4 py-2.5 flex flex-col md:flex-row justify-between items-center z-20 shrink-0 gap-3 shadow-xs">
      <div className="flex items-center justify-between w-full md:w-auto">
        <div className="flex items-center gap-2.5">
          <div className="bg-teal-50 text-teal-700 p-2 rounded-xl shrink-0 ring-1 ring-teal-100">
            <Stethoscope className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base md:text-lg leading-tight text-slate-900 tracking-tight">
                ลงทะเบียนแพทย์งดออกตรวจ
              </h1>
              <span className="hidden sm:inline-block bg-teal-100 text-teal-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                v2.0 High-Speed
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Doctor Absence & Walk-in Queue System</p>
          </div>
        </div>

        {/* Mobile Add Button shortcut */}
        <button
          onClick={onOpenAddModal}
          className="md:hidden flex items-center justify-center p-2 rounded-lg bg-teal-600 text-white shadow-xs"
          title="เพิ่มการงดตรวจ"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
        <button
          onClick={() => onSelectView('calendar')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm transition-colors whitespace-nowrap font-medium ${
            currentView === 'calendar'
              ? 'bg-teal-50 text-teal-700 font-bold ring-1 ring-teal-200'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-4 h-4" /> ปฏิทินหลัก
        </button>

        <button
          onClick={() => onSelectView('list')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm transition-colors whitespace-nowrap font-medium ${
            currentView === 'list'
              ? 'bg-teal-50 text-teal-700 font-bold ring-1 ring-teal-200'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <List className="w-4 h-4" /> รายการทั้งหมด
        </button>

        <button
          onClick={() => onSelectView('dashboard')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm transition-colors whitespace-nowrap font-medium ${
            currentView === 'dashboard'
              ? 'bg-teal-50 text-teal-700 font-bold ring-1 ring-teal-200'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BarChart2 className="w-4 h-4 text-teal-600" /> แดชบอร์ดสรุปผล
        </button>

        <button
          onClick={() => onSelectView('walkin-counter')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm transition-colors whitespace-nowrap font-medium ${
            currentView === 'walkin-counter'
              ? 'bg-teal-50 text-teal-700 font-bold ring-1 ring-teal-200'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ClipboardList className="w-4 h-4 text-emerald-600" /> นับ walk-in ประจำวัน
        </button>

        {isAdmin && (
          <button
            onClick={() => onSelectView('admin-settings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm transition-colors whitespace-nowrap font-medium ${
              currentView === 'admin-settings'
                ? 'bg-amber-50 text-amber-700 font-bold ring-1 ring-amber-200'
                : 'text-amber-800 bg-amber-50/50 hover:bg-amber-100'
            }`}
          >
            <Settings className="w-4 h-4 text-amber-600" /> คุมตัวเลือก & จัดการคิว
          </button>
        )}

        <button
          onClick={onOpenAddModal}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm text-white bg-teal-600 hover:bg-teal-700 font-medium shadow-xs whitespace-nowrap cursor-pointer transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" /> เพิ่มการงด
        </button>

        {/* PIN Login / Logout button */}
        <div className="h-4 w-px bg-slate-200 mx-0.5"></div>

        {authName ? (
          <button
            onClick={onPinLogout}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold hover:bg-emerald-100 whitespace-nowrap transition-all"
            title="คลิกเพื่อออกจากระบบ PIN"
          >
            <Unlock className="w-3.5 h-3.5 text-emerald-600" />
            <span className="max-w-[100px] truncate">{authName}</span>
          </button>
        ) : (
          <button
            onClick={onOpenPinLogin}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border border-slate-200 text-slate-700 hover:bg-slate-50 whitespace-nowrap transition-all font-semibold"
          >
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>เข้าสู่ระบบ PIN</span>
          </button>
        )}

        {/* Share Link for other computers */}
        {onShareLink && (
          <button
            onClick={onShareLink}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold transition-all cursor-pointer shadow-2xs"
            title="คัดลอกลิงก์สำหรับส่งให้คอมพิวเตอร์เครื่องอื่น ปฏิทินจะเชื่อมต่อและอัปเดตตรงกันทันที"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">แชร์ให้เครื่องอื่น</span>
          </button>
        )}

        {/* Google Workspace / Apps Script Connection */}
        {hasGASConfigured ? (
          <div className="flex items-center gap-1">
            <button
              onClick={onSyncWorkspace}
              disabled={isSyncing}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-teal-50 text-teal-800 border border-teal-200 font-bold hover:bg-teal-100 whitespace-nowrap transition-all cursor-pointer shadow-2xs"
              title="ซิงค์ข้อมูลลง Google Sheets & Google Calendar ผ่าน Google Apps Script"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-teal-600 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden lg:inline">ซิงค์คลาวด์</span>
            </button>
            <button
              onClick={onOpenGoogleModal}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs border border-teal-200 bg-teal-50/70 hover:bg-teal-100 text-teal-800 font-bold cursor-pointer transition-colors"
              title="ตั้งค่า Google Apps Script"
            >
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
              <span className="text-[11px] font-medium hidden sm:inline">Google Sheets</span>
            </button>
          </div>
        ) : googleUser ? (
          <div className="flex items-center gap-1">
            <button
              onClick={onSyncWorkspace}
              disabled={isSyncing}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-blue-50 text-blue-700 border border-blue-200 font-bold hover:bg-blue-100 whitespace-nowrap transition-all cursor-pointer"
              title="ซิงค์ข้อมูลกับ Google Sheets & Google Calendar"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
              <span className="hidden lg:inline">ซิงค์ Sheets/Calendar</span>
            </button>
            <button
              onClick={onOpenGoogleModal}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold cursor-pointer transition-colors"
              title={`ตั้งค่าการเชื่อมต่อ Google (${googleUser.email || googleUser.displayName})`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-[11px] font-medium hidden sm:inline max-w-[80px] truncate">
                {googleUser.displayName || 'Google'}
              </span>
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenGoogleModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border border-teal-200 bg-teal-50/60 hover:bg-teal-100 text-teal-800 font-bold shadow-2xs whitespace-nowrap transition-all cursor-pointer"
            title="จัดการคลาวด์โรงพยาบาล & ส่งออก Google Sheets"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
              />
            </svg>
            <span className="hidden sm:inline">คลาวด์ &amp; Google Sheets</span>
          </button>
        )}
      </nav>
    </header>
  );
};
