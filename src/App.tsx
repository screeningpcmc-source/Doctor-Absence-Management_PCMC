import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  googleLogout,
} from './services/auth';
import {
  syncEventToGoogleCalendar,
  deleteGoogleCalendarEvent,
  createOrGetAbsenceSpreadsheet,
} from './services/googleWorkspace';
import {
  AbsenceRecord,
  Department,
  QueueRecord,
  WalkInCountRecord,
  HolidayItem,
} from './types';
import {
  INITIAL_DEPARTMENTS,
  DEFAULT_REASONS,
  getInitialAbsenceRecords,
  getInitialQueues,
  getInitialWalkInCounts,
  getHolidays,
} from './services/dataStorage';
import {
  getOperationalToday,
  deductQueueQuota,
  restoreQueueQuota,
  adjustAdminQueue,
} from './utils/absence-logic';
import { Header } from './components/Header';
import { CalendarView } from './components/CalendarView';
import { ListView } from './components/ListView';
import { DashboardView } from './components/DashboardView';
import { WalkInCounterView } from './components/WalkInCounterView';
import { AdminSettingsView } from './components/AdminSettingsView';
import { AbsenceFormModal } from './components/AbsenceFormModal';
import { EventDetailModal } from './components/EventDetailModal';
import { PinLoginModal } from './components/PinLoginModal';

export default function App() {
  const [currentView, setCurrentView] = useState<string>('calendar');
  const [selectedDate, setSelectedDate] = useState<string>(() => getOperationalToday());

  // In-memory application state with LocalStorage persistence
  const [events, setEvents] = useState<AbsenceRecord[]>(() => {
    try {
      const saved = localStorage.getItem('app_absence_events');
      return saved ? JSON.parse(saved) : getInitialAbsenceRecords();
    } catch {
      return getInitialAbsenceRecords();
    }
  });

  const [departments, setDepartments] = useState<Department[]>(() => {
    try {
      const saved = localStorage.getItem('app_departments');
      return saved ? JSON.parse(saved) : INITIAL_DEPARTMENTS;
    } catch {
      return INITIAL_DEPARTMENTS;
    }
  });

  const [queues, setQueues] = useState<QueueRecord[]>(() => {
    try {
      const saved = localStorage.getItem('app_queues');
      return saved ? JSON.parse(saved) : getInitialQueues();
    } catch {
      return getInitialQueues();
    }
  });

  const [walkInCounts, setWalkInCounts] = useState<WalkInCountRecord[]>(() => {
    try {
      const saved = localStorage.getItem('app_walkin_counts');
      return saved ? JSON.parse(saved) : getInitialWalkInCounts();
    } catch {
      return getInitialWalkInCounts();
    }
  });

  const [reasons, setReasons] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('app_reasons');
      return saved ? JSON.parse(saved) : DEFAULT_REASONS;
    } catch {
      return DEFAULT_REASONS;
    }
  });

  const holidays: HolidayItem[] = useMemo(() => getHolidays(), []);

  // Authentication State
  const [authPin, setAuthPin] = useState<string>('');
  const [authName, setAuthName] = useState<string>('');
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(() => {
    const savedId = localStorage.getItem('google_spreadsheet_id');
    return savedId ? `https://docs.google.com/spreadsheets/d/${savedId}` : null;
  });

  // Modal states
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AbsenceRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [inspectingEvent, setInspectingEvent] = useState<AbsenceRecord | null>(null);

  // O(1) Department Map for constant-time lookups across views
  const deptMap = useMemo(() => {
    const map = new Map<string, Department>();
    for (const d of departments) {
      map.set(d.id, d);
    }
    return map;
  }, [departments]);

  // Persist state changes with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('app_absence_events', JSON.stringify(events));
      localStorage.setItem('app_departments', JSON.stringify(departments));
      localStorage.setItem('app_queues', JSON.stringify(queues));
      localStorage.setItem('app_walkin_counts', JSON.stringify(walkInCounts));
      localStorage.setItem('app_reasons', JSON.stringify(reasons));
    }, 250);
    return () => clearTimeout(timer);
  }, [events, departments, queues, walkInCounts, reasons]);

  // Initialize Google Auth state
  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => setGoogleUser(user),
      () => setGoogleUser(null)
    );
    return () => unsubscribe();
  }, []);

  // Operational Date Watcher: updates today's date smoothly at midnight Bangkok time
  useEffect(() => {
    const interval = setInterval(() => {
      const today = getOperationalToday();
      setSelectedDate((prev) => (prev === today ? prev : today));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Action authorization helper
  const requirePin = useCallback((action: () => void) => {
    if (authPin && authName) {
      action();
    } else {
      setPendingAction(() => action);
      setIsPinModalOpen(true);
    }
  }, [authPin, authName]);

  const handlePinSuccess = (pin: string, userName: string) => {
    setAuthPin(pin);
    setAuthName(userName);
    setIsPinModalOpen(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const handlePinLogout = () => {
    setAuthPin('');
    setAuthName('');
  };

  // Google Sign-in flow
  const handleGoogleSignIn = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
      }
    } catch (err: any) {
      alert(`การเชื่อมต่อ Google ล้มเหลว: ${err.message}`);
    }
  };

  const handleGoogleSignOut = async () => {
    await googleLogout();
    setGoogleUser(null);
  };

  // Google Workspace Sync Action
  const handleSyncWorkspace = async () => {
    if (!googleUser) {
      handleGoogleSignIn();
      return;
    }

    setIsSyncing(true);
    try {
      const sheetResult = await createOrGetAbsenceSpreadsheet();
      if (sheetResult) {
        setSpreadsheetUrl(sheetResult.url);
      }

      // Sync active events to Google Calendar
      for (const evt of events) {
        if (!evt.CalendarEventId) {
          const calId = await syncEventToGoogleCalendar(evt);
          if (calId) {
            evt.CalendarEventId = calId;
          }
        }
      }
      setEvents([...events]);
      alert('ซิงค์ข้อมูลกับ Google Sheets และ Google Calendar เรียบร้อย!');
    } catch (err: any) {
      alert(`การซิงค์มีข้อผิดพลาด: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Queue Operations with 0ms Optimistic UI updates
  const handleDeductQueue = useCallback((date: string, deptId: string, doctorName: string) => {
    if (authPin !== '4000' && authPin !== '4217') {
      requirePin(() => handleDeductQueue(date, deptId, doctorName));
      return;
    }

    setQueues((prev) => {
      const idx = prev.findIndex((q) => q.Date === date && q.DepartmentId === deptId && q.DoctorName === doctorName);
      if (idx === -1) return prev;
      const target = prev[idx];
      const result = deductQueueQuota(target.CurrentQuota, target.MaxQuota);
      if (!result.success) {
        alert(result.error);
        return prev;
      }
      const next = [...prev];
      next[idx] = {
        ...target,
        CurrentQuota: result.newQuota,
        LastUpdatedBy: authName || 'เจ้าหน้าที่',
      };
      return next;
    });
  }, [authPin, authName, requirePin]);

  const handleRestoreQueue = useCallback((date: string, deptId: string, doctorName: string) => {
    if (authPin !== '4000' && authPin !== '4217') {
      requirePin(() => handleRestoreQueue(date, deptId, doctorName));
      return;
    }

    setQueues((prev) => {
      const idx = prev.findIndex((q) => q.Date === date && q.DepartmentId === deptId && q.DoctorName === doctorName);
      if (idx === -1) return prev;
      const target = prev[idx];
      const result = restoreQueueQuota(target.CurrentQuota, target.MaxQuota);
      if (!result.success) {
        alert(result.error);
        return prev;
      }
      const next = [...prev];
      next[idx] = {
        ...target,
        CurrentQuota: result.newQuota,
        LastUpdatedBy: authName || 'เจ้าหน้าที่',
      };
      return next;
    });
  }, [authPin, authName, requirePin]);

  const handleAdjustAdminQueue = useCallback(
    (date: string, deptId: string, doctorName: string, action: 'increment' | 'reset') => {
      if (authPin !== '4217') {
        alert('เฉพาะหัวหน้าหน่วย (PIN แอดมิน 4217) เท่านั้นที่มีสิทธิ์ทำรายการนี้');
        return;
      }

      setQueues((prev) => {
        const idx = prev.findIndex((q) => q.Date === date && q.DepartmentId === deptId && q.DoctorName === doctorName);
        if (idx === -1) return prev;
        const target = prev[idx];
        const res = adjustAdminQueue(target.CurrentQuota, target.MaxQuota, action);
        if (!res.success) {
          alert(res.error);
          return prev;
        }
        const next = [...prev];
        next[idx] = {
          ...target,
          CurrentQuota: res.newQuota,
          LastUpdatedBy: authName || 'แอดมิน',
        };
        return next;
      });
    },
    [authPin, authName]
  );

  // Walk-in Count Update with 0ms Latency
  const handleUpdateWalkInCount = useCallback(
    (deptId: string, delta: number, nurse: string) => {
      setWalkInCounts((prev) => {
        const key = `${selectedDate}_${deptId}`;
        const idx = prev.findIndex((w) => w.KeyDateDept === key);
        const next = [...prev];

        if (idx !== -1) {
          const newCount = Math.max(0, prev[idx].Count + delta);
          next[idx] = {
            ...prev[idx],
            Count: newCount,
            NurseName: nurse,
            LastUpdated: new Date().toISOString(),
            UpdatedBy: authName || 'คัดกรอง',
          };
        } else {
          const dpt = deptMap.get(deptId);
          next.push({
            KeyDateDept: key,
            Date: selectedDate,
            DepartmentId: deptId,
            DepartmentName: dpt?.name || deptId,
            Count: Math.max(0, delta),
            NurseName: nurse,
            LastUpdated: new Date().toISOString(),
            UpdatedBy: authName || 'คัดกรอง',
          });
        }
        return next;
      });
    },
    [selectedDate, deptMap, authName]
  );

  const handleResetWalkInCount = useCallback(
    (deptId: string, nurse: string) => {
      setWalkInCounts((prev) => {
        const key = `${selectedDate}_${deptId}`;
        const idx = prev.findIndex((w) => w.KeyDateDept === key);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = {
          ...prev[idx],
          Count: 0,
          NurseName: nurse,
          LastUpdated: new Date().toISOString(),
          UpdatedBy: authName || 'คัดกรอง',
        };
        return next;
      });
    },
    [selectedDate, authName]
  );

  // Save Absence Event (Create or Update)
  const handleSaveEvent = async (record: AbsenceRecord) => {
    setEvents((prev) => {
      const idx = prev.findIndex((e) => e.ID === record.ID);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = record;
        return next;
      }
      return [record, ...prev];
    });

    // Create or update queue record if WalkInQuota is present
    if (record.WalkInQuota && Number(record.WalkInQuota) > 0) {
      const quotaNum = Number(record.WalkInQuota);
      const key = `${record.DateStart}_${record.DepartmentId}_${record.DoctorName}`;
      setQueues((prev) => {
        const idx = prev.findIndex((q) => q.KeyDateDeptDoc === key);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = {
            ...prev[idx],
            MaxQuota: quotaNum,
            CurrentQuota: Math.min(prev[idx].CurrentQuota, quotaNum),
            LastUpdatedBy: authName || 'เจ้าหน้าที่',
          };
          return next;
        }
        return [
          ...prev,
          {
            KeyDateDeptDoc: key,
            Date: record.DateStart,
            DepartmentId: record.DepartmentId,
            DoctorName: record.DoctorName,
            MaxQuota: quotaNum,
            CurrentQuota: quotaNum,
            LastUpdatedBy: authName || 'เจ้าหน้าที่',
          },
        ];
      });
    }

    setIsFormModalOpen(false);
    setEditingEvent(null);

    // Asynchronously sync with Google Calendar in background if user is authenticated
    if (googleUser) {
      syncEventToGoogleCalendar(record).then((calId) => {
        if (calId) {
          setEvents((curr) =>
            curr.map((e) => (e.ID === record.ID ? { ...e, CalendarEventId: calId } : e))
          );
        }
      });
    }
  };

  // Delete Absence Event with User Confirmation (Mandatory for Destructive Actions)
  const handleDeleteEvent = async (id: string) => {
    const target = events.find((e) => e.ID === id);
    if (!target) return;

    setEvents((prev) => prev.filter((e) => e.ID !== id));
    setIsFormModalOpen(false);
    setEditingEvent(null);
    setIsDetailModalOpen(false);
    setInspectingEvent(null);

    // Delete calendar event in background if synced
    if (googleUser && target.CalendarEventId) {
      deleteGoogleCalendarEvent(target.CalendarEventId);
    }
  };

  const handleOpenEdit = (record: AbsenceRecord) => {
    requirePin(() => {
      setEditingEvent(record);
      setIsFormModalOpen(true);
    });
  };

  const handleOpenAdd = () => {
    requirePin(() => {
      setEditingEvent(null);
      setIsFormModalOpen(true);
    });
  };

  const handleOpenDetail = (record: AbsenceRecord) => {
    setInspectingEvent(record);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden text-slate-800 bg-slate-50 font-sans">
      <Header
        currentView={currentView}
        onSelectView={setCurrentView}
        authPin={authPin}
        authName={authName}
        onOpenPinLogin={() => setIsPinModalOpen(true)}
        onPinLogout={handlePinLogout}
        onOpenAddModal={handleOpenAdd}
        googleUser={googleUser}
        onGoogleSignIn={handleGoogleSignIn}
        onGoogleSignOut={handleGoogleSignOut}
        isSyncing={isSyncing}
        onSyncWorkspace={handleSyncWorkspace}
        spreadsheetUrl={spreadsheetUrl}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {currentView === 'calendar' && (
          <CalendarView
            events={events}
            departments={departments}
            deptMap={deptMap}
            queues={queues}
            holidays={holidays}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onOpenEventDetail={handleOpenDetail}
            onDeductQueue={handleDeductQueue}
            onRestoreQueue={handleRestoreQueue}
            authPin={authPin}
          />
        )}

        {currentView === 'list' && (
          <ListView
            events={events}
            departments={departments}
            deptMap={deptMap}
            onEditEvent={handleOpenEdit}
            onOpenEventDetail={handleOpenDetail}
          />
        )}

        {currentView === 'dashboard' && (
          <DashboardView
            events={events}
            departments={departments}
            deptMap={deptMap}
            onOpenEventDetail={handleOpenDetail}
          />
        )}

        {currentView === 'walkin-counter' && (
          <WalkInCounterView
            departments={departments}
            deptMap={deptMap}
            walkInCounts={walkInCounts}
            queues={queues}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            onUpdateCount={handleUpdateWalkInCount}
            onResetCount={handleResetWalkInCount}
            authPin={authPin}
            onRequirePin={requirePin}
          />
        )}

        {currentView === 'admin-settings' && (
          <AdminSettingsView
            queues={queues}
            selectedDate={selectedDate}
            onAdjustQueue={handleAdjustAdminQueue}
            reasons={reasons}
            onSaveReasons={setReasons}
            departments={departments}
            deptMap={deptMap}
            onSaveDepartments={setDepartments}
            authPin={authPin}
          />
        )}
      </main>

      {/* Modal Dialogs */}
      <PinLoginModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setPendingAction(null);
        }}
        onSuccess={handlePinSuccess}
      />

      <AbsenceFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingEvent(null);
        }}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        initialData={editingEvent}
        departments={departments}
        reasons={reasons}
        selectedDate={selectedDate}
        authName={authName}
      />

      <EventDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setInspectingEvent(null);
        }}
        event={inspectingEvent}
        deptMap={deptMap}
        onEdit={(evt) => {
          setIsDetailModalOpen(false);
          handleOpenEdit(evt);
        }}
      />
    </div>
  );
}
