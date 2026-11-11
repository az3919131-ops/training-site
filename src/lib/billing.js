// تفعيل الاشتراك وتسجيل القيود المالية (مشترك بين التفعيل اليدوي وبوابات الدفع)
import { db } from './db.js';
import { settings, addEntry, PLATFORM, POOL } from './wallet.js';
import { DAY } from './seed.js';

// refId: معرّف ثابت (رقم عملية الدفع) يمنع تكرار القيود والتمديد لو وصل الإشعار مرتين
export async function activateSubscription(sub, refId = sub.id, paidSAR = sub.amountSAR) {
  if (sub.lastRefId === refId) return sub;
  const from = Math.max(Date.now(), sub.periodEnd ? new Date(sub.periodEnd).getTime() : 0);
  sub.periodEnd = new Date(from + (sub.cycle === 'yearly' ? 365 : 30) * DAY).toISOString();
  sub.status = 'active'; sub.activatedAt = new Date().toISOString(); sub.lastRefId = refId;
  await db.set('subscriptions', sub.id, sub);
  const { commissionTrainee } = await settings(), fee = Math.round(paidSAR * commissionTrainee) / 100;
  await addEntry(sub.email, 'payment', paidSAR, `اشتراك ${sub.planTitle}`, sub.id, `pay-${refId}-payment`);
  await addEntry(PLATFORM, 'commission', fee, `نسبة المنصة ${commissionTrainee}% من اشتراك ${sub.name}`, sub.id, `pay-${refId}-commission`);
  await addEntry(POOL, 'earning', paidSAR - fee, `حصة المدربين من اشتراك ${sub.name}`, sub.id, `pay-${refId}-pool`);
  return sub;
}
