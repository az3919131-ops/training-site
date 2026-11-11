// دالة مجدولة يومياً (@daily في netlify.toml): تفحص الاشتراكات المنتهية
// active → renewal_due عند انتهاء المدة (مهلة 3 أيام)، ثم expired إن لم يُجدَّد
import { db } from '../../src/lib/db.js';
import { notify } from '../../src/lib/notify.js';
import { DAY } from '../../src/lib/seed.js';

export async function runRenewal(now = Date.now()) {
  const due = [], expired = [];
  for (const sub of await db.list('subscriptions')) {
    const end = sub.periodEnd ? new Date(sub.periodEnd).getTime() : 0;
    if (sub.status === 'active' && end && end < now) { sub.status = 'renewal_due'; due.push(sub); }
    else if (sub.status === 'renewal_due' && end + 3 * DAY < now) { sub.status = 'expired'; expired.push(sub); }
    else continue;
    await db.set('subscriptions', sub.id, sub);
  }
  if (due.length || expired.length) {
    const line = s => `${s.name} <${s.email}> ${s.phone || ''} — ${s.planTitle}`;
    await notify('renewal', `تجديد الاشتراكات: ${due.length} مستحق، ${expired.length} منتهٍ`, {
      'مستحق التجديد': due.map(line).join(' | ') || '—',
      'انتهى': expired.map(line).join(' | ') || '—'
    });
  }
  return { due: due.length, expired: expired.length };
}

export default async () => new Response(JSON.stringify(await runRenewal()), { headers: { 'content-type': 'application/json' } });
