// المحفظة والعمولات: سجل قيود محاسبي (لا يحرّك أموالاً فعلية؛ الدفع يتم خارج المنصة)
import { db } from './db.js';
import { newId } from './http.js';

export const PLATFORM = 'platform';     // إيراد المنصة (المدير)
export const POOL = 'trainers_pool';    // حصة المدربين من الاشتراكات قبل توزيعها

export async function settings() {
  return Object.assign({ commissionTrainer: 20, commissionTrainee: 30 }, (await db.get('config', 'commission')) || {});
}
export async function addEntry(account, type, amountSAR, note, ref = '', id = '') {
  const e = { id: id || `${Date.now()}-${newId()}`, account, type, amountSAR: Math.round(amountSAR * 100) / 100, note, ref, at: new Date().toISOString() };
  await db.set('wallet_ledger', e.id, e);
  return e;
}
// «payment» قيد إعلامي (ما دفعه المتدرب) ولا يدخل في الرصيد
export const balanceOf = (entries, account) => Math.round(entries.filter(e => e.account === account && e.type !== 'payment').reduce((s, e) => s + e.amountSAR, 0) * 100) / 100;
