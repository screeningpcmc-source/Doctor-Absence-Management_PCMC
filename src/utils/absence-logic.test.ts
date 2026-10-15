import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deductQueueQuota,
  restoreQueueQuota,
  adjustAdminQueue,
  normalizeTimeType,
  getReasonCategory,
  isCriticalEvent,
  calculateNurseProductivity,
  getOperationalToday,
} from './absence-logic.ts';

test('deductQueueQuota decrements quota when available', () => {
  const res = deductQueueQuota(5, 10);
  assert.equal(res.success, true);
  assert.equal(res.newQuota, 4);
});

test('deductQueueQuota prevents deducting below 0', () => {
  const res = deductQueueQuota(0, 10);
  assert.equal(res.success, false);
  assert.equal(res.newQuota, 0);
  assert.match(res.error || '', /คิวเต็มแล้ว/);
});

test('restoreQueueQuota increments quota when below max', () => {
  const res = restoreQueueQuota(3, 5);
  assert.equal(res.success, true);
  assert.equal(res.newQuota, 4);
});

test('restoreQueueQuota prevents incrementing beyond max', () => {
  const res = restoreQueueQuota(5, 5);
  assert.equal(res.success, false);
  assert.equal(res.newQuota, 5);
  assert.match(res.error || '', /คิวเต็มตามจำนวนสูงสุดแล้ว/);
});

test('adjustAdminQueue resets quota to max', () => {
  const res = adjustAdminQueue(2, 8, 'reset');
  assert.equal(res.success, true);
  assert.equal(res.newQuota, 8);
});

test('adjustAdminQueue increments quota safely', () => {
  const res = adjustAdminQueue(2, 8, 'increment');
  assert.equal(res.success, true);
  assert.equal(res.newQuota, 3);
});

test('normalizeTimeType returns correct shifts', () => {
  assert.equal(normalizeTimeType({ TimeType: 'out' }), 'out');
  assert.equal(normalizeTimeType({ AllDay: true }), 'in');
  assert.equal(normalizeTimeType({ TimeStart: '16:00:00', TimeEnd: '20:00:00' }), 'out');
  assert.equal(normalizeTimeType({ TimeStart: '08:00:00', TimeEnd: '12:00:00' }), 'out_weekend');
  assert.equal(normalizeTimeType({ TimeStart: '08:00:00', TimeEnd: '20:00:00' }), 'both');
});

test('getReasonCategory maps correctly', () => {
  assert.equal(getReasonCategory('ลาป่วย'), 'emergency');
  assert.equal(getReasonCategory('ไปประชุม/อบรม'), 'academic');
  assert.equal(getReasonCategory('ลาพักผ่อนส่วนตัว'), 'planned');
});

test('isCriticalEvent identifies service-limiting events', () => {
  assert.equal(isCriticalEvent({ Reason: 'คลินิกปิดให้บริการ' }), true);
  assert.equal(isCriticalEvent({ Reason: 'จำกัดเคส walk-in' }), true);
  assert.equal(isCriticalEvent({ Reason: 'ลาป่วย' }), false);
});

test('calculateNurseProductivity aggregates total patients, averages, and shares', () => {
  const records = [
    { KeyDateDept: 'k1', Date: '2026-10-01', DepartmentId: 'd1', DepartmentName: 'อายุรกรรม', Count: 10, NurseName: 'Nurse A', LastUpdated: '', UpdatedBy: '' },
    { KeyDateDept: 'k2', Date: '2026-10-02', DepartmentId: 'd2', DepartmentName: 'ศัลยกรรม', Count: 20, NurseName: 'Nurse A', LastUpdated: '', UpdatedBy: '' },
    { KeyDateDept: 'k3', Date: '2026-10-01', DepartmentId: 'd1', DepartmentName: 'อายุรกรรม', Count: 10, NurseName: 'Nurse B', LastUpdated: '', UpdatedBy: '' },
  ];
  const summary = calculateNurseProductivity(records);
  assert.equal(summary.totalPatients, 40);
  assert.equal(summary.topNurse, 'Nurse A');
  assert.equal(summary.topNurseCount, 30);
  assert.equal(summary.topNurseShare, 75);
  assert.equal(summary.rows.length, 2);
  assert.equal(summary.rows[0].average, 15); // 30 across 2 days
  assert.equal(summary.rows[1].average, 10); // 10 across 1 day
});

test('getOperationalToday returns valid YYYY-MM-DD', () => {
  const todayStr = getOperationalToday();
  assert.match(todayStr, /^\d{4}-\d{2}-\d{2}$/);
});
