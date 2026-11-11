// مكتبة المحتوى: المدير والمدربون المعتمدون يضيفون أي محتوى علمي (فيديو، ملفات، روابط، مقالات)
import { db } from '../../src/lib/db.js';
import { json, fail, readBody, action, clean, newId, currentUser, subscriptionOf, hasAccess, STAFF } from '../../src/lib/http.js';
import { notify } from '../../src/lib/notify.js';
import { SEED, findCourse } from '../../src/lib/seed.js';

const TYPES = ['video', 'file', 'link', 'article'];
const CATS = SEED.categories.map(c => c.id).filter(c => c !== 'all');
const MAX_FILE = 4 * 1024 * 1024; // حد حجم الطلب في دوال Netlify؛ الملفات الأكبر تُضاف كرابط
const BLOCKED = /\.(html?|xhtml|js|mjs|svg|exe|bat|cmd|sh|php|msi|scr|jar)$/i;
const okUrl = u => { try { return ['http:', 'https:'].includes(new URL(u).protocol); } catch { return false; } };

export default async req => {
  const act = action(req), url = new URL(req.url);
  const me = await currentUser(req);
  const open = hasAccess(me, await subscriptionOf(me));
  const staff = !!me && STAFF.includes(me.role);

  if (req.method === 'GET' && act === 'file') {
    const it = await db.get('content_library', clean(url.searchParams.get('id'), 60));
    if (!it || !it.hasFile) return fail(404, 'الملف غير موجود.');
    if (it.access === 'paid' && !open) return fail(403, 'هذا المحتوى للمشتركين.');
    const f = await db.getFile('content_files', it.id);
    if (!f) return fail(404, 'الملف غير موجود.');
    return new Response(f.data, { headers: {
      'content-type': it.mime || 'application/octet-stream',
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(it.fileName)}`,
      'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff'
    } });
  }

  if (req.method === 'GET') {
    const items = (await db.list('content_library')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return json({ items: items.map(it => {
      const locked = it.access === 'paid' && !open;
      return { ...it, locked, url: locked ? '' : it.url, body: locked ? '' : it.body };
    }) });
  }

  if (!staff) return fail(403, 'إضافة المحتوى للمدير والمدربين المعتمدين فقط.');
  const b = await readBody(req);

  if (act === 'delete') {
    const it = await db.get('content_library', clean(b.id, 60));
    if (!it) return json({ ok: true });
    if (me.role !== 'admin' && it.by !== me.email) return fail(403, 'يمكنك حذف ما أضفته أنت فقط.');
    await db.del('content_library', it.id);
    if (it.hasFile) await db.del('content_files', it.id);
    return json({ ok: true });
  }

  const type = TYPES.includes(b.type) ? b.type : '';
  const title = clean(b.title, 140), link = clean(b.url, 500);
  if (!type || !title) return fail(400, 'اختر نوع المحتوى واكتب عنواناً.');
  const it = {
    id: newId('ct-'), type, title, desc: clean(b.desc, 600),
    cat: CATS.includes(b.cat) ? b.cat : 'ai', courseId: findCourse(b.courseId)?.id || '',
    access: b.access === 'paid' ? 'paid' : 'free',
    url: '', body: '', hasFile: false, fileName: '', mime: '', size: 0,
    by: me.email, byName: me.name, createdAt: new Date().toISOString()
  };
  if (type === 'article') {
    it.body = String(b.body || '').replace(/[<>]/g, ' ').trim().slice(0, 20000);
    if (!it.body) return fail(400, 'اكتب نص المقال.');
  } else if (b.fileBase64) {
    const fileName = clean(b.fileName, 160).replace(/[\\/]/g, '_');
    if (!fileName || BLOCKED.test(fileName)) return fail(400, 'نوع الملف غير مسموح.');
    const buf = Buffer.from(String(b.fileBase64), 'base64');
    if (!buf.length || buf.length > MAX_FILE) return fail(413, 'الحد الأقصى للملف 4 ميجابايت. للملفات الأكبر أضف رابط يوتيوب أو Google Drive.');
    await db.putFile('content_files', it.id, buf, { fileName });
    Object.assign(it, { hasFile: true, fileName, mime: clean(b.mime, 100) || 'application/octet-stream', size: buf.length });
  } else if (okUrl(link)) {
    it.url = link;
  } else return fail(400, 'أضف رابطاً صحيحاً أو ارفع ملفاً.');

  await db.set('content_library', it.id, it);
  await notify('content', `محتوى جديد: ${title}`, { العنوان: title, النوع: type, الإتاحة: it.access, المضيف: me.email, الملف: it.fileName || it.url || 'مقال' });
  return json({ item: it });
};
