/* التزام التدريب — بيانات المنصة الأساسية (تُستخدم في الواجهة وفي دوال Netlify) */
globalThis.ILTIZAM_SEED = {
  channel: 'https://www.youtube.com/channel/UCIwaNW_dWlbpz8GdLeJJ0Ag/',
  // أسعار تحويل تقريبية قابلة للتعديل (الأساس بالريال السعودي)
  rates: { SAR: 1, EGP: 13, USD: 0.2667 },
  hourlyRateSAR: 200,

  categories: [
    { id: 'all', ar: 'الكل', en: 'All' },
    { id: 'sec', ar: 'مشاريع الكهرباء والعقد الموحد SEC', en: 'SEC Unified Contract' },
    { id: 'office', ar: 'المكتب الفني و AutoCAD', en: 'Technical Office & AutoCAD' },
    { id: 'testing', ar: 'اختبارات الكابلات والمحولات', en: 'Cable & Transformer Testing' },
    { id: 'ai', ar: 'تحديثات الذكاء الاصطناعي | AI Updates', en: 'AI Updates' },
    { id: 'automation', ar: 'Claude & n8n Automation', en: 'Claude & n8n Automation' },
    { id: 'finance', ar: 'الإدارة المالية والمستخلصات', en: 'Finance & Invoicing' },
    { id: 'lang', ar: 'اللغات للمهندسين', en: 'Languages for Engineers' },
    { id: 'ehs', ar: 'السلامة المهنية EHS', en: 'EHS Safety' },
    { id: 'kids', ar: 'تأسيس النشء والعلوم', en: 'Kids & Science' }
  ],

  free: [
    {
      id: 'alpha-media', cat: 'sec', official: true,
      title: 'القناة الرسمية المعتمدة: Alpha Media',
      titleEn: 'Official channel: Alpha Media',
      desc: 'إدارة المشاريع، تأهيل المقاولين، وشروحات العقد الموحد — أحدث فيديوهات القناة الرسمية للمنصة.',
      url: 'https://www.youtube.com/channel/UCIwaNW_dWlbpz8GdLeJJ0Ag/',
      lessons: [{ t: 'أحدث فيديوهات قناة Alpha Media', list: 'UUIwaNW_dWlbpz8GdLeJJ0Ag' }]
    },
    {
      id: 'sec-intro', cat: 'sec',
      title: 'مدخل العقد الموحد واستلام المعاملات (SEC)',
      titleEn: 'Intro to the SEC Unified Contract',
      desc: 'ما هو العقد الموحد، كيف تعمل شركات المقاولات مع الشركة السعودية للكهرباء، ومهام الفحص على نظام IFS.',
      lessons: [
        { t: 'تعريف العقد الموحد', yt: '_fs5a6w8H88' },
        { t: 'عمل شركات المقاولات', yt: 'BL4HtK72N9A' },
        { t: 'مهام الفحص على نظام IFS', yt: '6hd6mQJfxf4' }
      ]
    },
    {
      id: 'safety-permits', cat: 'ehs',
      title: 'تصاريح العمل واجتياز اختبار Safety Coordinator',
      titleEn: 'Work Permits & the Safety Coordinator Exam',
      desc: 'شرح تصاريح العمل في مشاريع الكهرباء، ومراجعة أسئلة اختبار منسق السلامة.',
      lessons: [
        { t: 'شرح تصاريح العمل', yt: 'oCOgBIT7tWc' },
        { t: 'أسئلة اختبار منسق السلامة', yt: 'V619YUE82bM' }
      ]
    },
    {
      id: 'cables-transformers', cat: 'testing',
      title: 'كشف أعطال واختبارات الكابلات والمحولات',
      titleEn: 'Cable & Transformer Fault Finding and Testing',
      desc: 'فحص الميجر وكشف الأعطال، اختبار كابلات XLPE بالجهد العالي، وتوصيف واختبار المحولات.',
      lessons: [
        { t: 'فحص الميجر وكشف الأعطال (1)', yt: 'O-4V_pIRy1k' },
        { t: 'فحص الميجر وكشف الأعطال (2)', yt: 'JicX0f3rjWQ' },
        { t: 'اختبار كابلات XLPE بالجهد العالي', yt: 'L012hl8nGak' },
        { t: 'توصيف واختبار المحولات (1)', yt: '5LvnKerqQFE' },
        { t: 'توصيف واختبار المحولات (2)', yt: 'cdWOQ0TCs-A' }
      ]
    },
    {
      id: 'n8n-ai', cat: 'automation',
      title: 'أتمتة الأعمال والـ Workflows عبر n8n + AI',
      titleEn: 'Business Automation with n8n + AI',
      desc: 'ابنِ مسارات عمل مؤتمتة تربط أدواتك اليومية بالذكاء الاصطناعي بدون تعقيد برمجي.',
      lessons: [
        { t: 'أتمتة الأعمال عبر n8n + AI (1)', yt: '9bMy9C8wIyg' },
        { t: 'أتمتة الأعمال عبر n8n + AI (2)', yt: '_5XCakt0ycU' }
      ]
    },
    {
      id: 'ai-30min', cat: 'ai',
      title: 'خطة احتراف الذكاء الاصطناعي من الصفر بـ 30 دقيقة يومياً',
      titleEn: 'Master AI from Zero in 30 Minutes a Day',
      desc: 'خطة يومية قصيرة تبني بها أساساً عملياً في أدوات الذكاء الاصطناعي.',
      lessons: [
        { t: 'خطة احتراف الذكاء الاصطناعي (1)', yt: 'uE8uomCumSo' },
        { t: 'خطة احتراف الذكاء الاصطناعي (2)', yt: 'wEQlr9n6hII' }
      ]
    },
    {
      id: 'azure-ai900', cat: 'ai',
      title: 'أساسيات الذكاء الاصطناعي السحابي Microsoft Azure AI-900',
      titleEn: 'Microsoft Azure AI-900 Fundamentals',
      desc: 'مدخل إلى خدمات الذكاء الاصطناعي السحابية والتحضير لشهادة AI-900.',
      lessons: [{ t: 'كورس Azure AI-900 الكامل', yt: 'HBAU4kLALCc' }]
    }
  ],

  paid: [
    {
      id: 'claude-dashboard', cat: 'automation', icon: '📊', priceSAR: 590, hours: 18, demo: true,
      title: 'Claude Dashboard | أنشئ لوحات تحكم تفاعلية وهندسية بالذكاء الاصطناعي',
      titleEn: 'Claude Dashboard | Build Interactive Engineering Dashboards with AI',
      desc: 'تعلم كيف تنشئ لوحات تحكم (Dashboards) احترافية لإدارة المشاريع، العمالة، المعدات، والمبيعات باستخدام Claude AI وربطها بـ AutoCAD MCP و Netlify بدون تعقيد برمجي.',
      outcomes: ['كتابة أوامر Claude لبناء لوحة تحكم كاملة', 'ربط البيانات من Excel و AutoCAD MCP', 'النشر على Netlify وحفظ نسخة على GitHub'],
      lessons: ['مدخل: ما الذي يمكن بناؤه بـ Claude', 'تجهيز بيانات المشروع (Excel / CSV)', 'بناء لوحة أوامر العمل والعمالة', 'مؤشرات الأداء KPI والرسوم البيانية', 'الربط مع AutoCAD MCP', 'النشر على Netlify والتحديث التلقائي'],
      attachments: [
        { name: 'ملف أوامر Claude لبناء لوحة التحكم', kind: 'Claude', file: 'prompts' },
        { name: 'شيت بيانات أوامر العمل اليومية', kind: 'Excel', file: 'workorders' }
      ]
    },
    {
      id: 'sec-pro', cat: 'sec', icon: '⚡', priceSAR: 1290, hours: 40,
      title: 'دبلوم مهندس العقد الموحد والمكتب الفني المعتمد (SEC Unified Contract Pro)',
      titleEn: 'SEC Unified Contract Pro Diploma',
      desc: 'تأهيل كامل للعمل في مشاريع الشركة السعودية للكهرباء: إدارة أوامر العمل اليومية، نظام IFS، إعداد المستخلصات، وحصر الكميات (BOQ).',
      outcomes: ['إدارة أوامر العمل من الاستلام حتى الإقفال', 'العمل على نظام IFS', 'إعداد المستخلص الشهري وحصر الكميات'],
      lessons: ['هيكل العقد الموحد وأطرافه', 'دورة أمر العمل اليومية', 'نظام IFS خطوة بخطوة', 'حصر الكميات BOQ', 'إعداد المستخلصات واعتمادها', 'مشروع تطبيقي: معاملة كاملة'],
      attachments: [
        { name: 'نموذج حصر الكميات BOQ', kind: 'Excel', file: 'boq' },
        { name: 'نموذج المستخلص الشهري', kind: 'Excel', file: 'invoice' },
        { name: 'شيت متابعة أوامر العمل', kind: 'Excel', file: 'workorders' }
      ]
    },
    {
      id: 'testing-camp', cat: 'testing', icon: '🔌', priceSAR: 1490, hours: 36,
      title: 'المعسكر التطبيقي لاختبارات الكابلات والمحولات وأجهزة الفحص (Testing & Commissioning)',
      titleEn: 'Testing & Commissioning Bootcamp',
      desc: 'التدريب العملي على أجهزة OMICRON و Megger، حقن التيار، اختبار محولات التيار (CT)، واستلام الشبكات.',
      outcomes: ['تنفيذ اختبارات العزل والجهد العالي', 'اختبار محولات التيار CT وحقن التيار', 'إعداد تقرير الاختبار واستلام الشبكة'],
      lessons: ['أساسيات الاختبارات والسلامة', 'اختبارات العزل بجهاز Megger', 'اختبار الكابلات بالجهد العالي', 'اختبارات المحولات', 'حقن التيار واختبار CT بأجهزة OMICRON', 'تقارير الاختبار واستلام الشبكات'],
      attachments: [{ name: 'نموذج تقرير اختبار عزل الكابلات', kind: 'Excel', file: 'testreport' }]
    },
    {
      id: 'shop-drawings', cat: 'office', icon: '📐', priceSAR: 990, hours: 32,
      title: 'دبلوم التصميم الكهربائي والمخططات التنفيذية (Shop Drawings & AutoCAD)',
      titleEn: 'Electrical Design & Shop Drawings Diploma',
      desc: 'تأهيل مهندسي المكتب الفني في مصر والخليج لقراءة وإعداد المخططات، توزيع القوى، وتسعير المناقصات.',
      outcomes: ['قراءة وإعداد المخططات التنفيذية', 'توزيع القوى وحساب الأحمال', 'تسعير المناقصات'],
      lessons: ['قراءة المخططات والرموز', 'إعداد Shop Drawings على AutoCAD', 'توزيع القوى وجداول اللوحات', 'حساب الأحمال والكابلات', 'الحصر والتسعير للمناقصات'],
      attachments: [
        { name: 'نموذج حصر الكميات BOQ', kind: 'Excel', file: 'boq' },
        { name: 'مخططات AutoCAD التطبيقية', kind: 'AutoCAD' }
      ]
    },
    {
      id: 'safety-coordinator', cat: 'ehs', icon: '🦺', priceSAR: 690, hours: 20,
      title: 'برنامج تأهيل واجتياز اختبار مهندس ومنسق السلامة (SEC Safety Coordinator)',
      titleEn: 'SEC Safety Coordinator Preparation Program',
      desc: 'حقيبة تدريبية شاملة لاجتياز اختبارات ومقابلات شركة الكهرباء والمشاريع الكبرى.',
      outcomes: ['إتقان تصاريح العمل وإجراءات العزل', 'مراجعة أسئلة الاختبار', 'التحضير للمقابلة الشخصية'],
      lessons: ['متطلبات منسق السلامة', 'تصاريح العمل وإجراءات العزل', 'تقييم المخاطر في الموقع', 'بنك أسئلة الاختبار', 'التحضير للمقابلة'],
      attachments: [{ name: 'قائمة فحص السلامة اليومية للموقع', kind: 'Excel', file: 'safety' }]
    },
    {
      id: 'english-finance', cat: 'finance', cats: ['finance', 'lang'], icon: '💼', priceSAR: 790, hours: 24,
      title: 'اللغة الإنجليزية التعاقدية والإدارة المالية لمديري المشاريع والمهندسين',
      titleEn: 'Contract English & Financial Management for Engineers',
      desc: 'كتابة التقارير الفنية، المراسلات الرسمية، وإدارة ميزانيات المشاريع.',
      outcomes: ['كتابة المراسلات والتقارير الفنية بالإنجليزية', 'قراءة بنود العقود', 'إعداد ومتابعة ميزانية المشروع'],
      lessons: ['مصطلحات العقود والمراسلات', 'كتابة التقرير الفني', 'خطابات المطالبات والردود', 'ميزانية المشروع والتدفق النقدي', 'المستخلصات والتقارير المالية'],
      attachments: [
        { name: 'قوالب المراسلات الرسمية بالإنجليزية', kind: 'Word', file: 'letters' },
        { name: 'نموذج المستخلص الشهري', kind: 'Excel', file: 'invoice' }
      ]
    }
  ],

  paths: [
    {
      id: 'path-sec', cats: ['sec', 'office', 'ehs'],
      title: 'مسار مهندس العقد الموحد الشامل (من المبتدئ إلى مدير مشروع)',
      titleEn: 'SEC Unified Contract Engineer Path',
      desc: 'رحلة مرتبة تبدأ من فهم العقد الموحد مجاناً وتنتهي بإدارة معاملة كاملة.',
      steps: [
        { ref: 'sec-intro' }, { ref: 'safety-permits' }, { ref: 'cables-transformers' },
        { ref: 'sec-pro' }, { ref: 'shop-drawings' },
        { t: 'تطبيق عملي: أقفل معاملة كاملة من أمر العمل حتى المستخلص' }
      ]
    },
    {
      id: 'path-ai', cats: ['ai', 'automation'],
      title: 'مسار أتمتة الهندسة والبيزنس بالذكاء الاصطناعي (Claude + n8n + AutoCAD)',
      titleEn: 'AI Automation for Engineering & Business Path',
      desc: 'من أساسيات الذكاء الاصطناعي إلى بناء لوحة تحكم ومسار عمل مؤتمت لشركتك.',
      steps: [
        { ref: 'ai-30min' }, { ref: 'azure-ai900' }, { ref: 'n8n-ai' }, { ref: 'claude-dashboard' },
        { t: 'تطبيق عملي: انشر لوحة تحكم لمشروعك على Netlify' }
      ]
    },
    {
      id: 'path-finance', cats: ['finance'],
      title: 'مسار المحاسبة والإدارة المالية للمقاولات والمشاريع',
      titleEn: 'Contracting Finance & Accounting Path',
      desc: 'من حصر الكميات والمستخلصات إلى ميزانية المشروع والتقارير المالية.',
      steps: [
        { ref: 'sec-intro' }, { ref: 'sec-pro' }, { ref: 'english-finance' },
        { t: 'تطبيق عملي: أعدّ مستخلصاً شهرياً باستخدام النموذج المرفق' }
      ]
    },
    {
      id: 'path-lang', cats: ['lang'],
      title: 'مسار اللغات المهنية والتقنية (الإنجليزية الهندسية والألمانية A2)',
      titleEn: 'Professional Languages Path (Engineering English & German A2)',
      desc: 'الإنجليزية التعاقدية للمهندسين، ثم الألمانية حتى مستوى A2. أضف روابطك المفضلة كخطوات في المسار.',
      steps: [
        { ref: 'english-finance' },
        { t: 'الألمانية A1–A2: أضف كورسك المفضل من يوتيوب عبر زر «أضف رابط»' },
        { t: 'تدرّب مع معلم على italki أو Preply (انظر بوابة المنصات)' }
      ]
    }
  ],

  platforms: [
    { group: 'الهندسة والكهرباء', groupEn: 'Engineering', items: [
      { name: 'Udemy', url: 'https://www.udemy.com/teaching/', note: 'انشر كورساتك المسجلة واربح من كل اشتراك.' },
      { name: 'Superprof SA', url: 'https://www.superprof.com/', note: 'دروس خصوصية بالساعة حضورياً أو عن بعد.' },
      { name: 'Preply', url: 'https://preply.com/en/teach', note: 'تدريس مباشر 1:1 بجدولك الخاص.' }
    ] },
    { group: 'اللغات', groupEn: 'Languages', items: [
      { name: 'italki', url: 'https://www.italki.com/', note: 'تعلّم أو درّس اللغات مع معلمين من أنحاء العالم.' },
      { name: 'Verbling', url: 'https://www.verbling.com/', note: 'حصص لغات مباشرة مع معلمين معتمدين.' },
      { name: 'Cambly', url: 'https://www.cambly.com/', note: 'محادثة إنجليزية فورية مع متحدثين أصليين.' }
    ] },
    { group: 'تأسيس الأطفال', groupEn: 'Kids', items: [
      { name: 'Orcas', url: 'https://www.orcas.io/', note: 'معلمون خصوصيون للمناهج المدرسية.' },
      { name: 'Noon Academy', url: 'https://www.noonacademy.com/', note: 'تعلّم جماعي تفاعلي للطلاب.' },
      { name: 'Outschool', url: 'https://outschool.com/', note: 'فصول صغيرة مباشرة للأطفال في العلوم والمهارات.' }
    ] }
  ],

  plans: [
    { id: 'free', role: 'trainee', title: 'المجاني', titleEn: 'Free', monthlySAR: 0,
      features: ['كل المكتبة المجانية من يوتيوب', 'خطتي ومراجعاتي والمفضلة', 'إضافة روابطك الخاصة'] },
    { id: 'all-access', role: 'trainee', title: 'الاشتراك الشامل', titleEn: 'All-Access', monthlySAR: 149, featured: true,
      features: ['كل الدبلومات المدفوعة مفتوحة', 'المرفقات الهندسية وملفات العمل', 'شهادة موثقة برمز QR لكل كورس', 'خصم 20% على الجلسات الاستشارية'] },
    { id: 'contractor', role: 'contractor_b2b', title: 'باقة المقاولين B2B', titleEn: 'Contractor B2B', monthlySAR: 990,
      features: ['حتى 10 مقاعد لفريق الشركة', 'كل مزايا الاشتراك الشامل', 'متابعة تقدم الفريق', 'جلسة استشارية شهرية مجانية'] }
  ]
};
