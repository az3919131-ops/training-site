// الكورسات المجانية (روابط يوتيوب)، دروس الكورسات المدفوعة، مسارات التعلم، و«خطتي / مراجعاتي»
import { db } from '../../src/lib/db.js';
import { json, fail, readBody, action, clean, newId, currentUser, subscriptionOf, hasAccess, can } from '../../src/lib/http.js';
import { notify } from '../../src/lib/notify.js';
import { SEED, findCourse } from '../../src/lib/seed.js';

const CATS = SEED.categories.map(c => c.id).filter(c => c !== 'all');
const okUrl = u => { try { return ['http:', 'https:'].includes(new URL(u).protocol); } catch { return false; } };

export default async req => {
  const act = action(req);
  const me = await currentUser(req);
  const b = req.method === 'POST' ? await readBody(req) : {};
  const staff = can(me, 'lessons.add');

  if (req.method === 'GET' && !act) {
    const [links, extra] = await Promise.all([db.list('free_youtube_courses'), db.list('paid_job_courses')]);
    const open = hasAccess(me, await subscriptionOf(me));
    const paidLessons = {};
    for (const rec of extra) paidLessons[rec.id] = (rec.lessons || []).map(l => ({ id: l.id, t: l.t, url: open ? l.url : '' }));
    return json({
      links: links.filter(l => l.approved || (me && (l.owner === me.email || me.role === 'admin'))),
      paidLessons,
      config: { whatsapp: (process.env.WHATSAPP_NUMBER || '').replace(/\D/g, '') }
    });
  }

  if (!me) return fail(401, 'سجّل الدخول أولاً.');

  if (act === 'userdata' && req.method === 'GET') return json({ data: await db.get('user_plans_and_reviews', me.email) });
  if (act === 'userdata' && req.method === 'POST') {
    const d = b.data || {};
    const data = {
      plan: (Array.isArray(d.plan) ? d.plan : []).slice(0, 200).map(x => clean(x, 60)),
      favs: (Array.isArray(d.favs) ? d.favs : []).slice(0, 200).map(x => clean(x, 60)),
      progress: typeof d.progress === 'object' && d.progress ? d.progress : {},
      reviews: (Array.isArray(d.reviews) ? d.reviews : []).slice(0, 200).map(r => ({
        id: clean(r.id, 40), courseId: clean(r.courseId, 60), rating: Math.min(5, Math.max(1, +r.rating || 5)),
        text: clean(r.text, 1000), date: clean(r.date, 40)
      })),
      updatedAt: new Date().toISOString()
    };
    if (JSON.stringify(data).length > 200000) return fail(413, 'البيانات أكبر من المسموح.');
    await db.set('user_plans_and_reviews', me.email, data);
    return json({ ok: true });
  }

  if (act === 'add-link' && req.method === 'POST') {
    const url = clean(b.url, 500), title = clean(b.title, 140);
    if (!okUrl(url) || !title) return fail(400, 'أدخل رابطاً صحيحاً وعنواناً.');
    const link = {
      id: newId('link-'), url, title, desc: clean(b.desc, 400),
      cat: CATS.includes(b.cat) ? b.cat : 'ai',
      pathId: SEED.paths.some(p => p.id === b.pathId) ? b.pathId : '',
      owner: me.email, ownerName: me.name, approved: can(me, 'links.approve'), createdAt: new Date().toISOString()
    };
    await db.set('free_youtube_courses', link.id, link);
    if (link.pathId) {
      const p = (await db.get('learning_paths', link.pathId)) || { id: link.pathId, steps: [] };
      p.steps.push(link.id); await db.set('learning_paths', link.pathId, p);
    }
    await notify('link', `رابط جديد: ${title}`, { العنوان: title, الرابط: url, التخصص: link.cat, المضيف: me.email });
    return json({ link });
  }
  if (act === 'delete-link' && req.method === 'POST') {
    const l = await db.get('free_youtube_courses', clean(b.id, 60));
    if (!l) return json({ ok: true });
    if (l.owner !== me.email && me.role !== 'admin') return fail(403, 'غير مسموح.');
    await db.del('free_youtube_courses', l.id);
    return json({ ok: true });
  }
  if (act === 'approve-link' && req.method === 'POST') {
    if (!can(me, 'links.approve')) return fail(403, 'لا تملك صلاحية اعتماد الروابط.');
    const l = await db.get('free_youtube_courses', clean(b.id, 60));
    if (!l) return fail(404, 'الرابط غير موجود.');
    l.approved = !!b.approved; await db.set('free_youtube_courses', l.id, l);
    return json({ link: l });
  }

  if (act === 'review' && req.method === 'POST') {
    const c = findCourse(clean(b.courseId, 60));
    await notify('review', `مراجعة جديدة: ${c?.title || b.courseId}`, {
      الكورس: c?.title || clean(b.courseId, 60), التقييم: `${+b.rating || 5}/5`, النص: clean(b.text, 1000), المتدرب: me.email
    });
    return json({ ok: true });
  }

  // إضافة دروس فيديو للكورسات المدفوعة (المدير أو المحاضر المعتمد)
  if (act === 'add-lesson' && req.method === 'POST') {
    if (!staff) return fail(403, 'للمحاضرين والمدير فقط.');
    const c = SEED.paid.find(x => x.id === b.courseId);
    const url = clean(b.url, 500), t = clean(b.title, 140);
    if (!c || !okUrl(url) || !t) return fail(400, 'بيانات الدرس غير مكتملة.');
    const rec = (await db.get('paid_job_courses', c.id)) || { id: c.id, lessons: [] };
    rec.lessons.push({ id: newId('ls-'), t, url, by: me.email });
    await db.set('paid_job_courses', c.id, rec);
    return json({ lessons: rec.lessons });
  }
  if (act === 'delete-lesson' && req.method === 'POST') {
    if (!staff) return fail(403, 'للمحاضرين والمدير فقط.');
    const rec = await db.get('paid_job_courses', clean(b.courseId, 60));
    if (rec) { rec.lessons = rec.lessons.filter(l => l.id !== b.id); await db.set('paid_job_courses', rec.id, rec); }
    return json({ ok: true });
  }
  return fail(404, 'عملية غير معروفة.');
};
