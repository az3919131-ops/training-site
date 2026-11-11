/* التزام التدريب — منطق الواجهة (Vanilla JS). يعمل محلياً بـ localStorage، وعلى Netlify عبر /api */
(() => {
  'use strict';
  const SEED = window.ILTIZAM_SEED;
  const CONFIG = { whatsapp: '' }; // رقم واتساب بالصيغة الدولية بدون + (بديل عن متغير البيئة WHATSAPP_NUMBER)
  const KEY = 'iltizam.v1';
  const ONLINE = location.protocol.startsWith('http');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = u => { try { const x = new URL(u); return ['http:', 'https:'].includes(x.protocol) ? x.href : ''; } catch { return ''; } };

  /* ---------- الحالة ---------- */
  const S = Object.assign({
    lang: 'ar', theme: '', currency: 'SAR', plan: [], favs: [], progress: {}, reviews: [], links: [],
    notifs: [], bookings: [], certs: [], token: '', user: null, sub: null, last: ''
  }, (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })());
  const R = { cat: 'all', q: '', cycle: 'monthly', methods: {}, content: [], trainers: [], links: [], paidLessons: {}, wa: CONFIG.whatsapp, playing: null, admin: null, adminTab: 'subs' };
  let syncTimer;
  function save(sync = true) {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* التخزين غير متاح */ }
    if (sync && S.token && ONLINE) {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(() => api('courses-and-paths?action=userdata', { data: { plan: S.plan, favs: S.favs, progress: S.progress, reviews: S.reviews } }).catch(() => {}), 700);
    }
  }
  const tr = (ar, en) => (S.lang === 'en' && en ? en : ar);
  const title = o => tr(o.title, o.titleEn);

  async function api(path, body) {
    if (!ONLINE) throw new Error(tr('هذه الخدمة تعمل بعد نشر الموقع على Netlify.', 'This works once the site is deployed.'));
    const r = await fetch('/api/' + path, {
      method: body ? 'POST' : 'GET',
      headers: Object.assign(body ? { 'content-type': 'application/json' } : {}, S.token ? { authorization: 'Bearer ' + S.token } : {}),
      body: body ? JSON.stringify(body) : undefined
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(d.error || tr('تعذر الاتصال بالخادم.', 'Server error.')); e.status = r.status; throw e; }
    return d;
  }

  async function apiBlob(path) {
    const r = await fetch('/api/' + path, { headers: S.token ? { authorization: 'Bearer ' + S.token } : {} });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || tr('تعذر تحميل الملف.', 'Download failed.'));
    return r.blob();
  }

  /* ---------- البيانات ---------- */
  function ytParse(u) {
    try {
      const x = new URL(u), h = x.hostname.replace(/^www\.|^m\./, '');
      if (h === 'youtu.be') return { yt: x.pathname.slice(1, 12) };
      if (h.endsWith('youtube.com') || h.endsWith('youtube-nocookie.com')) {
        const m = x.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/);
        if (x.searchParams.get('v')) return { yt: x.searchParams.get('v').slice(0, 11) };
        if (m) return { yt: m[1] };
        if (x.searchParams.get('list')) return { list: x.searchParams.get('list') };
      }
    } catch { /* ليس رابطاً */ }
    return {};
  }
  const linkCourse = (l, local) => ({
    id: l.id, kind: 'free', custom: true, local, cat: l.cat, title: l.title, desc: l.desc || tr('رابط مضاف من المتدرب.', 'Learner-added link.'),
    pathId: l.pathId, url: l.url, pending: !local && !l.approved, owner: l.owner,
    lessons: [Object.assign({ t: l.title, href: l.url }, ytParse(l.url))]
  });
  const freeAll = () => [
    ...SEED.free.map(c => Object.assign({ kind: 'free' }, c)),
    ...R.links.map(l => linkCourse(l, false)), ...S.links.map(l => linkCourse(l, true))
  ];
  const paidAll = () => SEED.paid.map(c => {
    const up = R.paidLessons[c.id] || [];
    return Object.assign({ kind: 'paid' }, c, {
      syllabus: c.lessons,
      lessons: up.length ? up.map(l => Object.assign({ t: l.t, id: l.id, locked: !l.url }, ytParse(l.url), { href: l.url }))
        : c.lessons.map(t => ({ t, locked: true, soon: true }))
    });
  });
  const course = id => [...freeAll(), ...paidAll()].find(c => c.id === id);
  const STAFF = ['admin', 'instructor', 'teacher'];
  const can = p => !!S.user && (S.user.role === 'admin' || (S.user.perms || []).includes(p));
  const hasAccess = () => !!S.user && (can('paid.access') || ['active', 'renewal_due'].includes(S.sub?.status));
  const isStaff = () => can('content.add');
  const doneOf = c => (S.progress[c.id]?.done || []).filter(i => i < c.lessons.length);
  const pct = c => (c.lessons.length ? Math.round(doneOf(c).length / c.lessons.length * 100) : 0);
  const match = c => (R.cat === 'all' || c.cat === R.cat || (c.cats || []).includes(R.cat)) &&
    (!R.q || [c.title, c.titleEn, c.desc].join(' ').toLowerCase().includes(R.q.toLowerCase()));
  const thumb = c => { const l = c.lessons.find(x => x.yt); return l ? `https://i.ytimg.com/vi/${l.yt}/hqdefault.jpg` : ''; };
  function money(sar) {
    if (!sar) return tr('مجاناً', 'Free');
    const v = sar * SEED.rates[S.currency];
    const n = S.currency === 'EGP' ? Math.round(v / 10) * 10 : Math.round(v);
    return `${n.toLocaleString('en')} ${{ SAR: tr('ر.س', 'SAR'), EGP: tr('ج.م', 'EGP'), USD: '$' }[S.currency]}`;
  }
  const waLink = text => `https://wa.me/${R.wa || ''}?text=${encodeURIComponent(text)}`;
  function addNotif(text) { S.notifs.unshift({ text, at: Date.now(), read: false }); S.notifs = S.notifs.slice(0, 30); save(false); badge(); }
  function badge() {
    $('#notifDot').hidden = !S.notifs.some(n => !n.read);
    const pc = $('#planCount'); pc.hidden = !S.plan.length; pc.textContent = S.plan.length;
  }
  function toast(msg) {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
    $('#toasts').append(el); setTimeout(() => el.remove(), 3200);
  }

  /* ---------- مكوّنات العرض ---------- */
  function card(c) {
    const paid = c.kind === 'paid', p = pct(c), img = thumb(c), inPlan = S.plan.includes(c.id), fav = S.favs.includes(c.id);
    return `<article class="card">
      <button class="cover" data-act="open" data-id="${esc(c.id)}" aria-label="${esc(title(c))}">
        ${img ? `<img src="${img}" alt="" loading="lazy">` : `<span class="glyph" aria-hidden="true">${c.icon || '🔗'}</span>`}
        <span class="badges">
          <span class="badge ${paid ? 'paid' : 'free'}">${paid ? tr('دبلوم مؤهل للعمل', 'Job-ready diploma') : tr('مجاني', 'Free')}</span>
          ${c.official ? `<span class="badge official">${tr('القناة الرسمية', 'Official')}</span>` : ''}
          ${c.custom ? `<span class="badge mine">${c.pending ? tr('بانتظار الاعتماد', 'Pending') : tr('رابط مضاف', 'Added link')}</span>` : ''}
        </span>
        ${img ? '<span class="play" aria-hidden="true">▶</span>' : ''}
      </button>
      <div class="card-body">
        <h3><button data-act="open" data-id="${esc(c.id)}">${esc(title(c))}</button></h3>
        <p>${esc(c.desc)}</p>
        <div class="meta">
          ${paid ? `<span>${c.hours} ${tr('ساعة', 'hrs')}</span><span class="price">${money(c.priceSAR)}</span>`
            : `<span>${c.lessons.length} ${tr('درس', 'lessons')}</span><span>YouTube</span>`}
        </div>
        ${p ? `<div class="bar" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100" aria-label="${tr('التقدم', 'Progress')}"><i style="width:${p}%"></i></div>` : ''}
        <div class="card-foot">
          <button class="btn sm ${paid ? 'primary' : 'start'}" data-act="open" data-id="${esc(c.id)}">${p ? tr('أكمل التعلم', 'Continue') : paid ? tr('تفاصيل الدبلوم', 'Details') : tr('ابدأ التعلم', 'Start')}</button>
          <button class="icon-btn" data-act="plan" data-id="${esc(c.id)}" aria-pressed="${inPlan}" title="${tr('أضف إلى خطتي', 'Add to my plan')}" aria-label="${tr('أضف إلى خطتي', 'Add to my plan')}">${inPlan ? '✓' : '＋'}</button>
          <button class="icon-btn" data-act="fav" data-id="${esc(c.id)}" aria-pressed="${fav}" title="${tr('المفضلة', 'Favourite')}" aria-label="${tr('المفضلة', 'Favourite')}">${fav ? '♥' : '♡'}</button>
        </div>
      </div></article>`;
  }
  const grid = (list, emptyMsg) => `<div class="grid">${list.length ? list.map(card).join('') : `<div class="empty">${emptyMsg || tr('لا توجد نتائج مطابقة. جرّب تخصصاً آخر أو امسح البحث.', 'No matches. Try another category.')}<br><button class="btn soft sm" data-act="clear">${tr('عرض الكل', 'Show all')}</button></div>`}</div>`;
  const head = (eyebrow, h, p, extra = '') => `<div class="sec-head"><div><span class="eyebrow">${eyebrow}</span><h2>${h}</h2><p>${p}</p></div>${extra}</div>`;

  const hero = () => `<section class="hero"><div class="wrap">
      <h1>${tr('كل اللي محتاج تتعلّمه وتشتغل بيه،', 'Everything you need to learn and work with,')}
        <em>${tr('في اشتراك واحد.. أو عبر مساراتنا المجانية.', 'in one subscription — or through our free paths.')}</em></h1>
      <p>${tr('من مشاريع الكهرباء والعقد الموحد والمكتب الفني، إلى الذكاء الاصطناعي واللغات. طوّر مهاراتك مع نخبة المهندسين والخبراء في السعودية ومصر خطوة بخطوة من الصفر حتى استلام العمل.',
        'From electrical projects, the SEC unified contract and the technical office to AI and languages. Grow step by step with engineers and experts in Saudi Arabia and Egypt, from zero to job-ready.')}</p>
      <div class="cta">
        <button class="btn gold" data-act="resume">${tr('أكمل التعلم / افتح خطتي', 'Continue learning / My plan')}</button>
        <a class="btn glow" href="#/paid">${tr('استكشف دبلومات التأهيل الوظيفي', 'Explore job-ready diplomas')}</a>
        <a class="btn ghost" href="${SEED.channel}" target="_blank" rel="noopener">${tr('افتح القناة الرسمية Alpha Media', 'Open the official Alpha Media channel')} ↗</a>
      </div></div></section>`;

  const filters = () => `<section class="filters wrap" aria-label="${tr('التخصصات', 'Categories')}">
      <p class="welcome">${tr('أهلاً بك.. اختر تخصصك أو أكمل من حيث توقفت، كل يوم خطوة عملية تفرق في مسيرتك المهنية.', 'Welcome — pick your field or continue where you left off.')}</p>
      <div class="pills">${SEED.categories.map(c => `<button class="pill" data-act="cat" data-id="${c.id}" aria-pressed="${R.cat === c.id}">${esc(tr(c.ar, c.en))}</button>`).join('')}</div>
    </section>`;

  const freeSec = () => `<section class="section wrap" id="free">
      ${head(tr('القسم الأول · مجاني', 'Part one · Free'), tr('قسم التطوير والتعليم المجاني', 'Free learning library'),
        tr('أهم كورسات وقنوات يوتيوب مرتبة بعناية. شاهدها داخل مشغل المنصة وأضفها إلى خطتك.', 'Curated YouTube courses. Watch inside the platform and add them to your plan.'),
        `<button class="btn soft sm" data-act="add-link">${tr('+ أضف رابط', '+ Add link')}</button>`)}
      ${grid(freeAll().filter(match))}
    </section>`;

  const creator = () => `<section class="section wrap"><div class="creator">
      <div><h3>${tr('أضف رابطاً أو أنشئ مسار تعلم مجاني', 'Add a link or build a free path')}</h3>
      <p>${tr('الصق أي رابط يوتيوب أو موقع ذكاء اصطناعي، حدّد التخصص، وسيظهر فوراً كبطاقة كورس مجاني أو كخطوة داخل مسار تعلم.', 'Paste any YouTube or AI tool link, choose a category, and it appears as a free course card or a path step.')}</p></div>
      <button class="btn gold" data-act="add-link">${tr('+ أضف رابط', '+ Add link')}</button></div></section>`;

  const paidSec = () => `<section class="section wrap" id="paid">
      ${head(tr('القسم الثاني · مدفوع', 'Part two · Paid'), tr('الدبلومات المؤهلة لسوق العمل', 'Job-ready diplomas'),
        tr('دبلومات تطبيقية مكثفة تؤهلك لاستلام العمل فعلياً — اشترِ الدبلوم أو افتح الكل باشتراك شهري واحد.', 'Intensive applied diplomas — or unlock them all with one monthly subscription.'),
        `<a class="btn gold sm" href="#/pricing">${tr('افتح الكل باشتراك واحد', 'Unlock all')}</a>`)}
      ${grid(paidAll().filter(match))}
    </section>`;

  function pathSteps(p) {
    const extra = [...R.links, ...S.links].filter(l => l.pathId === p.id).map(l => ({ ref: l.id }));
    return [...p.steps, ...extra];
  }
  function pathCard(p) {
    const steps = pathSteps(p);
    return `<article class="pathcard">
      <div class="badges"><span class="badge path">${tr('مسار تعلم', 'Learning path')}</span><span class="badge feat">${tr('مميز', 'Featured')}</span></div>
      <h3>${esc(title(p))}</h3><p>${esc(p.desc)}</p>
      <ol class="steps">${steps.map(s => {
        const c = s.ref && course(s.ref);
        if (!c) return s.t ? `<li><span>${esc(s.t)}</span></li>` : '';
        return `<li class="${pct(c) === 100 ? 'done' : ''}"><span><button data-act="open" data-id="${esc(c.id)}">${esc(title(c))}</button><span class="tag">${c.kind === 'paid' ? tr('مدفوع', 'Paid') : tr('مجاني', 'Free')}</span></span></li>`;
      }).join('')}</ol>
      <div class="card-foot">
        <button class="btn gold sm" data-act="plan-path" data-id="${p.id}">${tr('أضف المسار إلى خطتي', 'Add path to my plan')}</button>
        <button class="btn ghost sm" data-act="add-link" data-path="${p.id}">${tr('+ أضف خطوة', '+ Add step')}</button>
      </div></article>`;
  }
  const pathsSec = () => {
    const list = SEED.paths.filter(p => (R.cat === 'all' || p.cats.includes(R.cat)) && (!R.q || (p.title + p.titleEn + p.desc).toLowerCase().includes(R.q.toLowerCase())));
    return `<section class="section wrap" id="paths">
      ${head(tr('مسارات مرتبة', 'Structured'), tr('مسارات التعلم', 'Learning paths'), tr('رحلة مرتبة من الصفر للاحتراف تدمج الكورسات المجانية والمدفوعة والتطبيق العملي.', 'Ordered journeys mixing free courses, diplomas and practice.'))}
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">${list.length ? list.map(pathCard).join('') : `<div class="empty">${tr('لا يوجد مسار في هذا التخصص بعد.', 'No path in this category yet.')}<br><button class="btn soft sm" data-act="clear">${tr('عرض الكل', 'Show all')}</button></div>`}</div>
    </section>`;
  };

  const platformsSec = () => `<section class="section wrap" id="platforms">
      ${head(tr('اربح وتعلّم', 'Earn & learn'), tr('بوابة المنصات العالمية التسع', 'The nine global platforms'), tr('دليلك للتدريس والتعلم عبر أشهر المنصات العالمية حسب تخصصك.', 'Your guide to teaching and learning on leading platforms.'))}
      ${SEED.platforms.map(g => `<div class="plat-group"><h3>${esc(tr(g.group, g.groupEn))}</h3><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">
        ${g.items.map(i => `<a class="card plat" href="${i.url}" target="_blank" rel="noopener"><strong>${i.name} ↗</strong><span>${esc(i.note)}</span></a>`).join('')}</div></div>`).join('')}
    </section>`;

  const pricingSec = () => `<section class="section wrap" id="pricing">
      ${head(tr('الباقات', 'Plans'), tr('الاشتراكات والصلاحيات', 'Subscriptions & roles'), tr('اختر باقتك، وأكمل الدفع والتفعيل مباشرة عبر واتساب.', 'Choose a plan and complete payment and activation over WhatsApp.'),
        `<div class="cycle" role="group" aria-label="${tr('دورة الفوترة', 'Billing cycle')}"><button data-act="cycle" data-id="monthly" aria-pressed="${R.cycle === 'monthly'}">${tr('شهري', 'Monthly')}</button><button data-act="cycle" data-id="yearly" aria-pressed="${R.cycle === 'yearly'}">${tr('سنوي (شهران مجاناً)', 'Yearly (2 months free)')}</button></div>`)}
      <div class="grid">${SEED.plans.map(p => {
        const amt = R.cycle === 'yearly' ? p.monthlySAR * 10 : p.monthlySAR, mine = S.sub?.plan === p.id && S.sub.status !== 'cancelled' && S.sub.status !== 'expired';
        return `<article class="card plan ${p.featured ? 'featured' : ''}"><h3>${esc(title(p))}</h3>
          <div class="amount">${money(amt)} ${amt ? `<small>/ ${R.cycle === 'yearly' ? tr('سنة', 'year') : tr('شهر', 'month')}</small>` : ''}</div>
          <ul>${p.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
          ${p.monthlySAR ? `<button class="btn ${p.featured ? 'gold' : 'primary'}" data-act="subscribe" data-id="${p.id}">${mine ? tr('حالة اشتراكي', 'My subscription') : tr('اشترك الآن', 'Subscribe')}</button>`
            : `<a class="btn soft" href="#/free">${tr('ابدأ مجاناً', 'Start free')}</a>`}</article>`;
      }).join('')}</div>
      <div class="roles">
        <div class="role"><code>trainee</code> — ${tr('متدرب: المكتبة المجانية وخطتي، والدبلومات عند الاشتراك.', 'Trainee: free library, plan, diplomas when subscribed.')} <a href="/join/trainee" data-join="trainee">${tr('سجّل', 'Join')}</a></div>
        <div class="role"><code>instructor</code> — ${tr('محاضر: يضيف دروس الدبلومات بعد اعتماد المدير.', 'Instructor: adds diploma lessons after admin approval.')} <a href="/join/instructor" data-join="instructor">${tr('انضم', 'Join')}</a></div>
        <div class="role"><code>contractor_b2b</code> — ${tr('مقاول: باقة الفريق حتى 10 مقاعد.', 'Contractor: team plan, up to 10 seats.')} <a href="/join/contractor" data-join="contractor">${tr('سجّل شركتك', 'Join')}</a></div>
        <div class="role"><code>admin</code> — ${tr('مدير المنصة: تفعيل الاشتراكات والحجوزات واعتماد الروابط.', 'Admin: activates subscriptions, bookings and links.')}</div>
      </div></section>`;

  /* ---------- صفحة تفاصيل الكورس ---------- */
  function embed(l) {
    if (l.yt) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(l.yt)}?autoplay=1&rel=0`;
    if (l.list) return `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(l.list)}&autoplay=1`;
    return '';
  }
  function coursePage(id) {
    const c = course(id);
    if (!c) return `<div class="wrap page"><div class="empty">${tr('الكورس غير موجود.', 'Course not found.')}<br><a class="btn soft sm" href="#/home">${tr('الرئيسية', 'Home')}</a></div></div>`;
    const paid = c.kind === 'paid', open = !paid || hasAccess(), done = doneOf(c), p = pct(c);
    const play = R.playing?.id === c.id ? R.playing.idx : -1, cur = c.lessons[play];
    const src = cur && !cur.locked ? embed(cur) : '', img = thumb(c);
    const inPlan = S.plan.includes(c.id), fav = S.favs.includes(c.id);
    const lockMsg = paid && !open ? tr('محتوى الدبلوم متاح للمشتركين. اشترك لفتح جميع الدروس والمرفقات.', 'Diploma content is for subscribers.')
      : tr('ستُضاف فيديوهات هذا الدبلوم قريباً من المحاضر. تابع الإشعارات.', 'Videos for this diploma will be added by the instructor soon.');
    const frame = src ? `<iframe src="${src}" title="${esc(cur.t)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`
      : paid && !c.lessons.some(l => !l.locked) ? `<button class="poster" data-act="start" data-id="${esc(c.id)}"><span class="lockmsg"><b aria-hidden="true">${c.icon}</b>${lockMsg}</span></button>`
      : `<button class="poster" data-act="start" data-id="${esc(c.id)}" aria-label="${tr('تشغيل', 'Play')}">${img ? `<img src="${img}" alt="">` : ''}<span class="pb" aria-hidden="true">▶</span></button>`;

    return `<div class="wrap"><a class="back" href="#/${paid ? 'paid' : 'free'}">→ ${tr('رجوع للكورسات', 'Back to courses')}</a>
    <div class="detail">
      <div>
        <div class="player"><div class="frame">${frame}</div><div class="now">${cur ? esc(cur.t) : esc(title(c))}</div></div>
        <section class="panel"><h2>${tr('تعرف على الكورس', 'About this course')}</h2><p>${esc(c.desc)}</p>
          ${c.outcomes ? `<ul class="ticks">${c.outcomes.map(o => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}
          ${paid && c.lessons[0] && !c.lessons[0].soon ? `<p class="small muted" style="margin-block-start:12px">${tr('محاور الدبلوم', 'Syllabus')}: ${c.syllabus.map(esc).join(' · ')}</p>` : ''}
          ${c.custom && safeUrl(c.url) ? `<p style="margin-block-start:12px"><a href="${safeUrl(c.url)}" target="_blank" rel="noopener">${tr('افتح الرابط الأصلي', 'Open original link')} ↗</a></p>` : ''}
        </section>
        ${c.demo ? dashDemo() : ''}
        <section class="panel"><h2>${tr('قائمة الدروس', 'Playlist')} <span class="small muted">(${done.length}/${c.lessons.length})</span></h2>
          ${p ? `<div class="bar" style="margin-block-end:14px"><i style="width:${p}%"></i></div>` : ''}
          <ol class="lessons">${c.lessons.map((l, i) => `<li>
            <button class="lesson" data-act="lesson" data-id="${esc(c.id)}" data-i="${i}" aria-current="${i === play}"><span class="n">${l.locked ? '🔒' : i + 1}</span><span>${esc(l.t)}</span></button>
            ${l.locked ? '' : `<button class="check" data-act="done" data-id="${esc(c.id)}" data-i="${i}" aria-pressed="${done.includes(i)}" aria-label="${tr('تم إنهاء الدرس', 'Mark lesson done')}" title="${tr('تم إنهاء الدرس', 'Mark done')}">✓</button>`}
            ${l.id && can('lessons.add') ? `<button class="check" data-act="del-lesson" data-id="${esc(c.id)}" data-lid="${esc(l.id)}" aria-label="${tr('حذف الدرس', 'Delete lesson')}">✕</button>` : ''}
          </li>`).join('')}</ol>
          ${paid && can('lessons.add') ? `<form class="f" data-form="lesson" data-id="${esc(c.id)}" style="margin-block-start:16px"><div class="cols">
            <label>${tr('عنوان الدرس', 'Lesson title')}<input name="title" required maxlength="140"></label>
            <label>${tr('رابط الفيديو (يوتيوب غير مدرج)', 'Video URL')}<input name="url" type="url" required dir="ltr"></label></div>
            <p class="err" role="alert"></p><button class="btn soft sm">${tr('+ أضف درساً للدبلوم', '+ Add lesson')}</button></form>` : ''}
        </section>
        <section class="panel"><h2>${tr('المرفقات الهندسية وملفات العمل', 'Engineering attachments & work files')}</h2>
          ${R.content.some(x => x.courseId === c.id) ? `<ul class="files" style="margin-block-end:8px">${R.content.filter(x => x.courseId === c.id).map(x => `<li><span><span class="badge">${CT()[x.type][0]}</span> ${esc(x.title)}</span><button class="btn sky sm" data-act="content-open" data-id="${esc(x.id)}">${x.locked ? '🔒 ' + tr('للمشتركين', 'Subscribers') : tr('افتح', 'Open')}</button></li>`).join('')}</ul>` : ''}
          ${(c.attachments || []).length ? `<ul class="files">${c.attachments.map(a => `<li><span><span class="badge">${esc(a.kind)}</span> ${esc(a.name)}</span>
            ${!open ? `<button class="btn soft sm" data-act="subscribe" data-id="all-access">🔒 ${tr('للمشتركين', 'Subscribers')}</button>`
              : a.file ? `<button class="btn sky sm" data-act="download" data-id="${a.file}">${tr('تحميل', 'Download')}</button>`
              : `<span class="small muted">${tr('يُرفع من المحاضر', 'Uploaded by instructor')}</span>`}</li>`).join('')}</ul>`
            : R.content.some(x => x.courseId === c.id) ? '' : `<p class="muted">${tr('لا توجد مرفقات لهذا الكورس بعد.', 'No attachments for this course yet.')}</p>`}
          ${isStaff() ? `<button class="btn soft sm" style="margin-block-start:12px" data-act="add-content" data-course="${esc(c.id)}">${tr('+ أضف محتوى لهذا الكورس', '+ Add content to this course')}</button>` : ''}
        </section>
      </div>
      <aside class="side">
        <div class="badges" style="position:static"><span class="badge ${paid ? 'paid' : 'free'}">${paid ? tr('دبلوم مؤهل للعمل', 'Job-ready diploma') : tr('مجاني', 'Free')}</span>
          ${paid && open ? `<span class="badge free">${tr('مفتوح باشتراكك', 'Unlocked')}</span>` : ''}</div>
        <h1>${esc(title(c))}</h1>
        <p class="muted">${esc(c.desc)}</p>
        ${paid ? `<p><span class="price" style="font-size:20px">${money(c.priceSAR)}</span> <span class="small muted">· ${tr('أو ضمن الاشتراك الشامل', 'or included in All-Access')} ${money(149)}/${tr('شهر', 'mo')}</span></p>` : ''}
        <div class="stack">
          <button class="btn primary block" data-act="start" data-id="${esc(c.id)}">${p && p < 100 ? tr('أكمل التعلم', 'Continue') : tr('ابدأ التعلم', 'Start learning')}</button>
          <button class="btn soft block" data-act="plan" data-id="${esc(c.id)}" aria-pressed="${inPlan}">${inPlan ? tr('✓ في خطتي', '✓ In my plan') : tr('أضف إلى خطتي', 'Add to my plan')}</button>
          <a class="btn line block" href="#/${paid ? 'paid' : 'free'}">${tr('تصفح باقي الكورسات', 'Browse other courses')}</a>
          <button class="btn sky block" data-act="fav" data-id="${esc(c.id)}" aria-pressed="${fav}">${fav ? tr('♥ في المفضلة', '♥ In favourites') : tr('♡ أضف إلى المفضلة', '♡ Add to favourites')}</button>
          ${c.custom ? '' : `<button class="btn gold block" data-act="book" data-id="${esc(c.id)}">${tr('احجز جلسة استشارية بالساعة مع المحاضر', 'Book an hourly consultation')}</button>`}
          ${paid && !open ? `<button class="btn start block" data-act="subscribe" data-id="all-access">${tr('اشترك لفتح الدبلوم', 'Subscribe to unlock')}</button>` : ''}
          ${p === 100 && !c.custom ? `<button class="btn start block" data-act="cert" data-id="${esc(c.id)}">${tr('🎓 احصل على الشهادة', '🎓 Get certificate')}</button>` : ''}
        </div>
        <div class="acts" style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn soft sm" data-act="review" data-id="${esc(c.id)}">★ ${tr('قيّم الكورس', 'Review')}</button>
          ${c.custom && (c.local || c.owner === S.user?.email || S.user?.role === 'admin') ? `<button class="btn danger sm" data-act="del-link" data-id="${esc(c.id)}">${tr('حذف الرابط', 'Delete link')}</button>` : ''}
        </div>
      </aside>
    </div></div>`;
  }
  const dashDemo = () => `<section class="panel"><h2>${tr('معاينة: لوحة تحكم ستبنيها في الكورس', 'Preview: a dashboard you will build')}</h2>
    <p class="small muted" style="margin-block-end:12px">${tr('بيانات توضيحية لمشروع تجريبي.', 'Illustrative sample data.')}</p>
    <div class="dash"><div class="kpis">
      <div class="kpi"><b>128</b><span>${tr('أمر عمل مفتوح', 'Open work orders')}</span></div><div class="kpi"><b>86%</b><span>${tr('نسبة الإنجاز', 'Completion')}</span></div>
      <div class="kpi"><b>42</b><span>${tr('فني في الميدان', 'Field technicians')}</span></div><div class="kpi"><b>17</b><span>${tr('معدة عاملة', 'Active equipment')}</span></div></div>
      <div class="bars">${[['الأحد', 72], ['الاثنين', 88], ['الثلاثاء', 64], ['الأربعاء', 93], ['الخميس', 80]].map(([d, v]) => `<div><span>${d}</span><i style="width:${v}%"></i><span>${v}%</span></div>`).join('')}</div></div></section>`;

  /* ---------- صفحة المقدمة ---------- */
  const pull = (text, start = 0) => text.split(' ').map((w, i) => `<span class="pu" style="animation-delay:${(start + i) * 80}ms">${w}</span>`).join(' ');
  const welcomePage = () => `<section class="intro"><div class="intro-in">
      <video class="intro-bg" autoplay loop muted playsinline aria-hidden="true" ${matchMedia('(prefers-reduced-motion: reduce)').matches ? '' : 'src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_170732_8a9ccda6-5cff-4628-b164-059c500a2b41.mp4"'}></video>
      <div class="intro-noise" aria-hidden="true"></div><div class="intro-shade" aria-hidden="true"></div>
      <nav class="notch" aria-label="${tr('روابط المنصة', 'Platform links')}">
        <a href="#/free">${tr('المكتبة المجانية', 'Free library')}</a><a href="#/paid">${tr('الدبلومات', 'Diplomas')}</a><a href="#/paths">${tr('المسارات', 'Paths')}</a>
        <a href="#/trainers">${tr('المدربون', 'Trainers')}</a><a href="#/pricing">${tr('الباقات', 'Plans')}</a>
        <button data-act="lang">${S.lang === 'en' ? 'ع' : 'EN'}</button>
      </nav>
      <div class="intro-grid">
        <h1 class="intro-title" aria-label="${tr('التزام التدريب+', 'Iltizam Training+')}"><span class="pu">${tr('التزام', 'Iltizam')}<sup>+</sup></span></h1>
        <div class="intro-side">
          <form class="glass f" data-form="auth" data-mode="login" novalidate>
            <strong>${tr('دخول المتدربين والمدربين', 'Trainee & trainer login')}</strong>
            <label>${tr('البريد الإلكتروني', 'Email')}<input name="email" type="email" required dir="ltr" autocomplete="email"></label>
            <label>${tr('كلمة المرور', 'Password')}<input name="password" type="password" required dir="ltr" autocomplete="current-password"></label>
            <p class="err" role="alert"></p>
            <button class="btn gold block">${tr('دخول', 'Log in')}</button>
            <div class="chips"><span>${tr('حساب جديد:', 'New account:')}</span>
              <a href="/join/trainee" data-join="trainee">${tr('متدرب', 'Trainee')}</a><a href="/join/instructor" data-join="instructor">${tr('مدرب', 'Trainer')}</a>
              <a href="/join/teacher" data-join="teacher">${tr('مدرّس', 'Teacher')}</a><a href="/join/contractor" data-join="contractor">${tr('مقاول', 'Contractor')}</a></div>
          </form>
          <p class="intro-lead">${pull(tr('منصة واحدة تجمع مهندسي الكهرباء والعقد الموحد والمكتب الفني ومتعلمي الذكاء الاصطناعي واللغات في السعودية ومصر: تعلّم مجاناً، وتأهّل للعمل مع مدربين معتمدين.', 'One platform for electrical, unified-contract and technical-office engineers and AI and language learners in Saudi Arabia and Egypt: learn free, get job-ready with approved trainers.'), 4)}</p>
          <a class="arrow-btn" href="#/home">${tr('ادخل المنصة كزائر', 'Enter as guest')}<span aria-hidden="true">${S.lang === 'en' ? '→' : '←'}</span></a>
        </div>
      </div>
      <p class="intro-credit">Project manager &nbsp;Eng&nbsp; Ahmed Zahran</p>
    </div></section>`;

  /* ---------- مكتبة المحتوى والمدربون ---------- */
  const CT = () => ({ video: [tr('فيديو', 'Video'), '🎬'], file: [tr('ملف', 'File'), '📎'], link: [tr('رابط', 'Link'), '🔗'], article: [tr('مقال', 'Article'), '📝'] });
  const kb = n => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
  function libraryPage() {
    const list = R.content.filter(x => (R.cat === 'all' || x.cat === R.cat) && (!R.q || (x.title + ' ' + x.desc).toLowerCase().includes(R.q.toLowerCase())));
    return filters() + `<section class="section wrap">
      ${head(tr('محتوى المدربين', 'Trainer content'), tr('مكتبة المحتوى العلمي', 'Content library'), tr('فيديوهات وملفات ومقالات وروابط يضيفها مدير المنصة والمدربون المعتمدون.', 'Videos, files, articles and links added by the admin and approved trainers.'),
        isStaff() ? `<button class="btn gold sm" data-act="add-content">${tr('+ أضف محتوى', '+ Add content')}</button>` : '')}
      <div class="grid">${list.length ? list.map(x => { const c = x.courseId && course(x.courseId); return `<article class="card"><div class="card-body">
        <div class="badges" style="position:static"><span class="badge">${CT()[x.type][1]} ${CT()[x.type][0]}</span><span class="badge ${x.access === 'paid' ? 'paid' : 'free'}">${x.access === 'paid' ? tr('للمشتركين', 'Subscribers') : tr('مجاني', 'Free')}</span></div>
        <h3>${esc(x.title)}</h3><p>${esc(x.desc)}</p>
        <div class="meta"><span>${esc(x.byName || '')}</span>${x.hasFile ? `<span dir="ltr">${esc(x.fileName)} · ${kb(x.size)}</span>` : ''}${c ? `<span>${esc(title(c))}</span>` : ''}</div>
        <div class="card-foot"><button class="btn sm ${x.locked ? 'soft' : 'start'}" data-act="content-open" data-id="${esc(x.id)}">${x.locked ? '🔒 ' + tr('اشترك للفتح', 'Subscribe') : x.type === 'file' ? tr('تحميل', 'Download') : tr('افتح', 'Open')}</button>
        ${S.user && (S.user.role === 'admin' || x.by === S.user.email) ? `<button class="icon-btn" data-act="del-content" data-id="${esc(x.id)}" aria-label="${tr('حذف', 'Delete')}" title="${tr('حذف', 'Delete')}">✕</button>` : ''}</div>
      </div></article>`; }).join('') : `<div class="empty">${isStaff() ? tr('لا يوجد محتوى بعد. أضف أول فيديو أو ملف.', 'No content yet. Add the first item.') : tr('لم يُضف محتوى في هذا التخصص بعد.', 'No content here yet.')}</div>`}</div></section>`;
  }
  const trainersPage = () => `<section class="section wrap">
      ${head(tr('فريق التدريب', 'Training team'), tr('المدربون والمدرسون المعتمدون', 'Approved trainers & teachers'), tr('مهندسون وخبراء معتمدون من إدارة المنصة. يمكنك حجز جلسة استشارية مع المدرب من صفحة أي كورس.', 'Engineers and experts approved by the platform.'),
        `<a class="btn gold sm" href="/join/instructor" data-join="instructor">${tr('انضم كمدرب', 'Become a trainer')}</a>`)}
      <div class="grid">${R.trainers.length ? R.trainers.map(u => `<article class="card"><div class="card-body">
        <div class="avatar" aria-hidden="true">${esc(u.name.trim()[0] || '؟')}</div><h3>${esc(u.name)}</h3>
        <div class="badges" style="position:static"><span class="badge mine">${u.role === 'teacher' ? tr('مدرّس', 'Teacher') : tr('مدرب', 'Trainer')}</span>${u.specialty ? `<span class="badge">${esc(u.specialty)}</span>` : ''}</div>
        <p>${esc(u.bio || tr('لم يضف نبذة بعد.', 'No bio yet.'))}</p></div></article>`).join('')
        : `<div class="empty">${tr('لم يُعتمد مدربون بعد. سجّل كمدرب وسيظهر ملفك هنا بعد اعتماد المدير.', 'No approved trainers yet. Sign up as a trainer.')}</div>`}</div></section>`;

  /* ---------- الصفحات الشخصية ---------- */
  function row(c, acts) {
    const p = pct(c);
    return `<div class="row"><div class="grow"><strong>${esc(title(c))}</strong>
      <div class="small muted">${c.kind === 'paid' ? tr('دبلوم مدفوع', 'Paid diploma') : tr('مجاني', 'Free')} · ${doneOf(c).length}/${c.lessons.length} ${tr('درس', 'lessons')} · ${p}%</div>
      <div class="bar" style="margin-block-start:6px"><i style="width:${p}%"></i></div></div><div class="acts">${acts}</div></div>`;
  }
  function planPage() {
    const plan = S.plan.map(course).filter(Boolean), favs = S.favs.map(course).filter(Boolean);
    return `<div class="wrap page"><h1>${tr('خطتي', 'My plan')}</h1><p class="muted">${tr('جدولك الشخصي: كل ما أضفته من كورسات ومسارات مع تقدمك فيها.', 'Your personal schedule and progress.')}</p>
      <div class="rows">${plan.length ? plan.map(c => row(c, `<button class="btn start sm" data-act="start" data-id="${esc(c.id)}">${pct(c) ? tr('أكمل', 'Continue') : tr('ابدأ', 'Start')}</button><button class="btn soft sm" data-act="plan" data-id="${esc(c.id)}">${tr('إزالة', 'Remove')}</button>`)).join('')
        : `<div class="empty">${tr('خطتك فارغة. أضف كورساً أو مساراً كاملاً لتبدأ.', 'Your plan is empty.')}<br><a class="btn gold sm" href="#/paths">${tr('تصفح المسارات', 'Browse paths')}</a></div>`}</div>
      <h2 style="margin-block-start:40px">${tr('المفضلة', 'Favourites')}</h2>
      <div class="rows">${favs.length ? favs.map(c => row(c, `<button class="btn start sm" data-act="open" data-id="${esc(c.id)}">${tr('افتح', 'Open')}</button><button class="btn soft sm" data-act="fav" data-id="${esc(c.id)}">${tr('إزالة', 'Remove')}</button>`)).join('') : `<p class="muted">${tr('لم تضف كورسات للمفضلة بعد.', 'No favourites yet.')}</p>`}</div>
      ${S.bookings.length ? `<h2 style="margin-block-start:40px">${tr('جلساتي الاستشارية', 'My consultations')}</h2><div class="rows">${S.bookings.map(b => `<div class="row"><div class="grow"><strong>${esc(b.courseTitle)}</strong><div class="small muted">${esc(b.date)} · ${esc(b.time)} · ${b.minutes} ${tr('دقيقة', 'min')} · ${money(b.priceSAR)}</div></div><span class="status ${esc(b.status)}">${statusText(b.status)}</span></div>`).join('')}</div>` : ''}
      ${S.certs.length ? `<h2 style="margin-block-start:40px">${tr('شهاداتي', 'My certificates')}</h2><div class="rows">${S.certs.map(c => `<div class="row"><div class="grow"><strong>${esc(c.courseTitle)}</strong><div class="small muted" dir="ltr">${esc(c.code)}</div></div><button class="btn soft sm" data-act="show-cert" data-id="${esc(c.code)}">${tr('عرض', 'View')}</button></div>`).join('')}</div>` : ''}
    </div>`;
  }
  const statusText = s => ({ pending: tr('بانتظار التأكيد', 'Pending'), active: tr('فعّال', 'Active'), confirmed: tr('مؤكد', 'Confirmed'), done: tr('تمت', 'Done'),
    renewal_due: tr('مستحق التجديد', 'Renewal due'), expired: tr('منتهٍ', 'Expired'), cancelled: tr('ملغى', 'Cancelled') }[s] || s);

  const reviewsPage = () => `<div class="wrap page"><h1>${tr('مراجعاتي', 'My reviews')}</h1><p class="muted">${tr('تقييماتك وملاحظاتك على الكورسات التي درستها.', 'Your ratings and notes.')}</p>
    <div class="tabs"><button class="btn gold sm" data-act="review">${tr('+ أضف مراجعة', '+ Add review')}</button></div>
    <div class="rows">${S.reviews.length ? S.reviews.map(r => { const c = course(r.courseId); return `<div class="row"><div class="grow"><strong>${esc(c ? title(c) : r.courseId)}</strong>
      <div class="stars" aria-label="${r.rating}/5">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div><p>${esc(r.text)}</p><div class="small muted">${esc(r.date)}</div></div>
      <div class="acts"><button class="btn soft sm" data-act="review" data-id="${esc(r.courseId)}" data-rid="${esc(r.id)}">${tr('تعديل', 'Edit')}</button><button class="btn danger sm" data-act="del-review" data-id="${esc(r.id)}">${tr('حذف', 'Delete')}</button></div></div>`; }).join('')
      : `<div class="empty">${tr('لم تكتب أي مراجعة بعد.', 'No reviews yet.')}</div>`}</div></div>`;

  function accountPage() {
    if (!S.user) return `<div class="wrap page"><h1>${tr('حسابي', 'My account')}</h1>
      <p class="muted">${tr('تتصفح الآن كزائر: خطتك ومراجعاتك محفوظة على هذا الجهاز. سجّل لحفظها سحابياً وفتحها من أي جهاز والاشتراك في الدبلومات.', 'You are browsing as a guest; data is stored on this device. Sign up to sync it.')}</p>
      <div class="tabs"><button class="btn primary" data-act="auth" data-id="login">${tr('تسجيل الدخول', 'Log in')}</button><button class="btn gold" data-act="auth" data-id="register">${tr('إنشاء حساب', 'Create account')}</button></div></div>`;
    const u = S.user, sub = S.sub;
    return `<div class="wrap page"><h1>${tr('حسابي', 'My account')}</h1>
      <div class="two">
        <section class="panel" style="margin:0"><h2>${esc(u.name)}</h2>
          <p class="muted" dir="ltr" style="text-align:start">${esc(u.email)}</p>
          <p>${tr('الصلاحية', 'Role')}: <span class="badge mine">${esc(u.role)}</span> ${u.requestedRole ? `<span class="badge path">${tr('طلب محاضر بانتظار الاعتماد', 'Instructor request pending')}</span>` : ''}</p>
          ${u.company ? `<p>${tr('الشركة', 'Company')}: ${esc(u.company)}</p>` : ''}
          <div class="tabs"><button class="btn danger sm" data-act="logout">${tr('تسجيل الخروج', 'Log out')}</button></div></section>
        <section class="panel" style="margin:0"><h2>${tr('اشتراكي', 'My subscription')}</h2>
          ${u.role === 'admin' ? `<p class="muted">${tr('حساب المدير يملك كل الصلاحيات.', 'Admin has full access.')}</p>`
            : sub && sub.id ? `<p><strong>${esc(sub.planTitle)}</strong> · ${sub.cycle === 'yearly' ? tr('سنوي', 'Yearly') : tr('شهري', 'Monthly')} <span class="status ${esc(sub.status)}">${statusText(sub.status)}</span></p>
              ${sub.periodEnd ? `<p class="small muted">${tr('ينتهي في', 'Ends')}: ${new Date(sub.periodEnd).toLocaleDateString(S.lang === 'en' ? 'en' : 'ar-EG')}</p>` : ''}
              ${['pending', 'renewal_due', 'expired'].includes(sub.status) ? payButtons(sub) : ''}
              <div class="tabs">${['pending', 'renewal_due', 'expired'].includes(sub.status) ? `<a class="btn gold sm" target="_blank" rel="noopener" href="${waLink(subMsg(sub))}">${tr('أكمل الدفع عبر واتساب', 'Pay via WhatsApp')}</a>` : ''}
              ${['active', 'pending'].includes(sub.status) ? `<button class="btn danger sm" data-act="cancel-sub">${tr('إلغاء الاشتراك', 'Cancel')}</button>` : `<a class="btn primary sm" href="#/pricing">${tr('اشترك من جديد', 'Subscribe again')}</a>`}</div>`
            : `<p class="muted">${tr('أنت على الباقة المجانية.', 'You are on the free plan.')}</p><div class="tabs"><a class="btn gold sm" href="#/pricing">${tr('عرض الباقات', 'See plans')}</a></div>`}
        </section>
      </div>
      <section class="panel"><h2>${tr('محفظتي', 'My wallet')} ${R.wallet ? `<span class="badge paid">${R.wallet.balance.toLocaleString('en')} ${tr('ر.س', 'SAR')}</span>` : ''}</h2>
        <p class="small muted">${u.role === 'admin' ? tr('إيراد المنصة من نسب الاشتراكات والجلسات.', 'Platform revenue from commissions.') : tr('مستحقاتك من الجلسات والاشتراكات بعد خصم نسبة المنصة، وسجل مدفوعاتك.', 'Your earnings after platform commission, and your payments.')}</p>
        <div class="rows" style="margin-block-start:12px">${R.wallet?.entries.length ? R.wallet.entries.slice(0, 15).map(ledgerRow).join('') : `<p class="muted">${tr('لا توجد حركات بعد.', 'No transactions yet.')}</p>`}</div>
        ${u.role === 'admin' ? `<div class="tabs"><a class="btn gold sm" href="#/admin">${tr('إدارة المستخدمين والصلاحيات والعمولات', 'Manage users, permissions & commissions')}</a></div>` : ''}</section>
      ${STAFF.includes(u.role) || isStaff() ? `<section class="panel"><h2>${tr('لوحة المدرب', 'Trainer panel')}</h2>
        <div class="tabs" style="margin-block:0 16px"><button class="btn gold sm" data-act="add-content">${tr('+ أضف محتوى (فيديو / ملف / مقال)', '+ Add content')}</button><a class="btn soft sm" href="#/library">${tr('إدارة مكتبة المحتوى', 'Manage library')}</a><a class="btn soft sm" href="#/paid">${tr('إضافة دروس للدبلومات', 'Add diploma lessons')}</a></div>
        ${u.role === 'admin' ? '' : `<form class="f" data-form="profile" novalidate><div class="cols">
          <label>${tr('الاسم', 'Name')}<input name="name" required value="${esc(u.name)}"></label>
          <label>${tr('التخصص', 'Specialty')}<input name="specialty" maxlength="120" value="${esc(u.specialty || '')}"></label></div>
          <label>${tr('نبذة تظهر في صفحة المدربين', 'Bio shown on the trainers page')}<textarea name="bio" maxlength="600">${esc(u.bio || '')}</textarea></label>
          <input type="hidden" name="phone" value="${esc(u.phone || '')}"><input type="hidden" name="company" value="${esc(u.company || '')}">
          <p class="err" role="alert"></p><button class="btn primary sm">${tr('حفظ الملف التعريفي', 'Save profile')}</button></form>`}</section>` : ''}
      ${u.role === 'admin' ? adminPanel() : ''}</div>`;
  }
  const subMsg = s => `مرحباً، أرغب في تفعيل اشتراك «${s.planTitle}» (${s.cycle === 'yearly' ? 'سنوي' : 'شهري'}) في منصة التزام التدريب.\nالاسم: ${S.user?.name || ''}\nالبريد: ${S.user?.email || ''}\nالمبلغ: ${money(s.amountSAR)}`;

  function adminPanel() {
    const a = R.admin, tabs = [['subs', tr('الاشتراكات', 'Subscriptions')], ['bookings', tr('الحجوزات', 'Bookings')], ['links', tr('الروابط', 'Links')], ['notes', tr('سجل الإشعارات', 'Notifications')]];
    let body = `<p class="muted">${tr('جارٍ التحميل…', 'Loading…')}</p>`;
    if (a) {
      const none = `<p class="muted">${tr('لا يوجد شيء هنا بعد.', 'Nothing here yet.')}</p>`;
      body = {
        subs: () => a.subs.map(s => `<div class="row"><div class="grow"><strong>${esc(s.name)}</strong> — ${esc(s.planTitle)} (${s.cycle === 'yearly' ? tr('سنوي', 'Yearly') : tr('شهري', 'Monthly')})<div class="small muted" dir="ltr" style="text-align:start">${esc(s.email)} · ${esc(s.phone || '')} · ${s.amountSAR} SAR</div></div>
          <span class="status ${esc(s.status)}">${statusText(s.status)}</span><button class="btn primary sm" data-act="adm-activate" data-id="${esc(s.id)}">${s.status === 'active' ? tr('تمديد', 'Extend') : tr('تفعيل', 'Activate')}</button></div>`),
        bookings: () => a.bookings.map(b => `<div class="row"><div class="grow"><strong>${esc(b.name)}</strong> — ${esc(b.courseTitle)}<div class="small muted">${esc(b.date)} ${esc(b.time)} · ${b.minutes} ${tr('دقيقة', 'min')} · ${b.priceSAR} SAR · <span dir="ltr">${esc(b.phone)}</span></div>${b.notes ? `<p class="small">${esc(b.notes)}</p>` : ''}</div>
          <span class="status ${esc(b.status)}">${statusText(b.status)}</span><select class="pick" id="tr-${esc(b.id)}" aria-label="${tr('المدرب', 'Trainer')}"><option value="">${tr('— المدرب —', '— Trainer —')}</option>${a.users.filter(u => STAFF.includes(u.role)).map(u => `<option value="${esc(u.email)}" ${u.email === b.trainerEmail ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>
          <button class="btn primary sm" data-act="adm-booking" data-id="${esc(b.id)}" data-s="confirmed">${tr('تأكيد', 'Confirm')}</button>${b.settled ? '' : `<button class="btn gold sm" data-act="adm-booking" data-id="${esc(b.id)}" data-s="done">${tr('تمت واحتسب العمولة', 'Done & settle')}</button>`}<button class="btn danger sm" data-act="adm-booking" data-id="${esc(b.id)}" data-s="cancelled">${tr('إلغاء', 'Cancel')}</button></div>`),
        links: () => R.links.map(l => `<div class="row"><div class="grow"><strong>${esc(l.title)}</strong><div class="small muted" dir="ltr" style="text-align:start">${esc(l.url)} · ${esc(l.owner)}</div></div>
          <span class="status ${l.approved ? 'active' : 'pending'}">${l.approved ? tr('معتمد', 'Approved') : tr('خاص بصاحبه', 'Private')}</span><button class="btn primary sm" data-act="adm-link" data-id="${esc(l.id)}" data-s="${l.approved ? '' : '1'}">${l.approved ? tr('إلغاء الاعتماد', 'Unapprove') : tr('اعتماد للجميع', 'Approve')}</button></div>`),
        notes: () => a.notes.map(n => `<div class="row"><div class="grow"><strong>${esc(n.title)}</strong><div class="small muted">${new Date(n.at).toLocaleString(S.lang === 'en' ? 'en' : 'ar-EG')}</div><p class="small">${esc(Object.entries(n.data).map(([k, v]) => `${k}: ${v}`).join(' · '))}</p></div></div>`)
      }[R.adminTab]().join('') || none;
    }
    return `<h2 style="margin-block-start:40px">${tr('لوحة المدير', 'Admin panel')}</h2>
      <div class="tabs">${tabs.map(([k, l]) => `<button class="pill" data-act="adm-tab" data-id="${k}" aria-pressed="${R.adminTab === k}">${l}</button>`).join('')}</div><div class="rows">${body}</div>`;
  }
  async function loadAdmin() {
    try {
      const [o, s, b, m] = await Promise.all([api('auth-rbac?action=admin'), api('subscription-manager?action=all'), api('booking-engine'), api('admin-users')]);
      R.adm = m;
      R.admin = { users: m.users, notes: o.notifications, subs: s.subscriptions, bookings: b.bookings };
    } catch (e) { toast(e.message); R.admin = { users: [], notes: [], subs: [], bookings: [] }; }
    if (['account', 'admin'].includes(route().name)) render();
  }

  /* ---------- صفحة إدارة المستخدمين (مدير النظام) ---------- */
  const PERM = () => ({ 'content.add': tr('إضافة محتوى (فيديو/ملفات/مقالات)', 'Add content'), 'lessons.add': tr('إضافة دروس للدبلومات', 'Add diploma lessons'), 'links.approve': tr('اعتماد روابط المتدربين', 'Approve links'),
    'bookings.manage': tr('إدارة الحجوزات والجلسات', 'Manage bookings'), 'subs.manage': tr('تفعيل الاشتراكات', 'Activate subscriptions'), 'paid.access': tr('دخول مجاني لكل الدبلومات', 'Free access to diplomas') });
  const ROLE = () => ({ trainee: tr('متدرب', 'Trainee'), instructor: tr('مدرب', 'Trainer'), teacher: tr('مدرّس', 'Teacher'), contractor_b2b: tr('مقاول B2B', 'Contractor') });
  const sar = n => `${(+n || 0).toLocaleString('en')} ${tr('ر.س', 'SAR')}`;
  const ledgerRow = e => `<div class="row"><div class="grow">${esc(e.note)}<div class="small muted">${new Date(e.at).toLocaleString(S.lang === 'en' ? 'en' : 'ar-EG')}${e.account && R.adm && route().name === 'admin' ? ` · <span dir="ltr">${esc(e.account)}</span>` : ''}</div></div>
    <strong dir="ltr" style="color:var(--${e.type === 'payment' ? 'muted' : e.amountSAR < 0 ? 'danger' : 'ok'})">${e.type === 'payment' ? '' : e.amountSAR > 0 ? '+' : ''}${e.amountSAR.toLocaleString('en')}</strong></div>`;
  function adminPage() {
    if (S.user?.role !== 'admin') return `<div class="wrap page"><div class="empty">${tr('هذه الصفحة لمدير النظام فقط.', 'Admins only.')}<br><a class="btn soft sm" href="#/account">${tr('حسابي', 'Account')}</a></div></div>`;
    const m = R.adm;
    if (!m) return `<div class="wrap page"><h1>${tr('إدارة المستخدمين', 'User management')}</h1><p class="muted">${tr('جارٍ التحميل…', 'Loading…')}</p></div>`;
    const q = (R.uq || '').toLowerCase(), list = m.users.filter(u => (!R.urole || u.role === R.urole) && (!q || (u.name + u.email + u.phone).toLowerCase().includes(q)));
    return `<div class="wrap page"><h1>${tr('إدارة المستخدمين', 'User management')}</h1>
      <p class="muted">${tr('أنت مدير النظام: تملك كل الصلاحيات وتوزعها على المدربين والمتدربين، وتحدد نسبة المنصة.', 'You are the system admin: you hold all permissions and delegate them.')}</p>
      <div class="kpis" style="margin-block:24px">
        <div class="kpi"><b>${m.users.length}</b><span>${tr('عضو', 'Members')}</span></div>
        <div class="kpi"><b>${m.users.filter(u => STAFF.includes(u.role)).length}</b><span>${tr('مدرب ومدرّس', 'Trainers')}</span></div>
        <div class="kpi"><b>${m.users.filter(u => u.sub?.status === 'active').length}</b><span>${tr('اشتراك فعّال', 'Active subscriptions')}</span></div>
        <div class="kpi"><b>${sar(m.platform)}</b><span>${tr('محفظة المنصة (نسبتك)', 'Platform wallet')}</span></div>
        <div class="kpi"><b>${sar(m.pool)}</b><span>${tr('رصيد المدربين غير الموزّع', 'Undistributed trainer pool')}</span></div></div>
      <div class="two" style="margin:0">
        <form class="panel f" style="margin:0" data-form="commission" novalidate><h2>${tr('نسبة المنصة (العمولة)', 'Platform commission')}</h2>
          <div class="cols"><label>${tr('من اشتراكات المتدربين %', 'From trainee subscriptions %')}<input name="commissionTrainee" type="number" min="0" max="100" value="${m.settings.commissionTrainee}"></label>
          <label>${tr('من جلسات المدربين %', 'From trainer sessions %')}<input name="commissionTrainer" type="number" min="0" max="100" value="${m.settings.commissionTrainer}"></label></div>
          <p class="small muted">${tr('تُطبَّق على كل اشتراك تفعّله وكل جلسة تُعلَّم «تمت». الباقي يذهب لمحفظة المدرب أو لرصيد المدربين.', 'Applied on each activated subscription and each completed session.')}</p>
          <p class="err" role="alert"></p><button class="btn primary sm">${tr('حفظ النسب', 'Save rates')}</button></form>
        <section class="panel" style="margin:0"><h2>${tr('آخر الحركات المالية', 'Recent transactions')}</h2>
          <div class="rows" style="margin:0;max-height:260px;overflow:auto">${m.ledger.length ? m.ledger.slice(0, 30).map(ledgerRow).join('') : `<p class="muted">${tr('لا توجد حركات بعد.', 'No transactions yet.')}</p>`}</div>
          <div class="tabs"><button class="btn soft sm" data-act="u-wallet" data-id="trainers_pool">${tr('توزيع / صرف من رصيد المدربين', 'Distribute trainer pool')}</button></div></section>
      </div>
      <div class="tabs" style="align-items:center">
        <button class="btn gold sm" data-act="u-create">${tr('+ أضف مستخدماً', '+ Add user')}</button>
        <input class="pick" id="uq" type="search" placeholder="${tr('ابحث بالاسم أو البريد…', 'Search name or email…')}" value="${esc(R.uq || '')}" style="flex:1;min-width:180px;font-weight:400">
        <select class="pick" data-change="u-filter" aria-label="${tr('تصفية بالدور', 'Filter by role')}"><option value="">${tr('كل الأدوار', 'All roles')}</option>${Object.entries(ROLE()).map(([k, v]) => `<option value="${k}" ${R.urole === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="rows">${list.length ? list.map(u => `<div class="row"><div class="grow"><strong>${esc(u.name)}</strong> <span class="badge mine">${ROLE()[u.role] || esc(u.role)}</span>
          ${u.suspended ? `<span class="status expired">${tr('موقوف', 'Suspended')}</span>` : ''}${u.requestedRole ? `<span class="status pending">${tr('يطلب', 'Requests')}: ${ROLE()[u.requestedRole]}</span>` : ''}${u.sub ? `<span class="status ${esc(u.sub.status)}">${esc(u.sub.planTitle)} · ${statusText(u.sub.status)}</span>` : ''}
          <div class="small muted" dir="ltr" style="text-align:start">${esc(u.email)}${u.phone ? ' · ' + esc(u.phone) : ''}</div>
          <div class="small muted">${tr('الصلاحيات', 'Permissions')}: ${u.perms.length ? u.perms.map(p => PERM()[p]).join('، ') : tr('أساسية فقط', 'basic only')}${u.customPerms ? ` (${tr('مخصصة', 'custom')})` : ''} · ${tr('المحفظة', 'Wallet')}: ${sar(u.balance)} · ${tr('دفع', 'Paid')}: ${sar(u.paid)}</div></div>
        <div class="acts">${u.requestedRole ? `<button class="btn gold sm" data-act="u-role" data-id="${esc(u.email)}" data-s="${esc(u.requestedRole)}">${tr('اعتماد الطلب', 'Approve')}</button>` : ''}
          <select class="pick" data-change="u-role" data-id="${esc(u.email)}" aria-label="${tr('الدور', 'Role')}">${Object.entries(ROLE()).map(([k, v]) => `<option value="${k}" ${k === u.role ? 'selected' : ''}>${v}</option>`).join('')}</select>
          <button class="btn soft sm" data-act="u-perms" data-id="${esc(u.email)}">${tr('الصلاحيات', 'Permissions')}</button>
          <button class="btn soft sm" data-act="u-sub" data-id="${esc(u.email)}">${tr('منح اشتراك', 'Grant plan')}</button>
          <button class="btn soft sm" data-act="u-wallet" data-id="${esc(u.email)}">${tr('المحفظة', 'Wallet')}</button>
          <button class="btn soft sm" data-act="u-suspend" data-id="${esc(u.email)}" data-s="${u.suspended ? '' : '1'}">${u.suspended ? tr('إعادة تفعيل', 'Reactivate') : tr('إيقاف', 'Suspend')}</button>
          <button class="btn danger sm" data-act="u-delete" data-id="${esc(u.email)}">${tr('حذف', 'Delete')}</button></div></div>`).join('') : `<div class="empty">${tr('لا يوجد مستخدمون مطابقون.', 'No matching users.')}</div>`}</div></div>`;
  }
  const admUser = email => R.adm?.users.find(u => u.email === email);
  async function admDo(path, body, msg) { try { await api('admin-users?action=' + path, body); if (msg) toast(msg); if (modal.open) modal.close(); await loadAdmin(); refresh(); } catch (e) { toast(e.message); } }

  const settingsPage = () => `<div class="wrap page"><h1>${tr('الإعدادات', 'Settings')}</h1>
    <div class="two">
      <section class="panel" style="margin:0"><h2>${tr('العرض', 'Display')}</h2><div class="stack">
        <button class="btn soft" data-act="lang">${tr('اللغة: العربية — التبديل إلى English', 'Language: English — switch to العربية')}</button>
        <button class="btn soft" data-act="theme">${tr('تبديل الوضع الليلي / النهاري', 'Toggle dark / light mode')}</button>
        <p class="small muted">${tr('العملة تُغيَّر من الشريط العلوي (SAR / EGP / USD).', 'Change currency from the top bar.')}</p></div></section>
      <section class="panel" style="margin:0"><h2>${tr('بياناتي', 'My data')}</h2><div class="stack">
        <button class="btn soft" data-act="export">${tr('تصدير خطتي ومراجعاتي (JSON)', 'Export my data (JSON)')}</button>
        <button class="btn danger" data-act="reset">${tr('مسح بيانات هذا الجهاز', 'Clear data on this device')}</button></div></section>
      <section class="panel" style="margin:0"><h2>${tr('التواصل والدعم', 'Contact')}</h2><div class="stack">
        <a class="btn gold" target="_blank" rel="noopener" href="${waLink('مرحباً، لدي استفسار عن منصة التزام التدريب.')}">${tr('تواصل عبر واتساب', 'Chat on WhatsApp')}</a>
        <a class="btn line" target="_blank" rel="noopener" href="${SEED.channel}">Alpha Media ↗</a></div></section>
    </div></div>`;

  function verifyPage(code) {
    setTimeout(async () => {
      const box = $('#verifyBox'); if (!box) return;
      let d;
      try { d = await api('verify-certificate?code=' + encodeURIComponent(code)); } catch (e) { d = e.status === 404 ? { valid: false } : { error: e.message }; }
      box.innerHTML = d.error ? `<div class="seal">⚠️</div><h2>${esc(d.error)}</h2>`
        : d.valid ? `<div class="seal">✅</div><h2>${tr('شهادة صحيحة وموثقة', 'Valid certificate')}</h2><p><strong>${esc(d.name)}</strong></p><p>${esc(d.courseTitle)}</p><p class="small muted">${tr('تاريخ الإصدار', 'Issued')}: ${new Date(d.issuedAt).toLocaleDateString(S.lang === 'en' ? 'en' : 'ar-EG')} · <span dir="ltr">${esc(d.code)}</span></p>`
        : `<div class="seal">❌</div><h2>${tr('رمز الشهادة غير موجود', 'Certificate not found')}</h2><p class="muted" dir="ltr">${esc(code)}</p>`;
    });
    return `<div class="wrap page"><div class="panel verify" id="verifyBox"><p class="muted">${tr('جارٍ التحقق من الشهادة…', 'Verifying…')}</p></div></div>`;
  }

  /* ---------- التوجيه ---------- */
  function route() { const [name = '', arg = ''] = location.hash.replace(/^#\/?/, '').split('/'); return { name: name || (S.user ? 'home' : 'welcome'), arg: decodeURIComponent(arg) }; }
  function render() {
    const { name, arg } = route(), searching = !!R.q;
    const views = {
      home: () => (searching ? '' : hero()) + filters() + freeSec() + (searching ? '' : creator()) + paidSec() + pathsSec() + (searching ? '' : platformsSec() + pricingSec()),
      free: () => filters() + freeSec() + creator(),
      paid: () => filters() + paidSec() + pricingSec(),
      paths: () => filters() + pathsSec() + creator(),
      welcome: welcomePage, library: libraryPage, trainers: trainersPage, admin: adminPage,
      platforms: platformsSec, pricing: pricingSec, plan: planPage, reviews: reviewsPage, account: accountPage, settings: settingsPage,
      course: () => coursePage(arg), verify: () => verifyPage(arg)
    };
    document.body.classList.toggle('on-welcome', name === 'welcome');
    $('#main').innerHTML = (views[name] || views.home)();
    $$('[data-nav]').forEach(a => a.dataset.nav === name ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
    badge();
    $$('[data-admin]').forEach(a => { a.hidden = S.user?.role !== 'admin'; });
    if (['account', 'admin'].includes(name) && S.user?.role === 'admin' && !R.admin) loadAdmin();
    if (name === 'account' && S.user && ONLINE && !R.wallet && !R.walletBusy) { R.walletBusy = true; api('admin-users?action=wallet').then(w => { R.wallet = w; if (route().name === 'account') render(); }).catch(() => {}).finally(() => { R.walletBusy = false; }); }
  }
  window.addEventListener('hashchange', () => { if (route().name !== 'course') R.playing = null; render(); window.scrollTo(0, 0); $('#main').focus({ preventScroll: true }); });

  /* ---------- النوافذ والنماذج ---------- */
  const modal = $('#modal');
  function openModal(h, html) {
    $('#modalBody').innerHTML = `<div class="m-head"><h2 id="modalTitle">${h}</h2><button class="x" data-act="close" aria-label="${tr('إغلاق', 'Close')}">✕</button></div>${html}`;
    if (!modal.open) modal.showModal();
  }
  modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });
  const catOptions = sel => SEED.categories.filter(c => c.id !== 'all').map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(tr(c.ar, c.en))}</option>`).join('');
  const courseOptions = sel => [...freeAll(), ...paidAll()].map(c => `<option value="${esc(c.id)}" ${c.id === sel ? 'selected' : ''}>${esc(title(c))}</option>`).join('');

  let afterAuth = null;
  function authModal(mode = 'login', role = 'trainee') {
    const reg = mode === 'register';
    openModal(reg ? tr('إنشاء حساب', 'Create account') : tr('تسجيل الدخول', 'Log in'), `
      ${ONLINE ? '' : `<p class="note">${tr('التسجيل والاشتراك يعملان بعد نشر الموقع على Netlify. حالياً تُحفظ بياناتك على هذا الجهاز.', 'Sign-up works once deployed.')}</p>`}
      <form class="f" data-form="auth" data-mode="${mode}" novalidate>
        ${reg ? `<label>${tr('الاسم الكامل', 'Full name')}<input name="name" required maxlength="80" autocomplete="name"></label>` : ''}
        <label>${tr('البريد الإلكتروني', 'Email')}<input name="email" type="email" required dir="ltr" autocomplete="email"></label>
        ${reg ? `<label>${tr('رقم الجوال (واتساب)', 'Mobile (WhatsApp)')}<input name="phone" type="tel" dir="ltr" autocomplete="tel" placeholder="+9665…"></label>` : ''}
        <label>${tr('كلمة المرور', 'Password')}<input name="password" type="password" required minlength="8" dir="ltr" autocomplete="${reg ? 'new-password' : 'current-password'}"></label>
        ${reg ? `<label>${tr('نوع الحساب', 'Account type')}<select name="role">
          <option value="trainee" ${role === 'trainee' ? 'selected' : ''}>${tr('متدرب', 'Trainee')}</option>
          <option value="instructor" ${role === 'instructor' ? 'selected' : ''}>${tr('مدرب / محاضر (يحتاج اعتماد المدير)', 'Trainer (needs approval)')}</option>
          <option value="teacher" ${role === 'teacher' ? 'selected' : ''}>${tr('مدرّس لغات / تأسيس (يحتاج اعتماد المدير)', 'Teacher (needs approval)')}</option>
          <option value="contractor_b2b" ${role === 'contractor_b2b' ? 'selected' : ''}>${tr('مقاول / شركة B2B', 'Contractor / B2B')}</option></select></label>
          <label>${tr('التخصص (للمدربين والمدرسين)', 'Specialty (trainers)')}<input name="specialty" maxlength="120"></label>
          <label>${tr('اسم الشركة (للمقاولين)', 'Company (contractors)')}<input name="company" maxlength="120"></label>` : ''}
        <p class="err" role="alert"></p>
        <button class="btn primary">${reg ? tr('إنشاء الحساب', 'Create account') : tr('دخول', 'Log in')}</button>
        <button type="button" class="btn soft" data-act="auth" data-id="${reg ? 'login' : 'register'}">${reg ? tr('لدي حساب بالفعل', 'I have an account') : tr('حساب جديد', 'New account')}</button>
      </form>`);
  }
  function linkModal(pathId = '') {
    openModal(tr('أضف رابطاً أو خطوة في مسار', 'Add a link or path step'), `<form class="f" data-form="link" novalidate>
      <label>${tr('الرابط (يوتيوب أو أي موقع)', 'URL (YouTube or any site)')}<input name="url" type="url" required dir="ltr" placeholder="https://www.youtube.com/watch?v=…"></label>
      <label>${tr('العنوان', 'Title')}<input name="title" required maxlength="140"></label>
      <div class="cols"><label>${tr('التخصص', 'Category')}<select name="cat">${catOptions(R.cat === 'all' ? 'ai' : R.cat)}</select></label>
      <label>${tr('أين يُضاف؟', 'Add as')}<select name="pathId"><option value="">${tr('بطاقة كورس مجاني', 'Free course card')}</option>${SEED.paths.map(p => `<option value="${p.id}" ${p.id === pathId ? 'selected' : ''}>${tr('خطوة في', 'Step in')}: ${esc(title(p))}</option>`).join('')}</select></label></div>
      <label>${tr('وصف مختصر (اختياري)', 'Short description (optional)')}<textarea name="desc" maxlength="400"></textarea></label>
      <p class="small muted">${S.user ? tr('يُحفظ الرابط في حسابك ويظهر لك فوراً، ويظهر لبقية المتدربين بعد اعتماد المدير.', 'Saved to your account; visible to others after admin approval.') : tr('يُحفظ الرابط على هذا الجهاز. سجّل الدخول لحفظه سحابياً.', 'Saved on this device. Log in to sync.')}</p>
      <p class="err" role="alert"></p><button class="btn gold">${tr('أضف الآن', 'Add now')}</button></form>`);
  }
  function contentModal(courseId = '') {
    openModal(tr('أضف محتوى علمياً', 'Add content'), `<form class="f" data-form="content" novalidate>
      <div class="cols"><label>${tr('النوع', 'Type')}<select name="type">${Object.entries(CT()).map(([k, v]) => `<option value="${k}">${v[1]} ${v[0]}</option>`).join('')}</select></label>
      <label>${tr('الإتاحة', 'Access')}<select name="access"><option value="free">${tr('مجاني للجميع', 'Free')}</option><option value="paid">${tr('للمشتركين فقط', 'Subscribers only')}</option></select></label></div>
      <label>${tr('العنوان', 'Title')}<input name="title" required maxlength="140"></label>
      <label>${tr('وصف مختصر', 'Short description')}<textarea name="desc" maxlength="600" style="min-height:64px"></textarea></label>
      <div class="cols"><label>${tr('التخصص', 'Category')}<select name="cat">${catOptions(R.cat === 'all' ? 'sec' : R.cat)}</select></label>
      <label>${tr('ربطه بكورس (اختياري)', 'Attach to course (optional)')}<select name="courseId"><option value="">${tr('بدون — مكتبة المحتوى فقط', 'None')}</option>${courseOptions(courseId)}</select></label></div>
      <label>${tr('رابط (يوتيوب، Google Drive، أو أي موقع)', 'URL (YouTube, Drive or any site)')}<input name="url" type="url" dir="ltr" placeholder="https://"></label>
      <label>${tr('أو ارفع ملفاً (PDF، Excel، DWG، فيديو قصير… حتى 4 ميجابايت)', 'Or upload a file (up to 4 MB)')}<input name="file" type="file"></label>
      <label>${tr('نص المقال (لنوع «مقال»)', 'Article text (for “Article”)')}<textarea name="body" maxlength="20000"></textarea></label>
      <p class="small muted">${tr('الفيديوهات الطويلة: ارفعها على يوتيوب (غير مدرج) أو Google Drive وألصق الرابط هنا.', 'For long videos, upload to YouTube (unlisted) or Drive and paste the link.')}</p>
      <p class="err" role="alert"></p><button class="btn gold">${tr('نشر المحتوى', 'Publish')}</button></form>`);
  }
  async function openContent(x) {
    if (x.locked) return subscribe('all-access');
    if (x.type === 'article') return openModal(esc(x.title), `<p style="white-space:pre-wrap">${esc(x.body)}</p>`);
    if (x.hasFile) {
      toast(tr('جارٍ التحميل…', 'Loading…'));
      const blob = await apiBlob('content-library?action=file&id=' + encodeURIComponent(x.id)), u = URL.createObjectURL(blob);
      if (x.type === 'video' || /^video\//.test(x.mime)) return openModal(esc(x.title), `<video controls autoplay src="${u}" style="width:100%;border-radius:14px;background:#000"></video>`);
      const a = document.createElement('a'); a.href = u; a.download = x.fileName; document.body.append(a); a.click(); a.remove(); return;
    }
    const y = embed(ytParse(x.url));
    if (y) return openModal(esc(x.title), `<div class="frame" style="position:relative;aspect-ratio:16/9"><iframe src="${y}" title="${esc(x.title)}" style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:14px" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`);
    const u = safeUrl(x.url); if (u) window.open(u, '_blank', 'noopener');
  }
  function bookModal(id) {
    const c = course(id), today = new Date().toISOString().slice(0, 10);
    openModal(tr('احجز جلسة استشارية', 'Book a consultation'), `<form class="f" data-form="book" data-id="${esc(id || '')}" novalidate>
      <p class="note">${esc(c ? title(c) : tr('استشارة عامة', 'General consultation'))}<br>${tr('السعر', 'Rate')}: ${money(SEED.hourlyRateSAR)} / ${tr('ساعة — يُحسب بالدقيقة. خصم 20% للمشتركين.', 'hour, billed per minute. 20% off for subscribers.')}</p>
      <div class="cols"><label>${tr('الاسم', 'Name')}<input name="name" required value="${esc(S.user?.name || '')}"></label>
      <label>${tr('رقم الجوال (واتساب)', 'Mobile (WhatsApp)')}<input name="phone" type="tel" required dir="ltr" value="${esc(S.user?.phone || '')}"></label></div>
      <div class="cols"><label>${tr('التاريخ', 'Date')}<input name="date" type="date" required min="${today}"></label>
      <label>${tr('الوقت', 'Time')}<input name="time" type="time" required></label>
      <label>${tr('المدة', 'Duration')}<select name="minutes">${[15, 30, 45, 60, 90, 120].map(m => `<option value="${m}" ${m === 60 ? 'selected' : ''}>${m} ${tr('دقيقة', 'min')} — ${money(SEED.hourlyRateSAR / 60 * m)}</option>`).join('')}</select></label></div>
      <label>${tr('ما الذي تريد مناقشته؟', 'What would you like to discuss?')}<textarea name="notes" maxlength="600"></textarea></label>
      <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <p class="err" role="alert"></p><button class="btn gold">${tr('أكّد الحجز', 'Confirm booking')}</button></form>`);
  }
  function reviewModal(id, rid) {
    const r = S.reviews.find(x => x.id === rid) || { rating: 5, text: '', courseId: id };
    openModal(tr('قيّم الكورس', 'Review course'), `<form class="f" data-form="review" data-rid="${esc(rid || '')}" novalidate>
      <label>${tr('الكورس', 'Course')}<select name="courseId">${courseOptions(r.courseId)}</select></label>
      <label>${tr('التقييم', 'Rating')}<select name="rating">${[5, 4, 3, 2, 1].map(n => `<option value="${n}" ${n === r.rating ? 'selected' : ''}>${'★'.repeat(n)} (${n}/5)</option>`).join('')}</select></label>
      <label>${tr('ملاحظاتك', 'Your notes')}<textarea name="text" required maxlength="1000">${esc(r.text)}</textarea></label>
      <p class="err" role="alert"></p><button class="btn gold">${tr('حفظ المراجعة', 'Save review')}</button></form>`);
  }
  const egpOf = sar => Math.ceil(sar * SEED.rates.EGP).toLocaleString('en') + ' ' + tr('ج.م', 'EGP');
  function payButtons(sub) {
    const m = R.methods, any = m.mada || m.applepay || m.vodafone;
    if (!ONLINE || !S.user || !sub?.id || !sub.amountSAR || !any) return '';
    return `<div class="stack" style="margin-block-end:12px"><strong>${tr('ادفع إلكترونياً', 'Pay online')}</strong>
      ${m.mada || m.applepay ? `<button class="btn start block" data-act="pay" data-id="mada">${tr('مدى / Apple Pay / بطاقة', 'mada / Apple Pay / card')} — ${sar(sub.amountSAR)}</button>` : ''}
      ${m.vodafone ? `<button class="btn block" style="background:#e60000;color:#fff" data-act="pay" data-id="vodafone">${tr('فودافون كاش', 'Vodafone Cash')} — ${egpOf(sub.amountSAR)}</button>` : ''}
      <p class="small muted">${tr('تتم عملية الدفع على صفحة آمنة عند مزوّد الدفع، ولا تُحفظ بيانات بطاقتك لدينا. يُفعَّل اشتراكك تلقائياً فور نجاح الدفع.', 'Payment is made on the provider’s secure page. Your plan activates automatically once it succeeds.')}</p></div>`;
  }
  function subDone(sub) {
    openModal(tr('تم تسجيل طلب الاشتراك', 'Subscription request received'), `<p>${tr('طلبك الآن', 'Your request is')} <span class="status ${esc(sub.status)}">${statusText(sub.status)}</span>. ${tr('أكمل الدفع عبر واتساب وسيُفعَّل اشتراكك فور التأكيد.', 'Complete payment on WhatsApp and it will be activated once confirmed.')}</p>
      <div class="stack" style="margin-block-start:16px">${payButtons(sub)}<a class="btn ${payButtons(sub) ? 'soft' : 'gold'} block" target="_blank" rel="noopener" href="${waLink(subMsg(sub))}">${tr('أو أكمل الدفع عبر واتساب', 'Or pay via WhatsApp')}</a><button class="btn soft block" data-act="close">${tr('لاحقاً', 'Later')}</button></div>`);
  }
  async function subscribe(planId) {
    const plan = SEED.plans.find(p => p.id === planId); if (!plan) return;
    if (S.sub?.id && S.sub.plan === planId && ['active', 'pending', 'renewal_due'].includes(S.sub.status)) { location.hash = '#/account'; return; }
    const amountSAR = R.cycle === 'yearly' ? plan.monthlySAR * 10 : plan.monthlySAR;
    if (!ONLINE) return subDone({ planTitle: plan.title, cycle: R.cycle, amountSAR, status: 'pending' });
    if (!S.user) { afterAuth = () => subscribe(planId); toast(tr('أنشئ حساباً أولاً لربط الاشتراك به.', 'Create an account first.')); return authModal('register', plan.role); }
    try {
      const d = await api('subscription-manager?action=subscribe', { plan: planId, cycle: R.cycle, currency: S.currency });
      S.sub = d.subscription; save(false); addNotif(tr(`طلب اشتراك «${plan.title}» بانتظار التفعيل.`, `Subscription "${plan.titleEn}" pending.`)); render(); subDone(S.sub);
    } catch (e) { toast(e.message); }
  }
  function certModal(c) {
    const url = `${location.origin}/verify/${c.code}`;
    openModal(tr('شهادة إتمام', 'Certificate of completion'), `<div class="cert"><span class="badge paid">${tr('التزام التدريب+', 'Iltizam Training+')}</span>
      <h3>${esc(c.name)}</h3><p>${tr('أتمّ بنجاح', 'has completed')}: <strong>${esc(c.courseTitle)}</strong></p>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}" alt="${tr('رمز QR للتحقق من الشهادة', 'Verification QR code')}">
      <code>${esc(c.code)}</code><a class="small" href="${esc(url)}" dir="ltr">${esc(url)}</a></div>`);
  }

  /* ملفات العمل القابلة للتحميل */
  const csv = rows => '﻿' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const FILES = {
    prompts: ['claude-dashboard-prompts.txt', 'text/plain', () => ['أوامر Claude لبناء لوحة تحكم مشروع — التزام التدريب', '',
      '1) أنشئ لوحة تحكم HTML/CSS/JS في ملف واحد لإدارة أوامر العمل. الأعمدة: رقم الأمر، الموقع، الفني، الحالة، تاريخ الاستلام، تاريخ الإقفال. أضف فلترة بالحالة وبحثاً نصياً.',
      '2) اقرأ ملف CSV المرفق واعرض مؤشرات: عدد الأوامر المفتوحة، نسبة الإنجاز، متوسط زمن الإقفال، وأعلى 5 فنيين إنجازاً.',
      '3) أضف رسماً بيانياً شريطياً للإنجاز اليومي خلال آخر 7 أيام بدون مكتبات خارجية.',
      '4) اجعل الواجهة عربية RTL ومتجاوبة من 360px، مع وضع ليلي.',
      '5) جهّز المشروع للنشر على Netlify: أضف netlify.toml واحفظ نسخة على GitHub.', '', 'Project manager  Eng  Ahmed Zahran'].join('\r\n')],
    workorders: ['work-orders.csv', 'text/csv', () => csv([['رقم أمر العمل', 'الموقع', 'نوع العمل', 'الفني المسؤول', 'الحالة', 'تاريخ الاستلام', 'تاريخ الإقفال', 'ملاحظات'], ['WO-0001', '', 'توصيل عداد', '', 'مفتوح', '', '', '']])],
    boq: ['boq-template.csv', 'text/csv', () => csv([['م', 'البند', 'الوصف', 'الوحدة', 'الكمية', 'سعر الوحدة', 'الإجمالي'], [1, 'كابل ألمنيوم 4×300 مم²', 'توريد وتمديد', 'متر', '', '', ''], [2, 'حفر وردم', 'عرض 60 سم وعمق 90 سم', 'متر', '', '', ''], [3, 'محول توزيع', 'توريد وتركيب', 'عدد', '', '', '']])],
    invoice: ['monthly-invoice.csv', 'text/csv', () => csv([['م', 'رقم أمر العمل', 'البند', 'الوحدة', 'الكمية المنفذة', 'سعر الوحدة', 'القيمة', 'نسبة الصرف', 'المستحق'], [1, '', '', '', '', '', '', '100%', ''], ['', '', '', '', '', '', 'الإجمالي', '', ''], ['', '', '', '', '', '', 'ضريبة القيمة المضافة 15%', '', ''], ['', '', '', '', '', '', 'الصافي', '', '']])],
    testreport: ['cable-insulation-test.csv', 'text/csv', () => csv([['الدائرة', 'نوع الكابل', 'الطول (م)', 'جهد الاختبار (kV)', 'R-E (MΩ)', 'Y-E (MΩ)', 'B-E (MΩ)', 'R-Y (MΩ)', 'Y-B (MΩ)', 'B-R (MΩ)', 'النتيجة', 'المختبِر', 'التاريخ']])],
    safety: ['daily-safety-checklist.csv', 'text/csv', () => csv([['م', 'بند الفحص', 'مطابق', 'غير مطابق', 'ملاحظات'], ...['تصريح العمل ساري ومعتمد', 'العزل والتأريض منفذان', 'معدات الوقاية الشخصية مكتملة', 'حواجز ولوحات تحذيرية حول الموقع', 'طفاية حريق وحقيبة إسعافات متوفرة', 'اجتماع السلامة الصباحي تم'].map((t, i) => [i + 1, t, '', '', ''])])],
    letters: ['formal-letters-templates.txt', 'text/plain', () => ['Formal letter templates — Iltizam Training', '', '1) Request for Information (RFI)', 'Subject: RFI No. __ – [Item]', 'Dear Sir, With reference to the above subject, kindly clarify … Your prompt response is appreciated to avoid any delay to the programme.', '',
      '2) Extension of Time notice', 'Subject: Notice of Delay – [Work Order No.]', 'We hereby notify you that the works have been delayed due to … We reserve our right to an extension of time under the Contract.', '',
      '3) Payment follow-up', 'Subject: Outstanding Payment – Invoice No. __', 'Please be advised that the above invoice dated __ remains unpaid. We kindly request settlement at your earliest convenience.'].join('\r\n')]
  };
  function download(name, mime, content) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type: mime + ';charset=utf-8' })); a.download = name;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ---------- المساعد السريع ---------- */
  const FAQ = () => [
    [tr('كيف أبدأ مجاناً؟', 'How do I start free?'), tr('افتح «المكتبة المجانية»، اختر تخصصك من الفلاتر، واضغط «ابدأ التعلم». أضف الكورس إلى «خطتي» لتتابع تقدمك.', 'Open the free library, pick a category and press Start.')],
    [tr('كيف أشترك في الدبلومات؟', 'How do I subscribe?'), tr('من «الباقات» اختر الاشتراك الشامل، سجّل حسابك، ثم أكمل الدفع عبر واتساب ويُفعَّل اشتراكك بعد التأكيد.', 'Choose All-Access in Plans, sign up, then pay via WhatsApp.')],
    [tr('كيف أحصل على الشهادة؟', 'How do I get a certificate?'), tr('أكمل جميع دروس الكورس وأنت مسجّل الدخول، ثم اضغط «احصل على الشهادة». تصدر برمز QR يمكن التحقق منه.', 'Finish all lessons while logged in, then press Get certificate.')],
    [tr('كيف أضيف رابطاً خاصاً بي؟', 'How do I add my own link?'), tr('اضغط «+ أضف رابط» في الأعلى، الصق الرابط واختر التخصص أو المسار.', 'Press “+ Add link”, paste the URL and choose a category or path.')],
    [tr('هل يمكن حجز جلسة مع المحاضر؟', 'Can I book the instructor?'), tr('نعم، من صفحة أي كورس اضغط «احجز جلسة استشارية» واختر الموعد والمدة.', 'Yes — from any course page press Book a consultation.')]
  ];
  function assistant(answer) {
    const el = $('#assistant');
    el.innerHTML = `<div class="m-head" style="margin:0"><h3>${tr('المساعد السريع', 'Quick assistant')}</h3><button class="x" data-act="assistant" aria-label="${tr('إغلاق', 'Close')}">✕</button></div>
      <div class="answer">${answer || tr('أهلاً بك! اختر سؤالاً أو تواصل معنا مباشرة عبر واتساب.', 'Hi! Pick a question or chat with us on WhatsApp.')}</div>
      <div class="qs">${FAQ().map((f, i) => `<button data-act="faq" data-i="${i}">${f[0]}</button>`).join('')}</div>
      <a class="btn gold sm" target="_blank" rel="noopener" href="${waLink('مرحباً، أحتاج مساعدة في منصة التزام التدريب.')}">${tr('تواصل عبر واتساب', 'Chat on WhatsApp')}</a>`;
  }

  /* ---------- الأحداث ---------- */
  function toggle(list, id) { const i = list.indexOf(id); i < 0 ? list.push(id) : list.splice(i, 1); return i < 0; }
  function playLesson(c, i) {
    const l = c.lessons[i]; if (!l) return;
    if (l.locked) {
      if (c.kind === 'paid' && !hasAccess()) return subscribe('all-access');
      return toast(tr('ستُضاف فيديوهات هذا الدبلوم قريباً.', 'Videos will be added soon.'));
    }
    S.last = c.id; save(false);
    if (!embed(l)) { const u = safeUrl(l.href); if (u) window.open(u, '_blank', 'noopener'); return; }
    R.playing = { id: c.id, idx: i };
    if (route().name === 'course' && route().arg === c.id) { render(); $('.player')?.scrollIntoView({ block: 'nearest' }); } else location.hash = '#/course/' + encodeURIComponent(c.id);
  }
  const A = {
    close: () => modal.close(),
    open: el => { location.hash = '#/course/' + encodeURIComponent(el.dataset.id); },
    cat: el => { R.cat = el.dataset.id; render(); },
    clear: () => { R.cat = 'all'; R.q = ''; $('#q').value = ''; render(); },
    cycle: el => { R.cycle = el.dataset.id; render(); },
    plan: el => { const c = course(el.dataset.id); const on = toggle(S.plan, el.dataset.id); save(); if (on && c) addNotif(tr(`أُضيف «${c.title}» إلى خطتك.`, `Added "${title(c)}" to your plan.`)); toast(on ? tr('أُضيف إلى خطتي', 'Added to plan') : tr('أُزيل من خطتي', 'Removed from plan')); render(); },
    'plan-path': el => { const p = SEED.paths.find(x => x.id === el.dataset.id); pathSteps(p).forEach(s => s.ref && course(s.ref) && !S.plan.includes(s.ref) && S.plan.push(s.ref)); save(); addNotif(tr(`أُضيف مسار «${p.title}» إلى خطتك.`, `Path added to your plan.`)); toast(tr('أُضيف المسار إلى خطتي', 'Path added to plan')); render(); },
    fav: el => { const on = toggle(S.favs, el.dataset.id); save(); toast(on ? tr('أُضيف إلى المفضلة', 'Added to favourites') : tr('أُزيل من المفضلة', 'Removed')); render(); },
    start: el => { const c = course(el.dataset.id); if (!c) return; const d = doneOf(c); let i = c.lessons.findIndex((l, k) => !l.locked && !d.includes(k)); if (i < 0) i = 0; playLesson(c, i); },
    lesson: el => playLesson(course(el.dataset.id), +el.dataset.i),
    done: el => { const id = el.dataset.id, p = (S.progress[id] ||= { done: [] }); toggle(p.done, +el.dataset.i); save(); const c = course(id); if (pct(c) === 100) { toast(tr('أحسنت! أكملت الكورس 🎓', 'Course complete 🎓')); addNotif(tr(`أكملت «${c.title}».`, `You completed "${title(c)}".`)); } render(); },
    resume: () => {
      const open = x => x && pct(x) < 100;
      const c = [course(S.last), ...S.plan.map(course)].find(open);
      location.hash = c ? '#/course/' + encodeURIComponent(c.id) : '#/plan';
    },
    'add-link': el => linkModal(el.dataset.path || ''),
    'add-content': el => contentModal(el.dataset.course || ''),
    'content-open': el => { const x = R.content.find(i => i.id === el.dataset.id); if (x) openContent(x).catch(e => toast(e.message)); },
    'del-content': async el => { if (!confirm(tr('حذف هذا المحتوى نهائياً؟', 'Delete this content permanently?'))) return; try { await api('content-library?action=delete', { id: el.dataset.id }); await refresh(); } catch (e) { toast(e.message); } },
    book: el => bookModal(el.dataset.id),
    review: el => reviewModal(el.dataset.id || S.last || SEED.free[1].id, el.dataset.rid),
    'del-review': el => { S.reviews = S.reviews.filter(r => r.id !== el.dataset.id); save(); render(); },
    subscribe: el => subscribe(el.dataset.id),
    pay: el => {
      if (el.dataset.id === 'vodafone') return openModal(tr('الدفع عبر فودافون كاش', 'Pay with Vodafone Cash'), `<form class="f" data-form="pay" data-method="vodafone" novalidate>
        <p class="note">${tr('المبلغ', 'Amount')}: <strong>${egpOf(S.sub.amountSAR)}</strong> ${tr('(بسعر تحويل تقريبي من الريال السعودي)', '(approximate conversion from SAR)')}</p>
        <label>${tr('رقم محفظة فودافون كاش', 'Vodafone Cash wallet number')}<input name="phone" type="tel" required dir="ltr" placeholder="01XXXXXXXXX" value="${esc(S.user?.phone || '')}"></label>
        <p class="err" role="alert"></p><button class="btn gold">${tr('المتابعة إلى الدفع', 'Continue to payment')}</button></form>`);
      FORMS.pay(null, { method: el.dataset.id }).catch(e => toast(e.message));
    },
    auth: el => authModal(el.dataset.id),
    logout: () => { S.token = ''; S.user = null; S.sub = null; R.admin = null; R.adm = null; R.wallet = null; save(false); toast(tr('تم تسجيل الخروج', 'Logged out')); refresh(); },
    'cancel-sub': async () => { if (!confirm(tr('تأكيد إلغاء الاشتراك؟', 'Cancel subscription?'))) return; try { S.sub = (await api('subscription-manager?action=cancel', {})).subscription; save(false); render(); } catch (e) { toast(e.message); } },
    lang: () => { S.lang = S.lang === 'ar' ? 'en' : 'ar'; save(false); applyPrefs(); render(); },
    theme: () => { const dark = document.documentElement.dataset.theme === 'dark'; S.theme = dark ? 'light' : 'dark'; save(false); applyPrefs(); },
    notifs: () => { openModal(tr('الإشعارات', 'Notifications'), S.notifs.length ? `<div class="rows" style="margin:0">${S.notifs.map(n => `<div class="row"><div class="grow">${esc(n.text)}<div class="small muted">${new Date(n.at).toLocaleString(S.lang === 'en' ? 'en' : 'ar-EG')}</div></div></div>`).join('')}</div>` : `<p class="muted">${tr('لا توجد إشعارات بعد.', 'No notifications yet.')}</p>`); S.notifs.forEach(n => n.read = true); save(false); badge(); },
    assistant: () => { const el = $('#assistant'); el.hidden = !el.hidden; if (!el.hidden) assistant(); },
    faq: el => assistant(FAQ()[+el.dataset.i][1]),
    download: el => { const f = FILES[el.dataset.id]; if (f) download(f[0], f[1], f[2]()); },
    export: () => download('iltizam-my-data.json', 'application/json', JSON.stringify({ plan: S.plan, favs: S.favs, progress: S.progress, reviews: S.reviews, links: S.links }, null, 2)),
    reset: () => { if (!confirm(tr('سيُمسح كل ما حُفظ على هذا الجهاز. متابعة؟', 'This clears everything stored on this device. Continue?'))) return; localStorage.removeItem(KEY); location.reload(); },
    'del-link': async el => {
      const id = el.dataset.id;
      if (!confirm(tr('حذف هذا الرابط؟', 'Delete this link?'))) return;
      if (S.links.some(l => l.id === id)) S.links = S.links.filter(l => l.id !== id);
      else { try { await api('courses-and-paths?action=delete-link', { id }); R.links = R.links.filter(l => l.id !== id); } catch (e) { return toast(e.message); } }
      S.plan = S.plan.filter(x => x !== id); S.favs = S.favs.filter(x => x !== id); save(); location.hash = '#/free';
    },
    'del-lesson': async el => { try { await api('courses-and-paths?action=delete-lesson', { courseId: el.dataset.id, id: el.dataset.lid }); await refresh(); } catch (e) { toast(e.message); } },
    cert: async el => {
      if (!ONLINE || !S.user) { if (ONLINE) { afterAuth = () => A.cert(el); authModal('register'); } return toast(tr('سجّل الدخول لإصدار شهادة موثقة.', 'Log in to issue a verified certificate.')); }
      try {
        await api('courses-and-paths?action=userdata', { data: { plan: S.plan, favs: S.favs, progress: S.progress, reviews: S.reviews } });
        const c = (await api('verify-certificate', { courseId: el.dataset.id })).certificate;
        if (!S.certs.some(x => x.code === c.code)) S.certs.push(c); save(false); certModal(c);
      } catch (e) { toast(e.message); }
    },
    'show-cert': el => { const c = S.certs.find(x => x.code === el.dataset.id); if (c) certModal(c); },
    'u-filter': el => { R.urole = el.value; render(); },
    'u-role': el => admDo('update', { email: el.dataset.id, role: el.dataset.s || el.value }, tr('تم تحديث الدور', 'Role updated')),
    'u-suspend': el => admDo('update', { email: el.dataset.id, suspended: !!el.dataset.s }, el.dataset.s ? tr('أُوقف الحساب', 'Suspended') : tr('أُعيد تفعيل الحساب', 'Reactivated')),
    'u-delete': el => { if (confirm(tr(`حذف حساب ${el.dataset.id} نهائياً؟ لا يمكن التراجع.`, `Permanently delete ${el.dataset.id}?`))) admDo('delete', { email: el.dataset.id }, tr('حُذف المستخدم', 'User deleted')); },
    'u-create': () => openModal(tr('إضافة مستخدم', 'Add user'), `<form class="f" data-form="ucreate" novalidate>
      <label>${tr('الاسم', 'Name')}<input name="name" required maxlength="80"></label>
      <label>${tr('البريد الإلكتروني (اسم الدخول)', 'Email (login)')}<input name="email" type="email" required dir="ltr"></label>
      <div class="cols"><label>${tr('كلمة مرور مؤقتة', 'Temporary password')}<input name="password" required minlength="8" dir="ltr"></label>
      <label>${tr('الدور', 'Role')}<select name="role">${Object.entries(ROLE()).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label></div>
      <div class="cols"><label>${tr('الجوال', 'Mobile')}<input name="phone" dir="ltr"></label><label>${tr('التخصص', 'Specialty')}<input name="specialty"></label></div>
      <p class="err" role="alert"></p><button class="btn gold">${tr('إنشاء الحساب', 'Create account')}</button></form>`),
    'u-perms': el => { const u = admUser(el.dataset.id); if (!u) return; openModal(tr('محفظة الصلاحيات', 'Permissions') + ' — ' + esc(u.name), `<form class="f" data-form="uperms" data-id="${esc(u.email)}">
      ${R.adm.allPerms.map(p => `<label style="display:flex;gap:10px;align-items:center;font-weight:400"><input type="checkbox" name="p" value="${p}" ${u.perms.includes(p) ? 'checked' : ''} style="width:20px;min-height:20px">${PERM()[p]}</label>`).join('')}
      <label>${tr('كلمة مرور جديدة (اختياري)', 'New password (optional)')}<input name="password" minlength="8" dir="ltr" autocomplete="new-password"></label>
      <p class="err" role="alert"></p><button class="btn gold">${tr('حفظ الصلاحيات', 'Save permissions')}</button>
      <button type="button" class="btn soft" data-act="u-perms-reset" data-id="${esc(u.email)}">${tr('إرجاع لصلاحيات الدور الافتراضية', 'Reset to role defaults')}</button></form>`); },
    'u-perms-reset': el => admDo('update', { email: el.dataset.id, perms: null }, tr('أُعيدت الصلاحيات الافتراضية', 'Reset to defaults')),
    'u-sub': el => openModal(tr('منح اشتراك مباشر', 'Grant subscription'), `<form class="f" data-form="usub" data-id="${esc(el.dataset.id)}">
      <p class="note">${tr('يُفعَّل الاشتراك فوراً بدون دفع ولا تُحتسب عليه عمولة.', 'Activates immediately with no payment and no commission.')}</p>
      <div class="cols"><label>${tr('الباقة', 'Plan')}<select name="plan">${SEED.plans.filter(p => p.monthlySAR).map(p => `<option value="${p.id}">${esc(title(p))}</option>`).join('')}</select></label>
      <label>${tr('المدة بالأيام', 'Days')}<input name="days" type="number" min="1" max="3650" value="30"></label></div>
      <p class="err" role="alert"></p><button class="btn gold">${tr('منح الاشتراك', 'Grant')}</button></form>`),
    'u-wallet': el => { const id = el.dataset.id, pool = id === 'trainers_pool', u = admUser(id), es = R.adm.ledger.filter(e => e.account === id);
      openModal(tr('المحفظة', 'Wallet') + ' — ' + (pool ? tr('رصيد المدربين', 'Trainer pool') : esc(u?.name || id)), `<p><strong>${tr('الرصيد', 'Balance')}: ${sar(pool ? R.adm.pool : u?.balance)}</strong></p>
      <div class="rows" style="margin-block:12px;max-height:200px;overflow:auto">${es.length ? es.map(ledgerRow).join('') : `<p class="muted">${tr('لا توجد حركات.', 'No transactions.')}</p>`}</div>
      <form class="f" data-form="uledger" data-id="${esc(id)}"><div class="cols">
        <label>${tr('نوع القيد', 'Entry')}<select name="type">${pool ? `<option value="payout">${tr('صرف من الرصيد', 'Payout')}</option>` : `<option value="payout">${tr('صرف مستحقات (خصم)', 'Payout (debit)')}</option><option value="credit">${tr('إضافة رصيد', 'Add credit')}</option><option value="from-pool">${tr('توزيع من رصيد المدربين', 'From trainer pool')}</option>`}</select></label>
        <label>${tr('المبلغ (ر.س)', 'Amount (SAR)')}<input name="amountSAR" type="number" min="1" step="0.01" required></label></div>
        <label>${tr('ملاحظة', 'Note')}<input name="note" maxlength="200"></label>
        <p class="err" role="alert"></p><button class="btn gold">${tr('تسجيل القيد', 'Record')}</button></form>`); },
    'adm-tab': el => { R.adminTab = el.dataset.id; render(); },
    'adm-activate': async el => { try { await api('subscription-manager?action=activate', { id: el.dataset.id }); toast(tr('تم التفعيل', 'Activated')); loadAdmin(); } catch (e) { toast(e.message); } },
    'adm-booking': async el => { try { await api('booking-engine?action=status', { id: el.dataset.id, status: el.dataset.s, trainerEmail: $('#tr-' + el.dataset.id)?.value || '' }); R.wallet = null; loadAdmin(); } catch (e) { toast(e.message); } },
    'adm-link': async el => { try { await api('courses-and-paths?action=approve-link', { id: el.dataset.id, approved: !!el.dataset.s }); await refresh(); } catch (e) { toast(e.message); } },
    'adm-role': async el => { try { await api('auth-rbac?action=set-role', { email: el.dataset.id, role: el.dataset.s || el.value }); toast(tr('تم تحديث الصلاحية', 'Role updated')); loadAdmin(); refresh(); } catch (e) { toast(e.message); } }
  };
  document.addEventListener('click', e => {
    const j = e.target.closest('[data-join]');
    if (j) { e.preventDefault(); return authModal('register', { contractor: 'contractor_b2b' }[j.dataset.join] || j.dataset.join); }
    if (e.target.closest('[data-change]')) return;
    const el = e.target.closest('[data-act]');
    if (el && A[el.dataset.act]) { if (el.tagName === 'A') e.preventDefault(); A[el.dataset.act](el, e); }
  });

  document.addEventListener('change', e => { const el = e.target.closest('[data-change]'); if (el && A[el.dataset.change]) A[el.dataset.change](el); });
  const fileB64 = f => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = () => no(new Error(tr('تعذرت قراءة الملف.', 'Could not read file.'))); r.readAsDataURL(f); });
  const FORMS = {
    async pay(f, d) {
      const method = f ? f.dataset.method : d.method, r = await api('payments?action=checkout', { method, phone: d.phone });
      toast(tr('جارٍ تحويلك إلى صفحة الدفع…', 'Redirecting to payment…')); location.href = r.url;
    },
    async content(f, d) {
      const file = d.file && d.file.size ? d.file : null; delete d.file;
      if (!d.title.trim()) throw new Error(tr('اكتب عنواناً.', 'Add a title.'));
      if (file) {
        if (file.size > 4 * 1024 * 1024) throw new Error(tr('الملف أكبر من 4 ميجابايت. ارفعه على يوتيوب أو Google Drive وألصق الرابط.', 'File exceeds 4 MB. Upload elsewhere and paste the link.'));
        Object.assign(d, { fileBase64: await fileB64(file), fileName: file.name, mime: file.type });
      }
      await api('content-library', d); modal.close(); toast(tr('نُشر المحتوى', 'Content published'));
      await refresh(); if (!['course', 'library'].includes(route().name)) location.hash = '#/library';
    },
    async commission(f, d) { await api('admin-users?action=settings', d); toast(tr('حُفظت النسب', 'Rates saved')); await loadAdmin(); },
    async ucreate(f, d) { await api('admin-users?action=create', d); modal.close(); toast(tr('أُنشئ الحساب', 'Account created')); await loadAdmin(); refresh(); },
    async uperms(f, d) { await api('admin-users?action=update', Object.assign({ email: f.dataset.id, perms: new FormData(f).getAll('p') }, d.password ? { password: d.password } : {})); modal.close(); toast(tr('حُفظت الصلاحيات', 'Permissions saved')); await loadAdmin(); },
    async usub(f, d) { await api('admin-users?action=grant-sub', Object.assign({ email: f.dataset.id }, d)); modal.close(); toast(tr('مُنح الاشتراك', 'Subscription granted')); await loadAdmin(); },
    async uledger(f, d) { const pool = f.dataset.id === 'trainers_pool'; await api('admin-users?action=ledger', Object.assign(pool ? { account: 'trainers_pool' } : { email: f.dataset.id }, d)); modal.close(); R.wallet = null; toast(tr('سُجّل القيد', 'Entry recorded')); await loadAdmin(); },
    async profile(f, d) { const r = await api('auth-rbac?action=profile', d); S.user = r.user; save(false); toast(tr('حُفظ الملف التعريفي', 'Profile saved')); await refresh(); },
    async auth(f, d) {
      const res = await api('auth-rbac?action=' + f.dataset.mode, d);
      S.token = res.token; S.user = res.user; S.sub = res.subscription; save(false);
      modal.close(); toast(tr(`أهلاً ${res.user.name}`, `Welcome ${res.user.name}`));
      if (!location.hash.replace(/^#\/?/, '')) location.hash = '#/home';
      await refresh(); const cb = afterAuth; afterAuth = null; if (cb) cb();
    },
    async link(f, d) {
      if (!safeUrl(d.url)) throw new Error(tr('أدخل رابطاً صحيحاً يبدأ بـ https://', 'Enter a valid https:// URL.'));
      if (!d.title.trim()) throw new Error(tr('اكتب عنواناً للرابط.', 'Add a title.'));
      let id;
      if (S.user && ONLINE) { const l = (await api('courses-and-paths?action=add-link', d)).link; R.links.push(l); id = l.id; }
      else { id = 'local-' + Date.now().toString(36); S.links.push({ id, url: safeUrl(d.url), title: d.title.trim().slice(0, 140), desc: d.desc.trim(), cat: d.cat, pathId: d.pathId }); }
      save(); modal.close(); addNotif(tr(`أُضيف الرابط «${d.title}».`, `Link "${d.title}" added.`)); toast(tr('أُضيف الرابط', 'Link added'));
      if (d.pathId) { location.hash === '#/paths' ? render() : (location.hash = '#/paths'); } else location.hash = '#/course/' + encodeURIComponent(id);
    },
    async book(f, d) {
      if (!d.name.trim() || d.phone.replace(/\D/g, '').length < 8 || !d.date || !d.time) throw new Error(tr('أكمل الاسم والجوال والتاريخ والوقت.', 'Fill in name, mobile, date and time.'));
      const c = course(f.dataset.id); let bk;
      if (ONLINE) bk = (await api('booking-engine', Object.assign({ courseId: f.dataset.id }, d))).booking;
      else bk = { id: 'local-' + Date.now(), courseTitle: c ? c.title : 'استشارة عامة', date: d.date, time: d.time, minutes: +d.minutes, priceSAR: Math.round(SEED.hourlyRateSAR / 60 * d.minutes), status: 'pending' };
      S.bookings.unshift(bk); save(false); addNotif(tr(`حجز جلسة ${bk.date} ${bk.time} بانتظار التأكيد.`, `Session ${bk.date} ${bk.time} pending confirmation.`));
      const msg = `مرحباً، حجزت جلسة استشارية عبر منصة التزام التدريب.\nالكورس: ${bk.courseTitle}\nالموعد: ${bk.date} ${bk.time}\nالمدة: ${bk.minutes} دقيقة\nالاسم: ${d.name}`;
      openModal(tr('تم تسجيل الحجز', 'Booking received'), `<p>${tr('سيتم تأكيد موعدك قريباً. أرسل تفاصيل الحجز عبر واتساب لتأكيد أسرع.', 'We will confirm shortly. Send the details on WhatsApp for faster confirmation.')}</p>
        <p class="note" style="margin-block:12px">${esc(bk.date)} · ${esc(bk.time)} · ${bk.minutes} ${tr('دقيقة', 'min')} · ${money(bk.priceSAR)}</p>
        <a class="btn gold block" target="_blank" rel="noopener" href="${waLink(msg)}">${tr('أرسل عبر واتساب', 'Send on WhatsApp')}</a>`);
    },
    async review(f, d) {
      if (!d.text.trim()) throw new Error(tr('اكتب ملاحظاتك.', 'Write your notes.'));
      const rec = { id: f.dataset.rid || 'r-' + Date.now().toString(36), courseId: d.courseId, rating: +d.rating, text: d.text.trim(), date: new Date().toISOString().slice(0, 10) };
      S.reviews = [rec, ...S.reviews.filter(r => r.id !== rec.id)]; save(); modal.close(); toast(tr('حُفظت المراجعة', 'Review saved'));
      if (S.user && ONLINE) api('courses-and-paths?action=review', rec).catch(() => {});
      location.hash === '#/reviews' ? render() : (location.hash = '#/reviews');
    },
    async lesson(f, d) { await api('courses-and-paths?action=add-lesson', Object.assign({ courseId: f.dataset.id }, d)); toast(tr('أُضيف الدرس', 'Lesson added')); await refresh(); }
  };
  document.addEventListener('submit', async e => {
    const f = e.target.closest('[data-form]'); if (!f) return;
    e.preventDefault();
    const err = $('.err', f), btn = $('button:not([type=button])', f), d = Object.fromEntries(new FormData(f));
    err.textContent = ''; btn.disabled = true;
    try { await FORMS[f.dataset.form](f, d); } catch (x) { err.textContent = x.message; }
    if (btn.isConnected) btn.disabled = false;
  });
  $('#searchForm').addEventListener('submit', e => e.preventDefault());
  $('#q').addEventListener('input', e => {
    R.q = e.target.value.trim();
    if (!['home', 'free', 'paid', 'paths', 'library'].includes(route().name)) location.hash = '#/home'; else render();
  });
  document.addEventListener('input', e => { if (e.target.id !== 'uq') return; R.uq = e.target.value; const pos = e.target.selectionStart; render(); const n = $('#uq'); n.focus(); n.setSelectionRange(pos, pos); });
  $('#currency').addEventListener('change', e => { S.currency = e.target.value; save(false); render(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#assistant').hidden) $('#assistant').hidden = true; });

  /* ---------- التهيئة ---------- */
  const I18N = {
    skip: ['تخطَّ إلى المحتوى', 'Skip to content'], 'nav.home': ['الرئيسية', 'Home'], 'nav.paid': ['الكورسات المدفوعة (تأهيل وظيفي)', 'Paid courses (job-ready)'],
    'nav.free': ['المكتبة المجانية (يوتيوب)', 'Free library (YouTube)'], 'nav.paths': ['مسارات التعلم', 'Learning paths'], 'nav.library': ['مكتبة المحتوى', 'Content library'], 'nav.trainers': ['المدربون', 'Trainers'], 'nav.admin': ['إدارة المستخدمين', 'User management'], addLink: ['+ أضف رابط', '+ Add link'],
    'foot.tag': ['تعلّم مجاناً، وتأهّل لسوق العمل في السعودية ومصر.', 'Learn free and get job-ready in Saudi Arabia and Egypt.'], 'nav.platforms': ['بوابة المنصات العالمية', 'Global platforms'],
    'nav.pricing': ['الباقات والاشتراكات', 'Plans & pricing'], 'join.trainee': ['سجّل كمتدرب', 'Join as trainee'], 'join.instructor': ['انضم كمحاضر', 'Join as instructor'], 'join.contractor': ['تسجيل المقاولين B2B', 'Contractors B2B'],
    search: ['ابحث عن كورس، تخصص هندسي، أو أداة ذكاء اصطناعي...', 'Search a course, field or AI tool...']
  };
  function applyPrefs() {
    const root = document.documentElement, en = S.lang === 'en';
    root.lang = S.lang; root.dir = en ? 'ltr' : 'rtl';
    root.dataset.theme = S.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    $$('[data-i18n]').forEach(el => { el.textContent = I18N[el.dataset.i18n][en ? 1 : 0]; });
    $$('[data-i18n-ph]').forEach(el => { el.placeholder = I18N[el.dataset.i18nPh][en ? 1 : 0]; });
    $('#langBtn').textContent = en ? 'ع' : 'EN'; $('#currency').value = S.currency;
  }
  const union = (a = [], b = []) => [...new Set([...a, ...b])];
  async function refresh() {
    if (ONLINE) {
      try { const d = await api('courses-and-paths'); R.links = d.links || []; R.paidLessons = d.paidLessons || {}; R.wa = d.config?.whatsapp || CONFIG.whatsapp; } catch { /* يعمل بالبيانات المحلية */ }
      try { R.methods = (await api('payments?action=methods')).methods || {}; } catch { /* اختياري */ }
      try { R.content = (await api('content-library')).items || []; R.trainers = (await api('auth-rbac?action=instructors')).instructors || []; } catch { /* اختياري */ }
      if (S.token) {
        try {
          const me = await api('auth-rbac?action=me'); S.user = me.user; S.sub = me.subscription;
          const sv = (await api('courses-and-paths?action=userdata')).data;
          if (sv) {
            S.plan = union(sv.plan, S.plan); S.favs = union(sv.favs, S.favs);
            for (const [k, v] of Object.entries(sv.progress || {})) S.progress[k] = { done: union(v.done, S.progress[k]?.done) };
            const ids = new Set(S.reviews.map(r => r.id)); S.reviews.push(...(sv.reviews || []).filter(r => !ids.has(r.id)));
          }
          if (S.user.role !== 'admin') { const b = await api('booking-engine'); if (b.bookings.length) S.bookings = b.bookings; }
          save();
        } catch (e) { if (e.status === 401) { S.token = ''; S.user = null; S.sub = null; save(false); } }
      }
    }
    render();
  }

  applyPrefs();
  const qs = new URLSearchParams(location.search), join = qs.get('join'), ver = qs.get('verify');
  if (ver) location.hash = '#/verify/' + encodeURIComponent(ver);
  const paid = qs.get('paid');
  if (join || ver || paid) history.replaceState(null, '', location.pathname + location.hash);
  async function payResult(pid) {
    openModal(tr('نتيجة الدفع', 'Payment result'), `<p id="payMsg" class="muted">${tr('جارٍ التحقق من الدفع…', 'Verifying payment…')}</p>`);
    for (let i = 0; i < 8; i++) {
      let st; try { st = (await api('payments?action=status&pid=' + encodeURIComponent(pid))).status; } catch { st = 'error'; }
      const box = $('#payMsg'); if (!box) return;
      if (st === 'paid') { box.outerHTML = `<div class="verify"><div class="seal">✅</div><h2>${tr('تم الدفع بنجاح', 'Payment successful')}</h2><p>${tr('اشتراكك فعّال الآن. استمتع بالدبلومات والمرفقات.', 'Your plan is active.')}</p><div class="stack" style="margin-block-start:16px"><a class="btn gold block" href="#/paid" data-act="close">${tr('تصفح الدبلومات', 'Browse diplomas')}</a></div></div>`; await refresh(); return; }
      if (st === 'failed') { box.outerHTML = `<div class="verify"><div class="seal">❌</div><h2>${tr('لم تكتمل عملية الدفع', 'Payment not completed')}</h2><p class="muted">${tr('لم يُخصم أي مبلغ. يمكنك المحاولة مرة أخرى من «اشتراكي».', 'You can try again from My subscription.')}</p></div>`; return; }
      await new Promise(r => setTimeout(r, 2500));
    }
    const box = $('#payMsg'); if (box) box.textContent = tr('لم يصلنا تأكيد الدفع بعد. إن تم الخصم فسيُفعَّل اشتراكك تلقائياً خلال دقائق، وإلا تواصل معنا عبر واتساب.', 'Confirmation has not arrived yet. If you were charged your plan will activate within minutes.');
  }
  render();
  refresh().then(() => { if (paid) payResult(paid); if (join && !S.user) authModal('register', { contractor: 'contractor_b2b' }[join] || join); });
})();
