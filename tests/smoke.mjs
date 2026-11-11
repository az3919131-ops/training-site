// اختبار سريع لدوال Netlify محلياً (يعمل على مخزن الذاكرة البديل)
import assert from 'node:assert/strict';
process.env.ADMIN_EMAIL = 'admin@example.com'; process.env.ADMIN_PASSWORD = 'admin-pass-123';
const load = async n => (await import(`../netlify/functions/${n}.js`)).default;
const [auth, courses, booking, subs, cert] = await Promise.all(['auth-rbac', 'courses-and-paths', 'booking-engine', 'subscription-manager', 'verify-certificate'].map(load));
const { runRenewal } = await import('../netlify/functions/cron-monthly-renewal.js');
const call = async (fn, q, body, token) => {
  const r = await fn(new Request('http://x/api' + q, {
    method: body ? 'POST' : 'GET', body: body && JSON.stringify(body),
    headers: token ? { authorization: 'Bearer ' + token } : {}
  }));
  return { s: r.status, ...(await r.json()) };
};

let r = await call(auth, '?action=register', { name: 'Test', email: 'T@Example.com', password: 'password1', role: 'instructor', phone: '0500000000' });
assert.equal(r.s, 200); assert.equal(r.user.role, 'trainee'); assert.equal(r.user.requestedRole, 'instructor');
const tok = r.token;
assert.equal((await call(auth, '?action=register', { name: 'x', email: 't@example.com', password: 'password1' })).s, 409);
assert.equal((await call(auth, '?action=login', { email: 't@example.com', password: 'wrong' })).s, 401);
assert.equal((await call(auth, '?action=me', null, tok + 'x')).s, 401);
assert.equal((await call(auth, '?action=admin', null, tok)).s, 403);
const admin = (await call(auth, '?action=login', { email: 'admin@example.com', password: 'admin-pass-123' })).token;
assert.ok(admin);

r = await call(courses, '?action=add-link', { url: 'https://youtu.be/abc', title: 'My link', cat: 'ai', pathId: 'path-ai' }, tok);
assert.equal(r.link.approved, false);
assert.equal((await call(courses, '')).links.length, 0);            // غير معتمد: لا يظهر للزوار
assert.equal((await call(courses, '', null, tok)).links.length, 1); // يظهر لصاحبه
await call(courses, '?action=approve-link', { id: r.link.id, approved: true }, admin);
assert.equal((await call(courses, '')).links.length, 1);

assert.equal((await call(courses, '?action=add-lesson', { courseId: 'sec-pro', title: 'L1', url: 'https://youtu.be/x' }, tok)).s, 403);
await call(courses, '?action=add-lesson', { courseId: 'sec-pro', title: 'L1', url: 'https://youtu.be/x' }, admin);
assert.equal((await call(courses, '', null, tok)).paidLessons['sec-pro'][0].url, ''); // مقفل لغير المشترك

r = await call(subs, '?action=subscribe', { plan: 'all-access', cycle: 'monthly', currency: 'SAR' }, tok);
assert.equal(r.subscription.status, 'pending');
r = await call(subs, '?action=activate', { id: r.subscription.id }, admin);
assert.equal(r.subscription.status, 'active');
assert.equal((await call(courses, '', null, tok)).paidLessons['sec-pro'][0].url, 'https://youtu.be/x');

r = await call(booking, '', { name: 'Test', phone: '0500000000', date: '2099-01-01', time: '10:00', minutes: 60 }, tok);
assert.equal(r.booking.priceSAR, 160); // خصم 20% للمشترك
assert.equal((await call(booking, '', { name: 'B', phone: '0500000001', date: '2099-01-01', time: '10:30', minutes: 30 })).s, 409);

assert.equal((await call(cert, '', { courseId: 'azure-ai900' }, tok)).s, 400);
await call(courses, '?action=userdata', { data: { plan: ['azure-ai900'], progress: { 'azure-ai900': { done: [0] } } } }, tok);
r = await call(cert, '', { courseId: 'azure-ai900' }, tok);
assert.match(r.certificate.code, /^ILT-/);
assert.equal((await call(cert, '?code=' + r.certificate.code)).valid, true);
assert.equal((await call(cert, '?code=NOPE')).valid, false);

assert.deepEqual(await runRenewal(Date.now() + 31 * 86400000), { due: 1, expired: 0 });
assert.deepEqual(await runRenewal(Date.now() + 35 * 86400000), { due: 0, expired: 1 });
assert.equal((await call(courses, '', null, tok)).paidLessons['sec-pro'][0].url, '');
assert.ok((await call(auth, '?action=admin', null, admin)).notifications.length >= 6);

// مكتبة المحتوى والصلاحيات
const content = await load('content-library');
assert.equal((await call(content, '', { type: 'link', title: 'x', url: 'https://a.b' }, tok)).s, 403);
await call(auth, '?action=set-role', { email: 't@example.com', role: 'teacher' }, admin);
assert.equal((await call(auth, '?action=instructors')).instructors.length, 1);
r = await call(content, '', { type: 'file', title: 'ملف', access: 'paid', fileName: 'boq.xlsx', mime: 'application/x', fileBase64: Buffer.from('hello').toString('base64') }, tok);
assert.equal(r.item.hasFile, true);
const cid = r.item.id;
assert.equal((await call(content, '', { type: 'file', title: 'bad', fileName: 'x.html', fileBase64: 'aGk=' }, tok)).s, 400);
assert.equal((await call(content, '')).items[0].locked, true);
assert.equal((await content(new Request('http://x/api?action=file&id=' + cid))).status, 403);
const fr = await content(new Request('http://x/api?action=file&id=' + cid, { headers: { authorization: 'Bearer ' + tok } }));
assert.equal(await fr.text(), 'hello');
assert.equal((await call(content, '?action=delete', { id: cid }, admin)).ok, true);
assert.equal((await call(content, '')).items.length, 0);

// إدارة المستخدمين، الصلاحيات، المحافظ والعمولات
const adm = await load('admin-users');
assert.equal((await call(adm, '', null, tok)).s, 403);
r = await call(adm, '', null, admin);
assert.equal(r.platform, 44.7); assert.equal(r.pool, 104.3);                 // 30% من اشتراك 149
await call(adm, '?action=settings', { commissionTrainer: 25, commissionTrainee: 30 }, admin);
r = await call(adm, '?action=create', { name: 'Trainer', email: 'tr@example.com', password: 'password1', role: 'instructor' }, admin);
assert.deepEqual(r.user.perms, ['content.add', 'lessons.add', 'paid.access']);
const ttok = (await call(auth, '?action=login', { email: 'tr@example.com', password: 'password1' })).token;
await call(adm, '?action=update', { email: 'tr@example.com', perms: ['bookings.manage'] }, admin);
assert.equal((await call(content, '', { type: 'link', title: 'x', url: 'https://a.b' }, ttok)).s, 403);  // سُحبت الصلاحية
r = await call(booking, '', null, ttok); const bid = r.bookings[0].id;        // مُنحت إدارة الحجوزات
await call(booking, '?action=status', { id: bid, status: 'done', trainerEmail: 'tr@example.com' }, admin);
await call(booking, '?action=status', { id: bid, status: 'done' }, admin);    // لا تتكرر التسوية
assert.equal((await call(adm, '?action=wallet', null, ttok)).balance, 120);   // 160 - 25%
await call(adm, '?action=ledger', { email: 'tr@example.com', type: 'payout', amountSAR: 100 }, admin);
assert.equal((await call(adm, '?action=wallet', null, ttok)).balance, 20);
assert.equal((await call(adm, '?action=wallet', null, admin)).balance, 84.7);
await call(adm, '?action=grant-sub', { email: 'tr@example.com', plan: 'all-access', days: 7 }, admin);
assert.equal((await call(auth, '?action=me', null, ttok)).subscription.status, 'active');
await call(adm, '?action=update', { email: 'tr@example.com', suspended: true }, admin);
assert.equal((await call(auth, '?action=me', null, ttok)).s, 401);
assert.equal((await call(auth, '?action=login', { email: 'tr@example.com', password: 'password1' })).s, 403);
await call(adm, '?action=delete', { email: 'tr@example.com' }, admin);
assert.equal((await call(adm, '', null, admin)).users.some(u => u.email === 'tr@example.com'), false);
console.log('✓ smoke tests passed');
