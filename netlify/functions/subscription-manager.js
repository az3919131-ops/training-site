// تفعيل وإدارة الاشتراكات الشهرية والسنوية (الدفع يُؤكَّد عبر واتساب ثم يفعّله المدير)
import { db } from '../../src/lib/db.js';
import { json, fail, readBody, action, clean, newId, currentUser, subscriptionOf } from '../../src/lib/http.js';
import { notify } from '../../src/lib/notify.js';
import { SEED, DAY } from '../../src/lib/seed.js';

export default async req => {
  const act = action(req);
  if (req.method === 'GET' && act === 'plans') return json({ plans: SEED.plans, rates: SEED.rates });

  const me = await currentUser(req);
  if (!me) return fail(401, 'سجّل الدخول أولاً.');

  if (req.method === 'GET') {
    if (act === 'all') {
      if (me.role !== 'admin') return fail(403, 'للمدير فقط.');
      return json({ subscriptions: (await db.list('subscriptions')).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
    }
    return json({ subscription: await subscriptionOf(me) });
  }

  const b = await readBody(req);

  if (act === 'subscribe') {
    if (me.role === 'admin') return fail(400, 'حساب المدير لا يحتاج اشتراكاً.');
    const plan = SEED.plans.find(p => p.id === b.plan && p.monthlySAR > 0);
    if (!plan) return fail(400, 'اختر باقة مدفوعة.');
    const cycle = b.cycle === 'yearly' ? 'yearly' : 'monthly';
    const currency = ['SAR', 'EGP', 'USD'].includes(b.currency) ? b.currency : 'SAR';
    const prev = await subscriptionOf(me);
    if (prev && ['active', 'pending'].includes(prev.status) && prev.plan === plan.id) return json({ subscription: prev });
    const sub = {
      id: newId('sub-'), email: me.email, name: me.name, phone: me.phone || clean(b.phone, 30),
      plan: plan.id, planTitle: plan.title, cycle, currency,
      amountSAR: cycle === 'yearly' ? plan.monthlySAR * 10 : plan.monthlySAR,
      status: 'pending', periodEnd: null, createdAt: new Date().toISOString()
    };
    await db.set('subscriptions', sub.id, sub);
    me.subId = sub.id; await db.set('users', me.email, me);
    await notify('subscription', `طلب اشتراك جديد: ${me.name}`, {
      الاسم: me.name, البريد: me.email, الجوال: sub.phone, الباقة: plan.title,
      الدورة: cycle === 'yearly' ? 'سنوي' : 'شهري', المبلغ: `${sub.amountSAR} ر.س`, العملة: currency
    });
    return json({ subscription: sub });
  }

  if (act === 'cancel') {
    const sub = await subscriptionOf(me);
    if (!sub || !sub.id) return fail(404, 'لا يوجد اشتراك.');
    sub.status = 'cancelled'; await db.set('subscriptions', sub.id, sub);
    await notify('subscription', `إلغاء اشتراك: ${me.name}`, { البريد: me.email, الباقة: sub.planTitle });
    return json({ subscription: sub });
  }

  // المدير: تفعيل أو تجديد بعد تأكيد الدفع
  if (act === 'activate') {
    if (me.role !== 'admin') return fail(403, 'للمدير فقط.');
    const sub = await db.get('subscriptions', clean(b.id, 60));
    if (!sub) return fail(404, 'الاشتراك غير موجود.');
    const from = Math.max(Date.now(), sub.periodEnd ? new Date(sub.periodEnd).getTime() : 0);
    sub.periodEnd = new Date(from + (sub.cycle === 'yearly' ? 365 : 30) * DAY).toISOString();
    sub.status = 'active'; sub.activatedAt = new Date().toISOString();
    await db.set('subscriptions', sub.id, sub);
    return json({ subscription: sub });
  }
  return fail(404, 'عملية غير معروفة.');
};
