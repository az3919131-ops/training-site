// إصدار الشهادات والتحقق الفوري منها عبر رمز QR (/verify/:code)
import crypto from 'node:crypto';
import { db } from '../../src/lib/db.js';
import { json, fail, readBody, clean, currentUser, subscriptionOf, hasAccess } from '../../src/lib/http.js';
import { notify } from '../../src/lib/notify.js';
import { SEED, findCourse } from '../../src/lib/seed.js';

export default async req => {
  if (req.method === 'GET') {
    const code = clean(new URL(req.url).searchParams.get('code'), 20).toUpperCase();
    const cert = code && await db.get('certificates', code);
    if (!cert) return json({ valid: false, code }, 404);
    return json({ valid: true, code, name: cert.name, courseTitle: cert.courseTitle, issuedAt: cert.issuedAt });
  }

  const me = await currentUser(req);
  if (!me) return fail(401, 'سجّل الدخول لإصدار الشهادة.');
  const b = await readBody(req);
  const course = findCourse(clean(b.courseId, 60));
  if (!course) return fail(404, 'الكورس غير موجود.');

  const paid = SEED.paid.some(c => c.id === course.id);
  if (paid && !hasAccess(me, await subscriptionOf(me))) return fail(403, 'الشهادة متاحة للمشتركين.');
  const total = paid ? ((await db.get('paid_job_courses', course.id))?.lessons || []).length : course.lessons.length;
  const data = await db.get('user_plans_and_reviews', me.email);
  const done = new Set(data?.progress?.[course.id]?.done || []).size;
  if (!total || done < total) return fail(400, 'أكمل جميع دروس الكورس أولاً.');

  const existing = (await db.list('certificates')).find(c => c.email === me.email && c.courseId === course.id);
  if (existing) return json({ certificate: existing });
  const cert = {
    code: 'ILT-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
    email: me.email, name: me.name, courseId: course.id, courseTitle: course.title, issuedAt: new Date().toISOString()
  };
  await db.set('certificates', cert.code, cert);
  await notify('certificate', `شهادة جديدة: ${me.name}`, { المتدرب: me.name, البريد: me.email, الكورس: course.title, الرمز: cert.code });
  return json({ certificate: cert });
};
