// حجز الجلسات الاستشارية بالساعة أو بالدقيقة
import { db } from '../../src/lib/db.js';
import { json, fail, readBody, action, clean, newId, currentUser, subscriptionOf, can } from '../../src/lib/http.js';
import { notify } from '../../src/lib/notify.js';
import { settings, addEntry, PLATFORM } from '../../src/lib/wallet.js';
import { SEED, findCourse } from '../../src/lib/seed.js';

const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

export default async req => {
  const act = action(req);
  const me = await currentUser(req);
  const url = new URL(req.url);

  if (req.method === 'GET' && act === 'slots') {
    const date = clean(url.searchParams.get('date'), 10);
    const all = await db.list('hourly_bookings');
    return json({ taken: all.filter(x => x.date === date && x.status !== 'cancelled').map(x => ({ time: x.time, minutes: x.minutes })) });
  }

  if (req.method === 'GET') {
    if (!me) return fail(401, 'سجّل الدخول أولاً.');
    const all = await db.list('hourly_bookings');
    const list = can(me, 'bookings.manage') ? all : all.filter(x => x.email === me.email || x.trainerEmail === me.email);
    return json({ bookings: list.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)) });
  }

  const b = await readBody(req);
  if (act === 'status') {
    if (!can(me, 'bookings.manage')) return fail(403, 'لا تملك صلاحية إدارة الحجوزات.');
    const bk = await db.get('hourly_bookings', clean(b.id, 60));
    if (!bk || !['confirmed', 'cancelled', 'done'].includes(b.status)) return fail(400, 'طلب غير صحيح.');
    if (b.trainerEmail !== undefined) {
      const t = b.trainerEmail && await db.get('users', clean(b.trainerEmail, 120).toLowerCase());
      bk.trainerEmail = t ? t.email : ''; bk.trainerName = t ? t.name : '';
    }
    // عند إتمام الجلسة: مستحق المدرب بعد خصم نسبة المنصة (مرة واحدة)
    if (b.status === 'done' && !bk.settled) {
      const { commissionTrainer } = await settings(), fee = bk.trainerEmail ? bk.priceSAR * commissionTrainer / 100 : bk.priceSAR;
      if (bk.trainerEmail) await addEntry(bk.trainerEmail, 'earning', bk.priceSAR - fee, `جلسة استشارية مع ${bk.name} (${bk.date})`, bk.id);
      await addEntry(PLATFORM, 'commission', fee, bk.trainerEmail ? `نسبة المنصة ${commissionTrainer}% من جلسة ${bk.trainerName}` : `جلسة استشارية بدون مدرب محدد (${bk.name})`, bk.id);
      bk.settled = true;
    }
    bk.status = b.status; await db.set('hourly_bookings', bk.id, bk);
    return json({ booking: bk });
  }

  if (b.website) return json({ ok: true }); // مصيدة الروبوتات
  const name = clean(b.name || me?.name, 80), phone = clean(b.phone || me?.phone, 30);
  const date = clean(b.date, 10), time = clean(b.time, 5), minutes = Math.round(+b.minutes);
  if (!name || phone.replace(/\D/g, '').length < 8) return fail(400, 'أدخل الاسم ورقم الجوال.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || !(minutes >= 15 && minutes <= 240)) return fail(400, 'اختر التاريخ والوقت والمدة (15 إلى 240 دقيقة).');
  if (new Date(`${date}T${time}:00`) < new Date(Date.now() - 86400000)) return fail(400, 'اختر موعداً قادماً.');

  const start = toMin(time), all = await db.list('hourly_bookings');
  const clash = all.some(x => x.date === date && x.status !== 'cancelled' && start < toMin(x.time) + x.minutes && toMin(x.time) < start + minutes);
  if (clash) return fail(409, 'هذا الموعد محجوز، اختر وقتاً آخر.');

  const sub = await subscriptionOf(me);
  const discount = sub?.status === 'active' ? 0.2 : 0;
  const priceSAR = Math.round(SEED.hourlyRateSAR / 60 * minutes * (1 - discount));
  const course = findCourse(clean(b.courseId, 60));
  const bk = {
    id: newId('bk-'), name, phone, email: me?.email || clean(b.email, 120).toLowerCase(),
    courseId: course?.id || '', courseTitle: course?.title || 'استشارة عامة',
    date, time, minutes, priceSAR, notes: clean(b.notes, 600), status: 'pending', createdAt: new Date().toISOString()
  };
  await db.set('hourly_bookings', bk.id, bk);
  await notify('booking', `حجز جلسة استشارية: ${name}`, {
    الاسم: name, الجوال: phone, البريد: bk.email, الكورس: bk.courseTitle, الموعد: `${date} ${time}`,
    المدة: `${minutes} دقيقة`, السعر: `${priceSAR} ر.س`, ملاحظات: bk.notes
  });
  return json({ booking: bk });
};
