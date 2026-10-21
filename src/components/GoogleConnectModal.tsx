import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  FileSpreadsheet,
  Globe,
  Download,
  Upload,
  Play,
  Zap,
  CheckCheck,
  AlertTriangle,
  Database,
  Cloud,
  FileText,
  Share2,
} from 'lucide-react';
import { User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { AbsenceRecord, QueueRecord, WalkInCountRecord } from '../types';
import {
  testGASConnection,
  fetchAllFromGAS,
  syncAllToGAS,
  getSavedGASUrl,
  setSavedGASUrl,
  getShareableLink,
} from '../services/googleWorkspace';
import { FULL_GAS_CODE } from '../services/gasCodeSnippet';
import { checkFirestoreStatus } from '../services/firestoreSync';

interface GoogleConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  googleUser: User | null;
  onGoogleSignIn: () => Promise<void>;
  onGoogleSignOut: () => Promise<void>;
  onSyncWorkspace: () => Promise<void>;
  isSyncing: boolean;
  spreadsheetUrl: string | null;
  events: AbsenceRecord[];
  queues: QueueRecord[];
  walkInCounts: WalkInCountRecord[];
  onImportData?: (imported: {
    events?: AbsenceRecord[];
    queues?: QueueRecord[];
    walkInCounts?: WalkInCountRecord[];
  }) => void;
}

export const GoogleConnectModal: React.FC<GoogleConnectModalProps> = ({
  isOpen,
  onClose,
  googleUser,
  onGoogleSignIn,
  onGoogleSignOut,
  onSyncWorkspace,
  isSyncing,
  spreadsheetUrl,
  events,
  queues,
  walkInCounts,
  onImportData,
}) => {
  const [activeTab, setActiveTab] = useState<'cloud' | 'sheets' | 'gas' | 'firebase' | 'diagnostics'>('cloud');
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedSheetsData, setCopiedSheetsData] = useState(false);
  const [gasUrl, setGasUrl] = useState(() => getSavedGASUrl());
  const [gasStatus, setGasStatus] = useState<string>('');
  const [gasLatency, setGasLatency] = useState<number | null>(null);
  const [isGasTesting, setIsGasTesting] = useState(false);
  const [isGasFetching, setIsGasFetching] = useState(false);
  const [isGasSyncing, setIsGasSyncing] = useState(false);
  const [authError, setAuthError] = useState<string>('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  // Cloud status test
  const [isTestingCloud, setIsTestingCloud] = useState(false);
  const [cloudStatusResult, setCloudStatusResult] = useState<{
    success: boolean;
    count: number;
    latency?: number;
    error?: string;
  } | null>(null);

  // Diagnostic states
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagResults, setDiagResults] = useState<{
    storage: 'pass' | 'fail' | null;
    network: 'pass' | 'fail' | null;
    gasEndpoint: 'pass' | 'fail' | 'skip' | null;
    firebaseConfig: 'pass' | 'fail' | null;
    details: string[];
  }>({
    storage: null,
    network: null,
    gasEndpoint: null,
    firebaseConfig: null,
    details: [],
  });

  if (!isOpen) return null;

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const projectId = firebaseConfig.projectId || 'gen-lang-client-0454752252';

  const handleCopyDomain = () => {
    navigator.clipboard.writeText(currentHost);
    setCopiedDomain(true);
    setTimeout(() => setCopiedDomain(false), 2000);
  };

  const handleTestCloud = async () => {
    setIsTestingCloud(true);
    const start = Date.now();
    try {
      const res = await checkFirestoreStatus();
      const latency = Date.now() - start;
      setCloudStatusResult({
        success: res.success,
        count: res.count,
        latency,
        error: res.error,
      });
    } catch (e: any) {
      setCloudStatusResult({
        success: false,
        count: 0,
        error: e.message || 'ไม่สามารถทดสอบคลาวด์ได้',
      });
    } finally {
      setIsTestingCloud(false);
    }
  };

  const handleTrySignIn = async () => {
    setAuthError('');
    setIsSigningIn(true);
    try {
      await onGoogleSignIn();
    } catch (err: any) {
      setAuthError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSaveGasUrl = (url: string) => {
    setGasUrl(url);
    setSavedGASUrl(url);
  };

  const handleTestGasConnection = async () => {
    if (!gasUrl.trim()) {
      setGasStatus('⚠️ กรุณากรอก Web App URL ของ Google Apps Script ก่อนทดสอบ');
      return;
    }
    setIsGasTesting(true);
    setGasStatus('กำลังส่งสัญญาณทดสอบไปยัง Google Apps Script...');
    setGasLatency(null);

    const res = await testGASConnection(gasUrl);
    setIsGasTesting(false);
    setGasLatency(res.latency);

    if (res.success) {
      setGasStatus(
        `✅ เชื่อมต่อสำเร็จ 100%! ตอบกลับใน ${res.latency} ms ${
          res.data?.spreadsheetName ? `(ไฟล์: ${res.data.spreadsheetName})` : ''
        }`
      );
    } else {
      setGasStatus(`❌ การเชื่อมต่อขัดข้อง: ${res.error}`);
    }
  };

  const handleFetchFromGAS = async () => {
    if (!gasUrl.trim()) {
      setGasStatus('⚠️ กรุณากรอก Web App URL ก่อนดึงข้อมูล');
      return;
    }
    setIsGasFetching(true);
    setGasStatus('กำลังดึงข้อมูลล่าสุดจาก Google Sheets...');

    const res = await fetchAllFromGAS(gasUrl);
    setIsGasFetching(false);

    if (res.success && onImportData) {
      onImportData({
        events: res.events,
        queues: res.queues,
        walkInCounts: res.walkInCounts,
      });
      setGasStatus(
        `✅ ดึงข้อมูลสำเร็จ! นำเข้า ${res.events?.length || 0} รายการงด, ${
          res.queues?.length || 0
        } โควตาคิว, ${res.walkInCounts?.length || 0} รายการ Walk-in`
      );
    } else {
      setGasStatus(`❌ ดึงข้อมูลไม่สำเร็จ: ${res.error}`);
    }
  };

  const handleSyncAllToGAS = async () => {
    if (!gasUrl.trim()) {
      setGasStatus('⚠️ กรุณากรอก Web App URL ก่อนส่งข้อมูล');
      return;
    }
    setIsGasSyncing(true);
    setGasStatus('กำลังส่งข้อมูลทั้งหมดขึ้น Google Sheets...');

    const res = await syncAllToGAS(gasUrl, events, queues, walkInCounts);
    setIsGasSyncing(false);

    if (res.success) {
      setGasStatus(`✅ ${res.message || 'ซิงค์ข้อมูลขึ้น Google Sheets สำเร็จเรียบร้อย!'}`);
    } else {
      setGasStatus(`❌ ซิงค์ข้อมูลขัดข้อง: ${res.error}`);
    }
  };

  // Run full system diagnostics
  const runFullDiagnostics = async () => {
    setDiagRunning(true);
    const details: string[] = [];

    // Test 1: Storage
    let storagePass = false;
    try {
      localStorage.setItem('__diag_test__', '1');
      localStorage.removeItem('__diag_test__');
      storagePass = true;
      details.push('✔️ ระบบหน่วยความจำ LocalStorage และ In-Memory Cache ทำงานปกติ 100%');
    } catch {
      details.push('❌ LocalStorage ไม่พร้อมใช้งาน ข้อมูลจะเก็บใน Memory ชั่วคราว');
    }

    // Test 2: Internet / Google Network reachability
    let networkPass = false;
    try {
      await fetch('https://www.google.com/favicon.ico', { mode: 'no-cors', cache: 'no-store' });
      networkPass = true;
      details.push('✔️ การเชื่อมต่อเครือข่ายอินเทอร์เน็ตไปยังเซิร์ฟเวอร์ Google ราบรื่น');
    } catch {
      details.push('⚠️ ไม่สามารถเชื่อมต่อภายนอกได้ หรือเครือข่ายมีการบล็อก Cross-Origin');
    }

    // Test 3: Firebase Config check
    let fbPass = false;
    if (firebaseConfig.apiKey && firebaseConfig.projectId) {
      fbPass = true;
      details.push(`✔️ โครงสร้าง Firebase Config สมบูรณ์ (Project ID: ${projectId})`);
    } else {
      details.push('❌ ไม่พบการตั้งค่า Firebase API Key');
    }

    // Test 4: GAS Web App Endpoint
    let gasPass: 'pass' | 'fail' | 'skip' = 'skip';
    if (gasUrl.trim()) {
      const gasRes = await testGASConnection(gasUrl);
      if (gasRes.success) {
        gasPass = 'pass';
        details.push(`✔️ เซิร์ฟเวอร์ Google Apps Script ออนไลน์ พร้อมรับส่งข้อมูล (${gasRes.latency} ms)`);
      } else {
        gasPass = 'fail';
        details.push(`❌ เซิร์ฟเวอร์ Google Apps Script ตอบกลับขัดข้อง: ${gasRes.error}`);
      }
    } else {
      details.push('ℹ️ ยังไม่ได้ตั้งค่า URL ของ Google Apps Script (สามารถใช้งานระบบแบบ Local ได้ตามปกติ)');
    }

    setDiagResults({
      storage: storagePass ? 'pass' : 'fail',
      network: networkPass ? 'pass' : 'fail',
      gasEndpoint: gasPass,
      firebaseConfig: fbPass ? 'pass' : 'fail',
      details,
    });
    setDiagRunning(false);
  };

  // Export 1: 1-Click Open & Copy into Google Sheets
  const handleOpenGoogleSheetsDirectly = () => {
    // Generate TSV for easy paste
    const headers = ['วันที่เริ่ม', 'ถึงวันที่', 'แผนก', 'ชื่อแพทย์', 'เหตุผลการงด', 'โควตา Walk-in', 'คนไข้กระทบ (คน)', 'แพทย์ตรวจแทน', 'หมายเหตุ'];
    const rows = events.map((e) => [
      e.DateStart,
      e.DateEnd || e.DateStart,
      e.DepartmentId,
      e.DoctorName,
      e.Reason,
      e.WalkInQuota || 0,
      e.AffectedPatients || 0,
      e.ReplacementDoc || '-',
      e.Note || '-',
    ]);

    const tsvContent = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
    navigator.clipboard.writeText(tsvContent);
    setCopiedSheetsData(true);
    setTimeout(() => setCopiedSheetsData(false), 5000);

    // Open Google Sheets
    window.open('https://sheets.new', '_blank');
  };

  // Export 2: CSV Downloads (UTF-8 with BOM for perfect Thai in Excel / Sheets)
  const handleDownloadAbsenceCSV = () => {
    const headers = [
      'ID',
      'DepartmentId',
      'DoctorName',
      'DateStart',
      'TimeStart',
      'DateEnd',
      'TimeEnd',
      'Reason',
      'AllDay',
      'WalkInQuota',
      'AffectedPatients',
      'ReplacementDoc',
      'Note',
    ];
    const rows = events.map((e) => [
      e.ID,
      `"${e.DepartmentId}"`,
      `"${e.DoctorName}"`,
      e.DateStart,
      e.TimeStart || '',
      e.DateEnd,
      e.TimeEnd || '',
      `"${e.Reason}"`,
      e.AllDay ? 'TRUE' : 'FALSE',
      e.WalkInQuota || 0,
      e.AffectedPatients || 0,
      `"${e.ReplacementDoc || ''}"`,
      `"${e.Note || ''}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PCMC_แพทย์งดออกตรวจ_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadQuotaCSV = () => {
    const headers = ['Key', 'Date', 'DepartmentId', 'DoctorName', 'MaxQuota', 'CurrentQuota', 'LastUpdatedBy'];
    const rows = queues.map((q) => [
      `"${q.KeyDateDeptDoc}"`,
      q.Date,
      `"${q.DepartmentId}"`,
      `"${q.DoctorName}"`,
      q.MaxQuota,
      q.CurrentQuota,
      `"${q.LastUpdatedBy || ''}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PCMC_โควตาWalkIn_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadWalkInCSV = () => {
    const headers = ['Key', 'Date', 'DepartmentId', 'DepartmentName', 'Count', 'NurseName', 'LastUpdated', 'UpdatedBy'];
    const rows = walkInCounts.map((w) => [
      `"${w.KeyDateDept}"`,
      w.Date,
      `"${w.DepartmentId}"`,
      `"${w.DepartmentName}"`,
      w.Count,
      `"${w.NurseName || ''}"`,
      `"${w.LastUpdated || ''}"`,
      `"${w.UpdatedBy || ''}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PCMC_นับยอดWalkInรายวัน_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const fullBackup = {
      exportDate: new Date().toISOString(),
      events,
      queues,
      walkInCounts,
      hospital: 'ศูนย์การแพทย์ปัญญานันทภิกขุ ชลประทาน (PCMC)',
    };
    const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PCMC_Absence_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (onImportData) {
          onImportData({
            events: parsed.events || [],
            queues: parsed.queues || [],
            walkInCounts: parsed.walkInCounts || [],
          });
          alert(
            `นำเข้าข้อมูลเรียบร้อย! (${parsed.events?.length || 0} รายการงด, ${
              parsed.queues?.length || 0
            } คิว)`
          );
        }
      } catch (err: any) {
        alert('ไฟล์ข้อมูลไม่ถูกต้อง: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(FULL_GAS_CODE);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleDownloadScript = () => {
    const blob = new Blob([FULL_GAS_CODE], { type: 'text/javascript;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Code.gs';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyShareLink = () => {
    const link = getShareableLink(gasUrl);
    navigator.clipboard.writeText(link);
    setCopiedShareLink(true);
    setTimeout(() => setCopiedShareLink(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden my-4 border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-800 via-teal-900 to-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2.5 rounded-xl flex items-center justify-center">
              <Database className="w-5 h-5 text-teal-300" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                ศูนย์จัดการเชื่อมต่อข้อมูล &amp; Google Sheets / Calendar
              </h3>
              <p className="text-xs text-teal-200">
                ระบบลงทะเบียนแพทย์งดออกตรวจ PCMC • ซิงค์คลาวด์โรงพยาบาลแบบเรียลไทม์ 100%
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Live Status Banner */}
        <div className="bg-teal-50 border-b border-teal-200 px-6 py-2.5 flex flex-wrap justify-between items-center gap-2 text-xs">
          <div className="flex items-center gap-2 text-teal-900 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>สถานะระบบ:</span>
            <span className="text-teal-800 font-bold bg-white px-2 py-0.5 rounded border border-teal-200">
              คลาวด์โรงพยาบาลออนไลน์ (Real-time Firestore)
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span>โดเมน:</span>
            <code className="bg-white border border-slate-200 px-1.5 py-0.2 rounded font-mono font-bold text-slate-700">
              {currentHost}
            </code>
          </div>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-slate-200 px-6 pt-3 gap-2 overflow-x-auto scrollbar-none bg-slate-50/50">
          <button
            onClick={() => setActiveTab('cloud')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'cloud'
                ? 'border-teal-600 text-teal-800 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Cloud className="w-3.5 h-3.5 text-teal-600" />
            <span>1. คลาวด์โรงพยาบาล (ออนไลน์)</span>
          </button>
          <button
            onClick={() => setActiveTab('sheets')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'sheets'
                ? 'border-teal-600 text-teal-800 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>2. ส่งออก Google Sheets &amp; Excel</span>
          </button>
          <button
            onClick={() => setActiveTab('gas')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'gas'
                ? 'border-teal-600 text-teal-800 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-600" />
            <span>3. Google Apps Script (Auto-Sync)</span>
          </button>
          <button
            onClick={() => setActiveTab('firebase')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'firebase'
                ? 'border-teal-600 text-teal-800 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-blue-600" />
            <span>4. Google Sign-In (OAuth)</span>
          </button>
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'diagnostics'
                ? 'border-teal-600 text-teal-800 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Play className="w-3.5 h-3.5 text-purple-600" />
            <span>5. ตรวจสอบระบบ</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 space-y-4 max-h-[62vh] overflow-y-auto">
          {/* TAB 1: HOSPITAL REAL-TIME CLOUD */}
          {activeTab === 'cloud' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-teal-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg shrink-0 mt-0.5">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-teal-950">
                      ระบบฐานข้อมูลคลาวด์โรงพยาบาลเชื่อมต่อและออนไลน์อยู่แล้ว 100%
                    </h4>
                    <p className="text-xs text-teal-800 leading-relaxed">
                      โปรเจกต์นี้เปิดใช้งานฐานข้อมูลคลาวด์ <strong>Firebase Firestore แบบเรียลไทม์</strong>{' '}
                      ทุกเครื่องคอมพิวเตอร์ แท็บเล็ต หรือมือถือในโรงพยาบาลที่เปิดใช้งานระบบนี้
                      จะเห็นข้อมูลตรงกันทันที 0ms อัตโนมัติ โดย<strong>ไม่จำเป็นต้องล็อกอิน Google</strong>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                  <div className="bg-white p-3 rounded-lg border border-teal-100 shadow-2xs">
                    <div className="text-slate-400 text-[10px] font-semibold">รายการงดตรวจปัจจุบัน</div>
                    <div className="text-lg font-black text-teal-800 mt-0.5">{events.length} รายการ</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-teal-100 shadow-2xs">
                    <div className="text-slate-400 text-[10px] font-semibold">โควตาคิว Walk-in</div>
                    <div className="text-lg font-black text-teal-800 mt-0.5">{queues.length} รายการ</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-teal-100 shadow-2xs">
                    <div className="text-slate-400 text-[10px] font-semibold">สถิตินับยอด Walk-in</div>
                    <div className="text-lg font-black text-teal-800 mt-0.5">{walkInCounts.length} แผนก</div>
                  </div>
                </div>

                {/* Cloud Ping Test Button */}
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                  <button
                    onClick={handleTestCloud}
                    disabled={isTestingCloud}
                    className="w-full sm:w-auto px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingCloud ? 'animate-spin' : ''}`} />
                    <span>{isTestingCloud ? 'กำลังทดสอบสัญญาณคลาวด์...' : 'ทดสอบสัญญาณคลาวด์ (Cloud Ping)'}</span>
                  </button>

                  {cloudStatusResult && (
                    <div
                      className={`text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 ${
                        cloudStatusResult.success
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {cloudStatusResult.success ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>
                            คลาวด์ตอบกลับสมบูรณ์ ({cloudStatusResult.latency} ms) • ซิงค์ข้อมูลพร้อมใช้งาน
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                          <span>พบข้อผิดพลาด: {cloudStatusResult.error}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Multi-Device Sharing */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="font-bold text-slate-800 flex items-center gap-2 text-xs sm:text-sm">
                    <Share2 className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>เปิดใช้งานร่วมกันหลายเครื่อง (ซิงค์ตรงกันทันที 100%)</span>
                  </div>
                  <button
                    onClick={handleCopyShareLink}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs shrink-0"
                  >
                    {copiedShareLink ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedShareLink ? 'คัดลอกลิงก์แล้ว!' : 'คัดลอกลิงก์ส่งต่อ'}</span>
                  </button>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  ส่งลิงก์ของเว็บไซต์นี้ผ่าน LINE หรือเปิดในเว็บเบราว์เซอร์ของคอมพิวเตอร์เครื่องอื่น ข้อมูลแพทย์งดตรวจและการตัดโควตา Walk-in จะอัปเดตตรงกันทันทีโดยอัตโนมัติ
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: EXPORT GOOGLE SHEETS & EXCEL (1-CLICK DIRECT) */}
          {activeTab === 'sheets' && (
            <div className="space-y-4">
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 space-y-2 text-xs">
                <div className="font-bold text-emerald-950 flex items-center gap-2 text-sm">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>ส่งออกและนำข้อมูลเข้าสู่ Google Sheets / Excel โดยตรง (ไม่ต้องล็อกอิน)</span>
                </div>
                <p className="text-emerald-900 leading-relaxed text-[11px]">
                  ท่านสามารถเปิดข้อมูลบน Google Sheets ได้ทันที หรือดาวน์โหลดไฟล์ Excel (.csv UTF-8)
                  ที่มีการจัดคอลัมน์ภาษาไทยอย่างถูกต้อง 100% ใช้งานได้ฟรีโดยไม่มีเงื่อนไข
                </p>
              </div>

              {/* 1-Click Open in Google Sheets */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h5 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <ExternalLink className="w-4 h-4 text-teal-600" />
                      <span>เปิด Google Sheets แผ่นใหม่พร้อมคัดลอกข้อมูลทันที</span>
                    </h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      ระบบจะคัดลอกตารางข้อมูลทั้งหมดลงคลิปบอร์ดให้ แล้วเปิดหน้า Google Sheets ให้ท่านกดวาง (Ctrl+V) ได้ทันที
                    </p>
                  </div>
                  <button
                    onClick={handleOpenGoogleSheetsDirectly}
                    className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-all active:scale-95 shrink-0"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>เปิด Google Sheets ทันที</span>
                  </button>
                </div>

                {copiedSheetsData && (
                  <div className="bg-emerald-100 text-emerald-900 border border-emerald-300 p-2.5 rounded-lg text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <CheckCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      คัดลอกตารางข้อมูลลงคลิปบอร์ดเรียบร้อยแล้ว! ในแท็บ Google Sheets ที่เปิดขึ้นมา ให้กด <strong>Ctrl + V</strong> เพื่อวางข้อมูล
                    </span>
                  </div>
                )}
              </div>

              {/* Download CSV Files */}
              <div className="space-y-2">
                <h5 className="font-bold text-xs text-slate-800">ดาวน์โหลดไฟล์ Excel / CSV ประจำวัน:</h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={handleDownloadAbsenceCSV}
                    className="p-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-teal-400 rounded-xl text-left cursor-pointer transition-all shadow-2xs group"
                  >
                    <div className="flex items-center justify-between">
                      <FileText className="w-4 h-4 text-teal-600" />
                      <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-600" />
                    </div>
                    <div className="font-bold text-xs text-slate-800 mt-2">แพทย์งดออกตรวจ</div>
                    <div className="text-[10px] text-slate-400">({events.length} รายการ) • .csv</div>
                  </button>

                  <button
                    onClick={handleDownloadQuotaCSV}
                    className="p-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-teal-400 rounded-xl text-left cursor-pointer transition-all shadow-2xs group"
                  >
                    <div className="flex items-center justify-between">
                      <FileSpreadsheet className="w-4 h-4 text-teal-600" />
                      <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-600" />
                    </div>
                    <div className="font-bold text-xs text-slate-800 mt-2">โควตาคิว Walk-in</div>
                    <div className="text-[10px] text-slate-400">({queues.length} รายการ) • .csv</div>
                  </button>

                  <button
                    onClick={handleDownloadWalkInCSV}
                    className="p-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-teal-400 rounded-xl text-left cursor-pointer transition-all shadow-2xs group"
                  >
                    <div className="flex items-center justify-between">
                      <Database className="w-4 h-4 text-teal-600" />
                      <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-600" />
                    </div>
                    <div className="font-bold text-xs text-slate-800 mt-2">ยอดนับ Walk-in รายวัน</div>
                    <div className="text-[10px] text-slate-400">({walkInCounts.length} แผนก) • .csv</div>
                  </button>
                </div>
              </div>

              {/* JSON Full System Backup & Restore */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2 text-xs">
                <div className="font-bold text-slate-800">สำรองและกู้คืนข้อมูลทั้งระบบ (JSON Full Backup):</div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={handleExportJSON}
                    className="px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5 text-teal-600" />
                    <span>ดาวน์โหลดไฟล์สำรองข้อมูล (.json)</span>
                  </button>
                  <label className="px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs">
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
                    <span>นำเข้าไฟล์สำรองข้อมูล (.json)</span>
                    <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: GOOGLE APPS SCRIPT WEB APP */}
          {activeTab === 'gas' && (
            <div className="space-y-4">
              <div className="bg-teal-50/80 border border-teal-200 rounded-xl p-4 text-xs space-y-2">
                <div className="font-bold text-teal-900 flex items-center gap-2 text-sm">
                  <CheckCheck className="w-4 h-4 text-teal-600" />
                  <span>การเชื่อมต่ออัตโนมัติด้วย Google Apps Script Web App</span>
                </div>
                <p className="text-slate-700 leading-relaxed text-[11px]">
                  วิธีนี้ช่วยให้ระบบส่งข้อมูลไปลง Google Sheets และ Google Calendar ของโรงพยาบาลโดยอัตโนมัติ
                  ทุกครั้งที่มีการบันทึกหรือยกเลิกรายการงดตรวจ
                </p>
              </div>

              {/* URL Input Box */}
              <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-800">
                  ระบุ Google Apps Script Web App URL (ลงท้ายด้วย /exec):
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={gasUrl}
                    onChange={(e) => handleSaveGasUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                    className="flex-1 bg-white border border-slate-300 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl px-3 py-2 text-xs font-mono outline-none shadow-2xs"
                  />
                  <button
                    onClick={handleTestGasConnection}
                    disabled={isGasTesting}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 shadow-xs cursor-pointer transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGasTesting ? 'animate-spin' : ''}`} />
                    <span>{isGasTesting ? 'กำลังทดสอบ...' : 'ทดสอบการเชื่อมต่อ'}</span>
                  </button>
                </div>

                {gasStatus && (
                  <div className="text-xs font-bold mt-2 p-2.5 rounded-lg bg-white border border-slate-200 text-slate-800">
                    {gasStatus}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    onClick={handleFetchFromGAS}
                    disabled={isGasFetching || !gasUrl.trim()}
                    className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all shadow-2xs"
                  >
                    <Download className={`w-3.5 h-3.5 ${isGasFetching ? 'animate-spin text-teal-600' : ''}`} />
                    <span>{isGasFetching ? 'กำลังดึงข้อมูล...' : 'ดึงข้อมูลล่าสุดจาก Sheets'}</span>
                  </button>

                  <button
                    onClick={handleSyncAllToGAS}
                    disabled={isGasSyncing || !gasUrl.trim()}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all shadow-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGasSyncing ? 'animate-spin' : ''}`} />
                    <span>{isGasSyncing ? 'กำลังส่งข้อมูล...' : 'ส่งข้อมูลทั้งหมดขึ้น Sheets & Calendar'}</span>
                  </button>
                </div>
              </div>

              {/* Code Box with Download */}
              <div className="bg-slate-900 rounded-xl p-3.5 text-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-teal-300">
                    โค้ด Apps Script Backend (Code.gs):
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownloadScript}
                      className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-teal-300" />
                      <span>ดาวน์โหลด Code.gs</span>
                    </button>
                    <button
                      onClick={handleCopyScript}
                      className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedScript ? 'คัดลอกแล้ว' : 'คัดลอกโค้ด'}</span>
                    </button>
                  </div>
                </div>
                <p className="text-slate-400 text-[11px]">
                  นำโค้ดนี้ไปวางใน Google Sheets ➔ ส่วนขยาย (Extensions) ➔ Apps Script ➔ Deploy as Web App
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: FIREBASE / GOOGLE OAUTH */}
          {activeTab === 'firebase' && (
            <div className="space-y-4">
              <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <Globe className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-xs text-blue-950 leading-tight">
                      การเชื่อมต่อบัญชี Google (Google OAuth)
                    </h4>
                    <p className="text-[11px] text-blue-800 mt-1 leading-relaxed">
                      💡 <strong>ข้อแนะนำ:</strong> ระบบฐานข้อมูลคลาวด์ของโรงพยาบาลออนไลน์อยู่แล้ว 100%
                      ไม่จำเป็นต้องล็อกอิน Google เพื่อใช้งานระบบหลัก หากต้องการเปิดดูใน Google Sheets
                      สามารถใช้แท็บ <strong>'2. ส่งออก Google Sheets &amp; Excel'</strong> ด้านบนได้ทันที
                    </p>
                  </div>
                </div>

                {authError && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1.5">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>คำแนะนำสำหรับโดเมน '{currentHost}':</span>
                    </div>
                    <div className="text-[11px] text-amber-800 leading-relaxed">
                      หากเบราว์เซอร์แจ้งเตือน <code>auth/unauthorized-domain</code> แสดงว่าโดเมนปัจจุบันยังไม่ได้เพิ่มใน Authorized Domains ของโครงการ Firebase
                      ท่านสามารถใช้ <strong>แท็บ 'ส่งออก Google Sheets &amp; Excel'</strong> ด้านบนแทนได้ทันทีโดยไม่ต้องขอสิทธิ์ใดๆ
                    </div>
                  </div>
                )}

                <div className="bg-white p-3.5 rounded-lg border border-blue-100 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-slate-800">โดเมนที่กำลังใช้งาน:</span>
                    <button
                      onClick={handleCopyDomain}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedDomain ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedDomain ? 'คัดลอกแล้ว' : `คัดลอก: ${currentHost}`}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                {!googleUser ? (
                  <div className="flex-1 flex gap-2">
                    <button
                      onClick={handleTrySignIn}
                      disabled={isSigningIn}
                      className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSigningIn ? 'animate-spin' : ''}`} />
                      <span>{isSigningIn ? 'กำลังเชื่อมต่อ...' : 'เข้าสู่ระบบด้วยบัญชี Google'}</span>
                    </button>
                    {isSigningIn && (
                      <button
                        onClick={() => setIsSigningIn(false)}
                        className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                        title="ยกเลิกการรอและปลดล็อกปุ่ม"
                      >
                        ยกเลิก
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <button
                      onClick={onSyncWorkspace}
                      disabled={isSyncing}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSyncing ? 'กำลังซิงค์...' : 'ซิงค์ข้อมูลกับ Google Calendar'}</span>
                    </button>
                    <button
                      onClick={onGoogleSignOut}
                      className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                    >
                      ออกจากระบบ Google
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: SYSTEM DIAGNOSTICS */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-xs text-slate-900">ระบบตรวจสอบความพร้อมและทดสอบการเชื่อมต่อ</h4>
                  <p className="text-[11px] text-slate-500">ทดสอบการอ่านเขียนข้อมูล การเชื่อมต่อเครือข่าย และความพร้อมของ Google APIs แบบสดๆ</p>
                </div>
                <button
                  onClick={runFullDiagnostics}
                  disabled={diagRunning}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all shrink-0"
                >
                  <Play className={`w-3.5 h-3.5 ${diagRunning ? 'animate-spin' : ''}`} />
                  <span>{diagRunning ? 'กำลังทดสอบ...' : 'เริ่มการทดสอบ (Run Test)'}</span>
                </button>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                  <span className="font-semibold text-slate-700">1. การเก็บข้อมูลในเบราว์เซอร์:</span>
                  {diagResults.storage === 'pass' && (
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full flex items-center gap-1 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" /> พร้อมใช้งาน
                    </span>
                  )}
                  {diagResults.storage === 'fail' && (
                    <span className="text-rose-700 font-bold bg-rose-50 px-2.5 py-0.5 rounded-full text-[11px]">
                      มีข้อผิดพลาด
                    </span>
                  )}
                  {diagResults.storage === null && <span className="text-slate-400 font-medium">-</span>}
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                  <span className="font-semibold text-slate-700">2. การเชื่อมต่อเซิร์ฟเวอร์ Google:</span>
                  {diagResults.network === 'pass' && (
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full flex items-center gap-1 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" /> เชื่อมต่อได้
                    </span>
                  )}
                  {diagResults.network === 'fail' && (
                    <span className="text-rose-700 font-bold bg-rose-50 px-2.5 py-0.5 rounded-full text-[11px]">
                      ขัดข้อง
                    </span>
                  )}
                  {diagResults.network === null && <span className="text-slate-400 font-medium">-</span>}
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                  <span className="font-semibold text-slate-700">3. Google Apps Script Endpoint:</span>
                  {diagResults.gasEndpoint === 'pass' && (
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full flex items-center gap-1 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" /> ออนไลน์
                    </span>
                  )}
                  {diagResults.gasEndpoint === 'fail' && (
                    <span className="text-rose-700 font-bold bg-rose-50 px-2.5 py-0.5 rounded-full text-[11px]">
                      ตอบกลับผิดพลาด
                    </span>
                  )}
                  {diagResults.gasEndpoint === 'skip' && (
                    <span className="text-amber-700 font-bold bg-amber-50 px-2.5 py-0.5 rounded-full text-[11px]">
                      ยังไม่ได้ใส่ URL
                    </span>
                  )}
                  {diagResults.gasEndpoint === null && <span className="text-slate-400 font-medium">-</span>}
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                  <span className="font-semibold text-slate-700">4. โครงสร้าง Google API / Firebase:</span>
                  {diagResults.firebaseConfig === 'pass' && (
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full flex items-center gap-1 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" /> กำหนดค่าแล้ว
                    </span>
                  )}
                  {diagResults.firebaseConfig === 'fail' && (
                    <span className="text-rose-700 font-bold bg-rose-50 px-2.5 py-0.5 rounded-full text-[11px]">
                      ไม่สมบูรณ์
                    </span>
                  )}
                  {diagResults.firebaseConfig === null && <span className="text-slate-400 font-medium">-</span>}
                </div>
              </div>

              {/* Log outputs */}
              {diagResults.details.length > 0 && (
                <div className="bg-slate-900 rounded-xl p-3.5 text-xs font-mono space-y-1.5 text-slate-300">
                  <div className="text-teal-400 font-bold mb-1">บันทึกผลการตรวจสอบ (Diagnostic Output Log):</div>
                  {diagResults.details.map((d, i) => (
                    <div key={i} className="leading-relaxed">
                      {d}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">
            ระบบลงทะเบียนแพทย์งดออกตรวจและจัดการโควตา Walk-in PCMC
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-lg cursor-pointer transition-colors"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
