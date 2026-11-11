// إدارة المستخدمين (للمدير): إنشاء، أدوار، صلاحيات تفصيلية، إيقاف، منح اشتراك، المحافظ ونسب العمولة
import { db } from '../../src/lib/db.js';
import { json, fail, readBody, action, clean, newId, currentUser, hashPassword, publicUser, adminEmail, PERMS } from '../../src/lib/http.js';
import { settings, addEntry, balanceOf, PLATFORM, POOL } from '../../src/lib/wallet.js';
import { SEED, DAY } from '../../src/lib/seed.js';

const ROLES = ['trainee', 'instructor', 'teacher', 'contractor_b2b'];
const byDate = (a, b) => b.at.localeCompare(a.at);

export default async req => {
  const act = action(req);
  const me = await currentUser(req);
  if (!me) return fail(401, 'سجّل الدخول أولاً.');
  const ledger = await db.list('wallet_ledger');

  // محفظتي (لأي مستخدم)
  if (req.method === 'GET' && act === 'wallet') {
    const account = me.role === 'admin' ? PLATFORM : me.email;
    return json({ balance: balanceOf(ledger, account), entries: ledger.filter(e => e.account === account).sort(byDate).slice(0, 100) });
  }

  if (me.role !== 'admin') return fail(403, 'هذه الصفحة لمدير النظام فقط.');

  if (req.method === 'GET') {
    const [users, subs] = await Promise.all([db.list('users'), db.list('subscriptions')]);
    return json({
      users: users.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map(u => {
        const s = subs.find(x => x.id === u.subId);
        return { ...publicUser(u), createdAt: u.createdAt, balance: balanceOf(ledger, u.email),
          paid: ledger.filter(e => e.account === u.email && e.type === 'payment').reduce((n, e) => n + e.amountSAR, 0),
          sub: s ? { status: s.status, planTitle: s.planTitle, periodEnd: s.periodEnd } : null };
      }),
      settings: await settings(), allPerms: PERMS,
      platform: balanceOf(ledger, PLATFORM), pool: balanceOf(ledger, POOL),
      ledger: ledger.sort(byDate).slice(0, 200)
    });
  }

  const b = await readBody(req);
  const email = clean(b.email, 120).toLowerCase();

  if (act === 'settings') {
    const pct = v => Math.min(100, Math.max(0, Math.round(+v || 0)));
    const s = { commissionTrainer: pct(b.commissionTrainer), commissionTrainee: pct(b.commissionTrainee) };
    await db.set('config', 'commission', s);
    return json({ settings: s });
  }

  if (act === 'create') {
    const name = clean(b.name, 80), password = String(b.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !name || password.length < 8) return fail(400, 'أدخل الاسم وبريداً صحيحاً وكلمة مرور من 8 أحرف على الأقل.');
    if (email === adminEmail() || await db.get('users', email)) return fail(409, 'هذا البريد مسجل بالفعل.');
    const u = { email, name, phone: clean(b.phone, 30), company: '', specialty: clean(b.specialty, 120), role: ROLES.includes(b.role) ? b.role : 'trainee',
      requestedRole: '', pass: hashPassword(password), createdAt: new Date().toISOString(), createdBy: 'admin' };
    await db.set('users', email, u);
    return json({ user: publicUser(u) });
  }

  // قيد على حساب عام (رصيد المدربين) أو على مستخدم
  if (act === 'ledger') {
    const account = b.account === POOL ? POOL : email;
    if (account !== POOL && !await db.get('users', email)) return fail(404, 'المستخدم غير موجود.');
    const amount = Math.abs(+b.amountSAR || 0), note = clean(b.note, 200);
    if (!amount) return fail(400, 'أدخل مبلغاً صحيحاً.');
    if (b.type === 'payout') await addEntry(account, 'payout', -amount, note || 'صرف مستحقات');
    else if (b.type === 'credit') await addEntry(account, 'credit', amount, note || 'إضافة رصيد');
    else if (b.type === 'from-pool') { // توزيع من رصيد المدربين إلى مدرب
      await addEntry(POOL, 'payout', -amount, `توزيع إلى ${email}`);
      await addEntry(email, 'earning', amount, note || 'حصة من اشتراكات المتدربين');
    } else return fail(400, 'نوع القيد غير معروف.');
    return json({ ok: true });
  }

  const u = await db.get('users', email);
  if (!u) return fail(404, 'المستخدم غير موجود.');

  if (act === 'update') {
    if (b.role !== undefined) { if (!ROLES.includes(b.role)) return fail(400, 'دور غير صحيح.'); if (b.role !== u.role) delete u.perms; u.role = b.role; u.requestedRole = ''; }
    if (b.perms !== undefined) { if (b.perms === null) delete u.perms; else u.perms = (Array.isArray(b.perms) ? b.perms : []).filter(p => PERMS.includes(p)); }
    if (b.suspended !== undefined) u.suspended = !!b.suspended;
    if (b.password) { if (String(b.password).length < 8) return fail(400, 'كلمة المرور 8 أحرف على الأقل.'); u.pass = hashPassword(String(b.password)); }
    await db.set('users', u.email, u);
    return json({ user: publicUser(u) });
  }

  if (act === 'grant-sub') {
    const plan = SEED.plans.find(p => p.id === b.plan && p.monthlySAR > 0);
    const days = Math.min(3650, Math.max(1, Math.round(+b.days || 30)));
    if (!plan) return fail(400, 'اختر باقة.');
    const sub = { id: newId('sub-'), email: u.email, name: u.name, phone: u.phone || '', plan: plan.id, planTitle: plan.title, cycle: 'monthly', currency: 'SAR',
      amountSAR: 0, status: 'active', granted: true, periodEnd: new Date(Date.now() + days * DAY).toISOString(), createdAt: new Date().toISOString() };
    await db.set('subscriptions', sub.id, sub);
    u.subId = sub.id; await db.set('users', u.email, u);
    return json({ subscription: sub });
  }

  if (act === 'delete') {
    await db.del('users', u.email); await db.del('user_plans_and_reviews', u.email);
    return json({ ok: true });
  }
  return fail(404, 'عملية غير معروفة.');
};
