// بوابات الدفع: مدى و Apple Pay عبر Moyasar (صفحة دفع مستضافة)، وفودافون كاش عبر Paymob.
// لا نثق بأي إشعار قبل التحقق منه: Moyasar بإعادة جلب الفاتورة بالمفتاح السري، و Paymob بتوقيع HMAC.
import crypto from 'node:crypto';
import { db } from '../../src/lib/db.js';
import { json, fail, readBody, action, clean, newId, currentUser } from '../../src/lib/http.js';
import { notify } from '../../src/lib/notify.js';
import { activateSubscription } from '../../src/lib/billing.js';
import { SEED } from '../../src/lib/seed.js';

const env = k => (process.env[k] || '').trim();
const MOYASAR = 'https://api.moyasar.com/v1';
const PAYMOB = 'https://accept.paymob.com';
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

export const methods = () => ({
  mada: !!env('MOYASAR_SECRET_KEY'),
  applepay: !!env('MOYASAR_SECRET_KEY'),
  vodafone: !!(env('PAYMOB_SECRET_KEY') && env('PAYMOB_PUBLIC_KEY') && env('PAYMOB_HMAC_SECRET') && env('PAYMOB_WALLET_INTEGRATION_ID'))
});

async function settle(p) {
  if (p.status === 'paid') return p;
  p.status = 'paid'; p.paidAt = new Date().toISOString();
  await db.set('payments', p.id, p);
  const sub = await db.get('subscriptions', p.subId);
  if (sub) {
    await activateSubscription(sub, p.id, p.amountSAR);
    await notify('payment', `دفعة ناجحة: ${p.name}`, { الاسم: p.name, البريد: p.email, الباقة: sub.planTitle, الطريقة: p.method, المبلغ: `${p.amountSAR} ر.س` + (p.currency === 'EGP' ? ` (${p.chargeAmount} ج.م)` : '') });
  }
  return p;
}

// Moyasar: التحقق بجلب الفاتورة من الخادم مباشرة (مطابقة الحالة والمبلغ والعملة)
async function verifyMoyasar(p) {
  const r = await fetch(`${MOYASAR}/invoices/${encodeURIComponent(p.gatewayId)}`, { headers: { authorization: 'Basic ' + Buffer.from(env('MOYASAR_SECRET_KEY') + ':').toString('base64') } });
  if (!r.ok) return p;
  const inv = await r.json();
  if (inv.status === 'paid' && inv.amount === p.chargeAmount * 100 && inv.currency === 'SAR') return settle(p);
  if (['failed', 'canceled', 'expired', 'voided'].includes(inv.status) && p.status === 'pending') { p.status = 'failed'; await db.set('payments', p.id, p); }
  return p;
}

// Paymob: حقول التوقيع بالترتيب الرسمي (إشعار المعالجة POST)
export function paymobHmac(obj, secret) {
  const s = obj.source_data || {};
  const signed = [obj.amount_cents, obj.created_at, obj.currency, obj.error_occured, obj.has_parent_transaction, obj.id, obj.integration_id, obj.is_3d_secure,
    obj.is_auth, obj.is_capture, obj.is_refunded, obj.is_standalone_payment, obj.is_voided, obj.order?.id, obj.owner, obj.pending, s.pan, s.sub_type, s.type, obj.success].join('');
  return crypto.createHmac('sha512', secret).update(signed).digest('hex');
}

export default async req => {
  const url = new URL(req.url), act = action(req), origin = url.origin;

  if (req.method === 'GET' && act === 'methods') return json({ methods: methods() });

  // نتيجة الدفع بعد العودة من البوابة (معرّف عشوائي؛ لا تُرجَع أي بيانات شخصية)
  if (req.method === 'GET' && act === 'status') {
    let p = await db.get('payments', clean(url.searchParams.get('pid'), 40));
    if (!p) return fail(404, 'عملية الدفع غير موجودة.');
    if (p.status === 'pending' && p.gateway === 'moyasar') p = await verifyMoyasar(p).catch(() => p);
    return json({ status: p.status, method: p.method });
  }

  if (act === 'moyasar-callback') {
    const p = await db.get('payments', clean(url.searchParams.get('pid'), 40));
    if (!p || p.gateway !== 'moyasar' || !safeEq(url.searchParams.get('t') || '', p.token)) return fail(403, 'مرفوض.');
    await verifyMoyasar(p);
    return json({ ok: true });
  }

  if (act === 'paymob-callback' && req.method === 'POST') {
    const body = await readBody(req), obj = body.obj;
    if (!obj || !env('PAYMOB_HMAC_SECRET')) return fail(400, 'طلب غير صحيح.');
    if (!safeEq(url.searchParams.get('hmac') || '', paymobHmac(obj, env('PAYMOB_HMAC_SECRET')))) return fail(403, 'توقيع غير صحيح.');
    const p = await db.get('payments', clean(obj.order?.merchant_order_id, 40));
    if (!p || p.gateway !== 'paymob') return json({ ok: true }); // إشعارات لا تخص المنصة
    const okTx = obj.success === true && obj.pending === false && obj.is_voided === false && obj.is_refunded === false && obj.error_occured === false
      && obj.amount_cents === p.chargeAmount * 100 && obj.currency === 'EGP';
    if (okTx) await settle(p);
    else if (obj.success === false && p.status === 'pending') { p.status = 'failed'; await db.set('payments', p.id, p); }
    return json({ ok: true });
  }

  const me = await currentUser(req);
  if (!me) return fail(401, 'سجّل الدخول أولاً.');
  if (req.method !== 'POST' || act !== 'checkout') return fail(404, 'عملية غير معروفة.');

  const b = await readBody(req), method = ['mada', 'applepay', 'vodafone'].includes(b.method) ? b.method : '';
  if (!method || !methods()[method]) return fail(400, 'طريقة الدفع غير مفعّلة بعد.');
  const sub = me.subId && await db.get('subscriptions', me.subId);
  if (!sub || !['pending', 'renewal_due', 'expired'].includes(sub.status)) return fail(400, 'لا يوجد اشتراك بانتظار الدفع. اختر باقة أولاً.');
  if (!sub.amountSAR) return fail(400, 'هذا الاشتراك لا يحتاج دفعاً.');

  // المبلغ يُحسب دائماً من سجل الاشتراك في الخادم
  const egp = method === 'vodafone';
  const p = { id: newId('pay-'), token: crypto.randomBytes(16).toString('hex'), subId: sub.id, email: me.email, name: me.name, method,
    gateway: egp ? 'paymob' : 'moyasar', currency: egp ? 'EGP' : 'SAR', amountSAR: sub.amountSAR,
    chargeAmount: egp ? Math.ceil(sub.amountSAR * SEED.rates.EGP) : sub.amountSAR, status: 'pending', createdAt: new Date().toISOString() };
  const ret = `${origin}/?paid=${p.id}`;

  try {
    if (!egp) {
      const r = await fetch(`${MOYASAR}/invoices`, { method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Basic ' + Buffer.from(env('MOYASAR_SECRET_KEY') + ':').toString('base64') },
        body: JSON.stringify({ amount: p.chargeAmount * 100, currency: 'SAR', description: `التزام التدريب — ${sub.planTitle}`,
          callback_url: `${origin}/api/payments?action=moyasar-callback&pid=${p.id}&t=${p.token}`, success_url: ret, back_url: `${origin}/#/pricing`,
          metadata: { pid: p.id } }) });
      const inv = await r.json().catch(() => ({}));
      if (!r.ok || !inv.url) { console.error('moyasar', r.status, inv.type, inv.message); return fail(502, 'تعذر إنشاء صفحة الدفع. حاول لاحقاً أو تواصل عبر واتساب.'); }
      p.gatewayId = inv.id; p.payUrl = inv.url;
    } else {
      const phone = clean(b.phone || me.phone, 20).replace(/[^\d+]/g, '');
      if (phone.replace(/\D/g, '').length < 10) return fail(400, 'أدخل رقم فودافون كاش المصري.');
      const [first, ...rest] = me.name.split(' ');
      const r = await fetch(`${PAYMOB}/v1/intention/`, { method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Token ${env('PAYMOB_SECRET_KEY')}` },
        body: JSON.stringify({ amount: p.chargeAmount * 100, currency: 'EGP', payment_methods: [Number(env('PAYMOB_WALLET_INTEGRATION_ID'))],
          items: [{ name: sub.planTitle.slice(0, 50), amount: p.chargeAmount * 100, description: 'Iltizam Training subscription', quantity: 1 }],
          billing_data: { first_name: first || 'NA', last_name: rest.join(' ') || 'NA', email: me.email, phone_number: phone },
          special_reference: p.id, notification_url: `${origin}/api/payments?action=paymob-callback`, redirection_url: ret }) });
      const it = await r.json().catch(() => ({}));
      if (!r.ok || !it.client_secret) { console.error('paymob', r.status, JSON.stringify(it).slice(0, 300)); return fail(502, 'تعذر إنشاء عملية الدفع. حاول لاحقاً أو تواصل عبر واتساب.'); }
      p.gatewayId = String(it.id || ''); p.payUrl = `${PAYMOB}/unifiedcheckout/?publicKey=${encodeURIComponent(env('PAYMOB_PUBLIC_KEY'))}&clientSecret=${encodeURIComponent(it.client_secret)}`;
    }
  } catch (e) { console.error('checkout', e); return fail(502, 'تعذر الاتصال ببوابة الدفع.'); }

  await db.set('payments', p.id, p);
  return json({ pid: p.id, url: p.payUrl });
};
