import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import firebaseConfig from '../../firebase-applet-config.json';
import { AbsenceRecord, QueueRecord, WalkInCountRecord } from '../types';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

const COLLECTION_ABSENCES = 'absence_records';
const COLLECTION_QUEUES = 'walk_in_quotas';
const COLLECTION_WALKINS = 'daily_walk_in_counts';

// BroadcastChannel for instant zero-latency cross-tab synchronization on the same device
const BROADCAST_CHANNEL_NAME = 'pcmc_doctor_absence_channel';
let hospitalChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    hospitalChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  }
} catch (e) {
  console.warn('BroadcastChannel not supported, falling back to storage/Firestore');
}

export const broadcastHospitalEvent = (type: string, data?: any) => {
  try {
    if (hospitalChannel) {
      hospitalChannel.postMessage({ type, data, timestamp: Date.now() });
    }
  } catch (e) {
    // Ignore error
  }
};

export const subscribeToBroadcast = (onEvent: (type: string, data?: any) => void): (() => void) => {
  if (!hospitalChannel) return () => {};
  const handler = (e: MessageEvent) => {
    if (e.data && e.data.type) {
      onEvent(e.data.type, e.data.data);
    }
  };
  hospitalChannel.addEventListener('message', handler);
  return () => {
    hospitalChannel?.removeEventListener('message', handler);
  };
};

/**
 * Check if Firestore is reachable and test read/write
 */
export const checkFirestoreStatus = async (): Promise<{
  success: boolean;
  count: number;
  error?: string;
}> => {
  try {
    const snap = await getDocs(collection(db, COLLECTION_ABSENCES));
    return { success: true, count: snap.docs.length };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message || 'Firestore unreachable' };
  }
};

/**
 * Subscribe to real-time changes of Absence Records across all hospital devices.
 * Fires immediately with existing records, then whenever any machine saves/updates/deletes.
 */
export const subscribeToAbsences = (
  onUpdate: (records: AbsenceRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe => {
  let isInitial = true;
  try {
    const colRef = collection(db, COLLECTION_ABSENCES);
    return onSnapshot(
      colRef,
      (snapshot) => {
        const records: AbsenceRecord[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          records.push({
            ID: data.id || docSnap.id,
            DepartmentId: data.departmentId || '',
            DoctorName: data.doctorName || '',
            AllDay: Boolean(data.allDay),
            DateStart: data.dateStart || '',
            TimeStart: data.timeStart || '',
            DateEnd: data.dateEnd || data.dateStart || '',
            TimeEnd: data.timeEnd || '',
            Reason: data.reason || '',
            Note: data.note || '',
            CreatedAt: data.createdAt || '',
            CalendarEventId: data.calendarEventId || '',
            TimeType: data.timeType || 'all_day',
            UpdatedBy: data.updatedBy || '',
            WalkInQuota:
              data.walkInQuota !== undefined && data.walkInQuota !== '' && data.walkInQuota !== 0
                ? Number(data.walkInQuota)
                : '',
            AffectedPatients: Number(data.affectedPatients) || 0,
            ReplacementDoc: data.replacementDoc || '',
            PatientManagement: data.patientManagement || '',
            NotificationStatus: data.notificationStatus || 'ปกติ',
            Specialty: data.specialty || '',
          });
        });

        // If not initial, or if there are records in Firestore, pass them through
        if (records.length > 0 || !isInitial) {
          onUpdate(records);
        }
        isInitial = false;
      },
      (error) => {
        console.warn('Firestore absences listener note:', error.message);
        if (onError) onError(error);
      }
    );
  } catch (err: any) {
    console.warn('Failed to attach Firestore absences listener:', err.message);
    return () => {};
  }
};

/**
 * Subscribe to Walk-in quotas in real-time
 */
export const subscribeToQueues = (
  onUpdate: (queues: QueueRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe => {
  let isInitial = true;
  try {
    const colRef = collection(db, COLLECTION_QUEUES);
    return onSnapshot(
      colRef,
      (snapshot) => {
        const queues: QueueRecord[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          queues.push({
            KeyDateDeptDoc: data.keyDateDeptDoc || docSnap.id,
            Date: data.date || '',
            DepartmentId: data.departmentId || '',
            DoctorName: data.doctorName || '',
            MaxQuota: Number(data.maxQuota) || 0,
            CurrentQuota: Number(data.currentQuota) || 0,
            LastUpdatedBy: data.lastUpdatedBy || '',
          });
        });

        if (queues.length > 0 || !isInitial) {
          onUpdate(queues);
        }
        isInitial = false;
      },
      (error) => {
        console.warn('Firestore queues listener note:', error.message);
        if (onError) onError(error);
      }
    );
  } catch (err: any) {
    return () => {};
  }
};

/**
 * Subscribe to Daily Walk-in counts in real-time
 */
export const subscribeToWalkIns = (
  onUpdate: (walkIns: WalkInCountRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe => {
  let isInitial = true;
  try {
    const colRef = collection(db, COLLECTION_WALKINS);
    return onSnapshot(
      colRef,
      (snapshot) => {
        const counts: WalkInCountRecord[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          counts.push({
            KeyDateDept: data.keyDateDept || docSnap.id,
            Date: data.date || '',
            DepartmentId: data.departmentId || '',
            DepartmentName: data.departmentName || '',
            Count: Number(data.count) || 0,
            NurseName: data.nurseName || '',
            LastUpdated: data.lastUpdated || '',
            UpdatedBy: data.updatedBy || '',
          });
        });

        if (counts.length > 0 || !isInitial) {
          onUpdate(counts);
        }
        isInitial = false;
      },
      (error) => {
        console.warn('Firestore walkin counts listener note:', error.message);
        if (onError) onError(error);
      }
    );
  } catch (err: any) {
    return () => {};
  }
};

/**
 * Save single Absence Record to Firestore cloud
 */
export const saveAbsenceToFirestore = async (record: AbsenceRecord): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_ABSENCES, String(record.ID));
    await setDoc(docRef, {
      id: String(record.ID),
      departmentId: String(record.DepartmentId || ''),
      doctorName: String(record.DoctorName || '-'),
      allDay: Boolean(record.AllDay),
      dateStart: String(record.DateStart || ''),
      timeStart: String(record.TimeStart || ''),
      dateEnd: String(record.DateEnd || record.DateStart || ''),
      timeEnd: String(record.TimeEnd || ''),
      reason: String(record.Reason || ''),
      note: String(record.Note || ''),
      createdAt: String(record.CreatedAt || new Date().toISOString()),
      calendarEventId: String(record.CalendarEventId || ''),
      timeType: String(record.TimeType || 'all_day'),
      updatedBy: String(record.UpdatedBy || ''),
      walkInQuota: record.WalkInQuota ? Number(record.WalkInQuota) : 0,
      affectedPatients: Number(record.AffectedPatients) || 0,
      replacementDoc: String(record.ReplacementDoc || ''),
      patientManagement: String(record.PatientManagement || ''),
      notificationStatus: String(record.NotificationStatus || 'ปกติ'),
      specialty: String(record.Specialty || ''),
      _lastModified: new Date().toISOString(),
    });
    broadcastHospitalEvent('ABSENCE_SAVED', record);
  } catch (err: any) {
    console.warn('Could not save absence to Firestore:', err.message);
  }
};

/**
 * Delete Absence Record from Firestore cloud
 */
export const deleteAbsenceFromFirestore = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_ABSENCES, String(id));
    await deleteDoc(docRef);
    broadcastHospitalEvent('ABSENCE_DELETED', { id });
  } catch (err: any) {
    console.warn('Could not delete absence from Firestore:', err.message);
  }
};

/**
 * Save single Walk-in Quota to Firestore cloud
 */
export const saveQueueToFirestore = async (queue: QueueRecord): Promise<void> => {
  try {
    const key = queue.KeyDateDeptDoc || `${queue.Date}_${queue.DepartmentId}_${queue.DoctorName}`;
    const docRef = doc(db, COLLECTION_QUEUES, key);
    await setDoc(docRef, {
      keyDateDeptDoc: key,
      date: String(queue.Date || ''),
      departmentId: String(queue.DepartmentId || ''),
      doctorName: String(queue.DoctorName || ''),
      maxQuota: Number(queue.MaxQuota) || 0,
      currentQuota: Number(queue.CurrentQuota) || 0,
      lastUpdatedBy: String(queue.LastUpdatedBy || ''),
      _lastModified: new Date().toISOString(),
    });
    broadcastHospitalEvent('QUEUE_SAVED', queue);
  } catch (err: any) {
    console.warn('Could not save queue to Firestore:', err.message);
  }
};

/**
 * Delete single Walk-in Quota from Firestore cloud
 */
export const deleteQueueFromFirestore = async (keyDateDeptDoc: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_QUEUES, keyDateDeptDoc);
    await deleteDoc(docRef);
    broadcastHospitalEvent('QUEUE_DELETED', { keyDateDeptDoc });
  } catch (err: any) {
    console.warn('Could not delete queue from Firestore:', err.message);
  }
};

/**
 * Save single Daily Walk-in count to Firestore cloud
 */
export const saveWalkInToFirestore = async (walkIn: WalkInCountRecord): Promise<void> => {
  try {
    const key = walkIn.KeyDateDept || `${walkIn.Date}_${walkIn.DepartmentId}`;
    const docRef = doc(db, COLLECTION_WALKINS, key);
    await setDoc(docRef, {
      keyDateDept: key,
      date: String(walkIn.Date || ''),
      departmentId: String(walkIn.DepartmentId || ''),
      departmentName: String(walkIn.DepartmentName || ''),
      count: Number(walkIn.Count) || 0,
      nurseName: String(walkIn.NurseName || ''),
      lastUpdated: String(walkIn.LastUpdated || new Date().toISOString()),
      updatedBy: String(walkIn.UpdatedBy || ''),
      _lastModified: new Date().toISOString(),
    });
    broadcastHospitalEvent('WALKIN_SAVED', walkIn);
  } catch (err: any) {
    console.warn('Could not save walk-in count to Firestore:', err.message);
  }
};

/**
 * Batch push initial/existing data to Firestore
 */
export const pushBatchToFirestore = async (
  events: AbsenceRecord[],
  queues: QueueRecord[],
  walkInCounts: WalkInCountRecord[]
): Promise<{ success: boolean; count: number }> => {
  try {
    const batch = writeBatch(db);
    let count = 0;

    for (const rec of events) {
      if (!rec.ID) continue;
      const ref = doc(db, COLLECTION_ABSENCES, String(rec.ID));
      batch.set(ref, {
        id: String(rec.ID),
        departmentId: String(rec.DepartmentId || ''),
        doctorName: String(rec.DoctorName || '-'),
        allDay: Boolean(rec.AllDay),
        dateStart: String(rec.DateStart || ''),
        timeStart: String(rec.TimeStart || ''),
        dateEnd: String(rec.DateEnd || rec.DateStart || ''),
        timeEnd: String(rec.TimeEnd || ''),
        reason: String(rec.Reason || ''),
        note: String(rec.Note || ''),
        createdAt: String(rec.CreatedAt || new Date().toISOString()),
        calendarEventId: String(rec.CalendarEventId || ''),
        timeType: String(rec.TimeType || 'all_day'),
        updatedBy: String(rec.UpdatedBy || ''),
        walkInQuota: rec.WalkInQuota ? Number(rec.WalkInQuota) : 0,
        affectedPatients: Number(rec.AffectedPatients) || 0,
        replacementDoc: String(rec.ReplacementDoc || ''),
        patientManagement: String(rec.PatientManagement || ''),
        notificationStatus: String(rec.NotificationStatus || 'ปกติ'),
        specialty: String(rec.Specialty || ''),
        _lastModified: new Date().toISOString(),
      });
      count++;
    }

    for (const q of queues) {
      const key = q.KeyDateDeptDoc || `${q.Date}_${q.DepartmentId}_${q.DoctorName}`;
      const ref = doc(db, COLLECTION_QUEUES, key);
      batch.set(ref, {
        keyDateDeptDoc: key,
        date: String(q.Date || ''),
        departmentId: String(q.DepartmentId || ''),
        doctorName: String(q.DoctorName || ''),
        maxQuota: Number(q.MaxQuota) || 0,
        currentQuota: Number(q.CurrentQuota) || 0,
        lastUpdatedBy: String(q.LastUpdatedBy || ''),
        _lastModified: new Date().toISOString(),
      });
      count++;
    }

    for (const w of walkInCounts) {
      const key = w.KeyDateDept || `${w.Date}_${w.DepartmentId}`;
      const ref = doc(db, COLLECTION_WALKINS, key);
      batch.set(ref, {
        keyDateDept: key,
        date: String(w.Date || ''),
        departmentId: String(w.DepartmentId || ''),
        departmentName: String(w.DepartmentName || ''),
        count: Number(w.Count) || 0,
        nurseName: String(w.NurseName || ''),
        lastUpdated: String(w.LastUpdated || new Date().toISOString()),
        updatedBy: String(w.UpdatedBy || ''),
        _lastModified: new Date().toISOString(),
      });
      count++;
    }

    await batch.commit();
    return { success: true, count };
  } catch (err: any) {
    console.warn('Batch push to Firestore failed:', err.message);
    return { success: false, count: 0 };
  }
};
