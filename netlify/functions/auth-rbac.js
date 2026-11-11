// التسجيل والدخول والصلاحيات (admin / instructor / contractor_b2b / trainee) وحالة الاشتراك
import { db } from '../../src/lib/db.js';
import { json, fail, readBody, action, clean, adminEmail, signToken, currentUser, hashPassword, verifyPassword,
  checkAdminPassword, subscriptionOf, publicUser } from '../../src/lib/http.js';
import { notify } from '../../src/lib/notify.js';

const ROLES = ['trainee', 'instructor', 'teacher', 'contractor_b2b'];
const NEEDS_APPROVAL = ['instructor', 'teacher'];
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

export default async req => {
  const act = action(req);
  const b = req.method === 'POST' ? await readBody(req) : {};

  if (act === 'register' && req.method === 'POST') {
    const email = clean(b.email, 120).toLowerCase();
    const name = clean(b.name, 80), password = String(b.password || '');
    const wanted = ROLES.includes(b.role) ? b.role : 'trainee';
    if (!validEmail(email) || !name || password.length < 8) return fail(400, 'أدخل الاسم وبريداً صحيحاً وكلمة مرور من 8 أحرف على الأقل.');
    if (email === adminEmail() || await db.get('users', email)) return fail(409, 'هذا البريد مسجل بالفعل، سجّل الدخول.');
    // أدوار المدرب والمدرّس تحتاج اعتماد المدير؛ يبدأ الحساب كمتدرب حتى الموافقة
    const user = {
      email, name, phone: clean(b.phone, 30), company: clean(b.company, 120),
      role: NEEDS_APPROVAL.includes(wanted) ? 'trainee' : wanted,
      requestedRole: NEEDS_APPROVAL.includes(wanted) ? wanted : '',
      specialty: clean(b.specialty, 120),
      pass: hashPassword(password), createdAt: new Date().toISOString()
    };
    await db.set('users', email, user);
    await notify('register', `تسجيل جديد: ${name}`, { الاسم: name, البريد: email, الجوال: user.phone, الدور: wanted, الشركة: user.company });
    return json({ token: await signToken(email), user: publicUser(user), subscription: null });
  }

  if (act === 'login' && req.method === 'POST') {
    const email = clean(b.email, 120).toLowerCase(), password = String(b.password || '');
    if (email && email === adminEmail()) {
      if (!checkAdminPassword(password)) return fail(401, 'بيانات الدخول غير صحيحة.');
      return json({ token: await signToken(email), user: { email, name: 'مدير المنصة', role: 'admin' }, subscription: { status: 'active', plan: 'admin' } });
    }
    const user = await db.get('users', email);
    if (!user || !verifyPassword(password, user.pass)) return fail(401, 'بيانات الدخول غير صحيحة.');
    return json({ token: await signToken(email), user: publicUser(user), subscription: await subscriptionOf(user) });
  }

  // قائمة المدربين والمدرسين المعتمدين (عامة)
  if (act === 'instructors') {
    const users = await db.list('users');
    return json({ instructors: users.filter(u => NEEDS_APPROVAL.includes(u.role)).map(u => ({ name: u.name, role: u.role, specialty: u.specialty || '', bio: u.bio || '' })) });
  }

  const me = await currentUser(req);
  if (!me) return fail(401, 'سجّل الدخول أولاً.');

  if (act === 'me') return json({ user: publicUser(me), subscription: await subscriptionOf(me) });

  if (act === 'profile' && req.method === 'POST' && me.role !== 'admin') {
    me.name = clean(b.name, 80) || me.name; me.phone = clean(b.phone, 30); me.company = clean(b.company, 120);
    me.specialty = clean(b.specialty, 120); me.bio = clean(b.bio, 600);
    await db.set('users', me.email, me);
    return json({ user: publicUser(me) });
  }

  if (me.role !== 'admin') return fail(403, 'هذه العملية للمدير فقط.');

  if (act === 'admin') {
    const [users, notes] = await Promise.all([db.list('users'), db.list('notifications')]);
    return json({
      users: users.map(publicUser),
      notifications: notes.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 60)
    });
  }
  if (act === 'set-role' && req.method === 'POST') {
    const u = await db.get('users', clean(b.email, 120).toLowerCase());
    if (!u || !ROLES.includes(b.role)) return fail(400, 'مستخدم أو دور غير صحيح.');
    u.role = b.role; u.requestedRole = '';
    await db.set('users', u.email, u);
    return json({ user: publicUser(u) });
  }
  return fail(404, 'عملية غير معروفة.');
};
