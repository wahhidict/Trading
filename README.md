# منصة التحليل الفني | TA Platform

منصة تحليل فني احترافية شبيهة بـ TradingView تعمل بالكامل داخل المتصفح — بدون خادم، بدون مزود بيانات حية، وبدون اشتراكات. أنت من يرفع ملفات الشموع بنفسك، وكل ما تفعله يُحفظ في المتصفح ولا يُنسى إلا بحذفك اليدوي لها.

## الميزات (المراحل 1–5 مكتملة)

- **واجهة داكنة احترافية** بتصميم TradingView: شريط علوي (الأداة/الفريم/نوع الشارت)، لوحة مراقبة Watchlist، مدير بيانات، شريط معلومات سفلي، شاشة كاملة.
- **محرك شارت KLineChart 10**: شموع، OHLC Bars، Line، Area، Volume، Crosshair مع OHLCV Tooltip، تقريب/تصغير، سحب، Auto Scale، Reset، Future Space.
- **Data Import Wizard**: رفع CSV / JSON / XLSX / ملفات MT5، تعرّف تلقائي على الأعمدة والتاريخ والوقت (metric/US/MT5 dotted/timestamp)، تعيين يدوي كخيار احتياطي، اختيار المنطقة الزمنية، معاينة قبل الاعتماد، فحص OHLC، اكتشاف المكرر، ترتيب زمني، وتقرير كامل بعد الاستيراد.
- **Data Manager**: استبدال ملف، دمج بيانات جديدة مع الموجود، حذف سوق، عدد الشموع وأول/آخر تاريخ، تصدير CSV احتياطي.
- **الفريمات**: من 1m إلى 1M — تُعرض فقط الفريمات المتاحة من بياناتك، والتجميع من الأصغر إلى الأكبر تلقائي (لا يُبتكر فريم أصغر من بيانات أكبر أبدًا).
- **حفظ دائم**: الشموع في IndexedDB والإعدادات في LocalStorage — تبقى بعد إغلاق المتصفح.
- **واجهة عربية RTL ↔ إنجليزية LTR** بزر تبديل واحد.
- **Drawing Engine يحفظ بالوقت والسعر** (ليس بإحداثيات الشاشة): Trend Line، Ray، خط أفقي/عمودي، مستطيل وممتد، قناتان، أسهم، فرشاة، نص، Fibonacci Retracement/Extension/Fan، OTE، Price/Date Range — مع Preview، سحب النقاط، Undo/Redo، قفل/إخفاء/نسخ/حذف، قائمة سياقية بالزر الأيمن، وMagnet Mode (Off/Weak/Strong) يلتصق بأسعار OHLC.
- **Long/Short Position**: مناطق ربح/خسارة، حساب R/R والمسافات بالنقاط ومستويات قابلة للتحريك المستقل، مع إعدادات مخاطرة (رصيد، نسبة مخاطرة، Tick Size، Point Value، Contract Size). حجم المركز يُحسب فقط عند توفر مواصفات الأداة.
- **أدوات ICT يدوية**: FVG، IFVG، Order Block، Breaker، Liquidity، EQH/EQL، Swing High/Low، BOS، MSS، CHoCH، Premium/Discount، Killzones.
- **البرمجيات الوحيدة هي الرسومات**: كل الرسومات محفوظة بـ Timestamp + Price وتظهر في كل الفريمات (اختياري).
- **مؤشرات فنية**: SMA، EMA، VWAP، Bollinger Bands، RSI، MACD، KDJ (Stochastic)، ATR، ADX، Volume، OBV — مع إعدادات وألوان مستقلة وإخفاء/حذف ونافذة رئيسية أو مستقلة.
- **Multi-Chart**: شارت واحد أو اثنان أو أربعة، لكل نافذة أداة/فريم/نوع مستقل، مع مزامنة اختيارية (Crosshair + Scroll + Zoom) عبر Timestamp.
- **Bar Replay**: إعادة تشغيل السوق من أي تاريخ، إخفاء الشموع المستقبلية، تشغيل/إيقاف/خطوة للأمام/للخلف/سرعة/إعادة/إنهاء، والمؤشرات لا ترى بيانات مستقبلية أثناء المحاكاة.
- **Workspace Manager**: حفظ تلقائي + مساحات مسماة + استعادة + تصدير/استيراد نسخة احتياطية JSON (رسومات + إعدادات + تخطيط).
- **اختصارات المفاتيح**: Esc لإلغاء الرسم، Delete لحذف الرسم المحدد، Ctrl+Z / Ctrl+Shift+Z للتراجع/الإعادة.

## التشغيل محليًا

```bash
npm install
npm run dev      # http://localhost:5173
```

## التشغيل في وضع الإنتاج

```bash
npm run build    # المخرجات في dist/
npm run preview
```

## الاختبارات

```bash
npm test         # vitest — اختبارات الاستيراد والفريمات
```

## النشر على GitHub Pages

التوزيع تلقائي عبر GitHub Actions (`.github/workflows/deploy.yml`) عند كل دفع إلى `main`:

1. من إعدادات المستودع: **Settings → Pages → Source → GitHub Actions**.
2. أي دفع لاحق إلى `main` سيبني المشروع وينشره على:
   `https://<username>.github.io/Trading/`
   (مسار الـ base يُحسب تلقائيًا في `vite.config.ts` من اسم المستودع).

## تنسيقات الاستيراد المدعومة

| الصيغة | مثال |
|---|---|
| CSV قياسي | `2024-01-15 10:00,1.0950,1.0961,1.0942,1.0957,1520` |
| MT5 CSV | `2024.01.15 10:00,1.0950,1.0961,1.0942,1.0957,1520,0,1` |
| Unix timestamp | `1704240000,100,110,99,105,1000` |
| فاصل `;` أو Tab | مدعوم تلقائيًا |
| JSON | مصفوفة كائنات/مصفوفات، أو `{klines: ...}` / `{data: ...}` / `{candles: ...}` |
| XLSX | أول ورقة عمل تُحوّل وتُفحص تلقائيًا |

## خط التطوير

- ✅ **المرحلة 1**: البنية Modular + استيراد البيانات + إدارة الأسواق + محرك الشارت.
- ✅ **المرحلة 2**: Drawing Engine + Long/Short Position.
- ✅ **المرحلة 3**: المؤشرات + تعدد الشارتات مع المزامنة.
- ✅ **المرحلة 4**: أدوات ICT + Bar Replay.
- ✅ **المرحلة 5**: Workspace Manager + النسخ الاحتياطي + الاختبارات.


## البنية

```
src/
├── core/            # الأنواع، الفريمات الزمنية، قاعدة البيانات (IndexedDB)
│   └── import/      # كشف الأعمدة، التحقق، التحليل
├── worker/          # Web Worker لمعالجة الملفات الكبيرة
├── features/
│   ├── chart/       # محرك الشارت (KLineChart 10) + paneData/paneRegistry
│   ├── drawings/    # Drawing Engine + Long/Short Position + لوحة الرسومات
│   ├── indicators/  # المؤشرات المخصصة + Indicators Panel
│   ├── tools/       # تعريفات الأدوات (رسم + ICT)
│   ├── workspaces/  # Workspace Manager + النسخ الاحتياطي
│   ├── import/      # Data Import Wizard
│   ├── markets/     # Watchlist + Data Manager
│   └── layout/      # TopBar, ToolBar, Sidebar, ReplayBar, Status/Context
├── i18n/            # العربية/الإنجليزية
└── state/           # إدارة الحالة (zustand)
```
