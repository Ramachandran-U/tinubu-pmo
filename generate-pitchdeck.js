const pptxgen = require('pptxgenjs');

const pres = new pptxgen();

// ── Design System (matching app's Material Design 3 palette) ──
const C = {
  primary: '004ac6',
  primaryDark: '003494',
  secondary: '2563eb',
  surface: 'f7f9fb',
  white: 'ffffff',
  dark: '191c1e',
  subtle: '434655',
  muted: '737686',
  accent: '10b981',
  error: 'ba1a1a',
  tertiary: '943700',
  gradient1: '004ac6',
  gradient2: '2563eb',
};

pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 inches
pres.author = 'Tinubu PMO';
pres.company = 'Tinubu Innoveo';
pres.subject = 'PMO Intelligence Platform v3.0 — Pitch Deck';

// ════════════════════════════════════════════════════════════════
// SLIDE 1 — TITLE / HERO
// ════════════════════════════════════════════════════════════════
const s1 = pres.addSlide();
s1.background = { fill: C.primary };

// Decorative circle
s1.addShape(pres.ShapeType.ellipse, {
  x: 9.5, y: -1.5, w: 5.5, h: 5.5,
  fill: { color: C.secondary, transparency: 70 }
});
s1.addShape(pres.ShapeType.ellipse, {
  x: -1.5, y: 4.5, w: 4, h: 4,
  fill: { color: C.primaryDark, transparency: 50 }
});

// Brand badge
s1.addShape(pres.ShapeType.roundRect, {
  x: 0.8, y: 0.7, w: 0.5, h: 0.5, rectRadius: 0.08,
  fill: { color: C.white }
});
s1.addText('T', {
  x: 0.8, y: 0.7, w: 0.5, h: 0.5,
  fontSize: 20, bold: true, color: C.primary,
  align: 'center', valign: 'middle'
});
s1.addText('Tinubu PMO', {
  x: 1.45, y: 0.72, w: 3, h: 0.45,
  fontSize: 16, bold: true, color: C.white, fontFace: 'Inter'
});

// Title
s1.addText('PMO Intelligence\nPlatform v3.0', {
  x: 0.8, y: 2.0, w: 7, h: 2.2,
  fontSize: 52, bold: true, color: C.white, fontFace: 'Inter',
  lineSpacingMultiple: 0.9
});

// Subtitle
s1.addText('Transform Zoho exports into real-time workforce analytics,\nsquad-based views, attendance grids, and compliance tracking.', {
  x: 0.8, y: 4.2, w: 6.5, h: 1.0,
  fontSize: 16, color: C.white, fontFace: 'Inter',
  transparency: 20, lineSpacingMultiple: 1.3
});

// Bottom stats row
const stats = [
  { num: '30+', label: 'Analytics Features' },
  { num: '19', label: 'Squad Projects' },
  { num: '9', label: 'Global Offices' },
  { num: '113', label: 'Employees Tracked' }
];
stats.forEach((s, i) => {
  const xPos = 0.8 + i * 2.5;
  s1.addText(s.num, {
    x: xPos, y: 5.8, w: 2, h: 0.6,
    fontSize: 36, bold: true, color: C.white, fontFace: 'Inter'
  });
  s1.addText(s.label, {
    x: xPos, y: 6.35, w: 2, h: 0.3,
    fontSize: 10, color: C.white, fontFace: 'Inter',
    bold: true, transparency: 30
  });
});

// ════════════════════════════════════════════════════════════════
// SLIDE 2 — THE PROBLEM
// ════════════════════════════════════════════════════════════════
const s2 = pres.addSlide();
s2.background = { fill: C.white };

s2.addText('THE CHALLENGE', {
  x: 0.8, y: 0.5, w: 4, h: 0.3,
  fontSize: 10, bold: true, color: C.primary, fontFace: 'Inter',
  charSpacing: 4
});

s2.addText('Your PMO is flying blind.', {
  x: 0.8, y: 0.9, w: 10, h: 0.7,
  fontSize: 36, bold: true, color: C.dark, fontFace: 'Inter'
});

s2.addText('Every month, your team downloads Excel files from Zoho, manually cross-references data,\nand builds reports that are outdated by the time they reach leadership.', {
  x: 0.8, y: 1.7, w: 10, h: 0.7,
  fontSize: 14, color: C.subtle, fontFace: 'Inter', lineSpacingMultiple: 1.4
});

const pains = [
  { icon: 'X', title: 'No Real-Time Visibility', desc: 'KPIs are stale the moment the report is emailed. Decisions are based on last month\'s data.' },
  { icon: 'X', title: 'Burnout Goes Undetected', desc: 'Employees logging 200+ hours are invisible until they submit medical leave or resign.' },
  { icon: 'X', title: 'No Squad-Level View', desc: '19 project squads across 4 locations — no single view of who is allocated where.' },
  { icon: 'X', title: 'Compliance is a Guessing Game', desc: 'Missed timesheets are invisible. Finance can\'t bill what isn\'t tracked.' },
  { icon: 'X', title: 'Zero Forecasting', desc: 'No capacity projection means sales commits delivery dates without data backing.' },
  { icon: 'X', title: 'Manual Effort', desc: 'PMO spends 2+ days/month building reports instead of acting on insights.' }
];

pains.forEach((p, i) => {
  const col = i % 3;
  const row = Math.floor(i / 3);
  const xPos = 0.8 + col * 4;
  const yPos = 2.8 + row * 2.1;

  s2.addShape(pres.ShapeType.roundRect, {
    x: xPos, y: yPos, w: 3.7, h: 1.8, rectRadius: 0.12,
    fill: { color: 'fef2f2' },
    line: { color: 'fecaca', width: 1 }
  });

  s2.addShape(pres.ShapeType.ellipse, {
    x: xPos + 0.2, y: yPos + 0.25, w: 0.35, h: 0.35,
    fill: { color: C.error }
  });
  s2.addText(p.icon, {
    x: xPos + 0.2, y: yPos + 0.25, w: 0.35, h: 0.35,
    fontSize: 14, bold: true, color: C.white, fontFace: 'Inter',
    align: 'center', valign: 'middle'
  });

  s2.addText(p.title, {
    x: xPos + 0.7, y: yPos + 0.2, w: 2.8, h: 0.35,
    fontSize: 13, bold: true, color: C.dark, fontFace: 'Inter'
  });
  s2.addText(p.desc, {
    x: xPos + 0.2, y: yPos + 0.75, w: 3.3, h: 0.9,
    fontSize: 10.5, color: C.subtle, fontFace: 'Inter', lineSpacingMultiple: 1.3
  });
});

// ════════════════════════════════════════════════════════════════
// SLIDE 3 — THE SOLUTION
// ════════════════════════════════════════════════════════════════
const s3 = pres.addSlide();
s3.background = { fill: C.surface };

s3.addText('THE SOLUTION', {
  x: 0.8, y: 0.5, w: 4, h: 0.3,
  fontSize: 10, bold: true, color: C.primary, fontFace: 'Inter',
  charSpacing: 4
});

s3.addText('Upload three files. Get everything.', {
  x: 0.8, y: 0.9, w: 10, h: 0.7,
  fontSize: 36, bold: true, color: C.dark, fontFace: 'Inter'
});

// Flow diagram
const flowSteps = [
  { label: 'Zoho Export', sub: '3 Excel files\n(Timelog, Attendance,\nDemand Capacity)', color: C.muted },
  { label: 'Drag & Drop', sub: 'Upload in\n2 seconds', color: C.secondary },
  { label: 'Auto-ETL', sub: 'Parse, validate\nSkye exclusion', color: C.primary },
  { label: 'Live Dashboards', sub: '30+ analytics\nDept/Squad toggle', color: C.accent },
];
flowSteps.forEach((s, i) => {
  const xPos = 0.8 + i * 3.15;
  s3.addShape(pres.ShapeType.roundRect, {
    x: xPos, y: 1.9, w: 2.6, h: 1.5, rectRadius: 0.12,
    fill: { color: C.white },
    shadow: { type: 'outer', blur: 6, offset: 2, color: '000000', opacity: 0.08 }
  });
  s3.addShape(pres.ShapeType.ellipse, {
    x: xPos + 0.9, y: 2.05, w: 0.8, h: 0.8,
    fill: { color: s.color, transparency: 85 }
  });
  s3.addText(String(i + 1), {
    x: xPos + 0.9, y: 2.05, w: 0.8, h: 0.8,
    fontSize: 24, bold: true, color: s.color, fontFace: 'Inter',
    align: 'center', valign: 'middle'
  });
  s3.addText(s.label, {
    x: xPos, y: 2.9, w: 2.6, h: 0.35,
    fontSize: 13, bold: true, color: C.dark, fontFace: 'Inter', align: 'center'
  });
  s3.addText(s.sub, {
    x: xPos, y: 3.2, w: 2.6, h: 0.6,
    fontSize: 10, color: C.muted, fontFace: 'Inter', align: 'center', lineSpacingMultiple: 1.2
  });
  if (i < 3) {
    s3.addText('\u2192', {
      x: xPos + 2.6, y: 2.3, w: 0.55, h: 0.5,
      fontSize: 20, color: C.muted, fontFace: 'Inter', align: 'center', valign: 'middle'
    });
  }
});

// Feature grid
const features = [
  { title: 'Portfolio KPIs', desc: 'MoM trends, sparklines, Approval %, designation chart', tag: 'PORTFOLIO' },
  { title: 'Squad Allocation', desc: 'Project-based squads with billable/non-billable split', tag: 'RESOURCES' },
  { title: 'Attendance Grid', desc: 'Employee x day grid with color-coded status cells', tag: 'TIMESHEET' },
  { title: 'Compliance Tracker', desc: 'Per-employee missed timesheet days report', tag: 'TIMESHEET' },
  { title: 'Heatmap Roster', desc: 'Multi-month hours with 5-tier color scale', tag: 'RESOURCES' },
  { title: 'PMO Alert Feed', desc: 'Auto-detect overload, bench, and compliance drops', tag: 'PORTFOLIO' },
  { title: 'Burnout Detection', desc: 'Flag employees >160h for consecutive months', tag: 'PREDICTIVE' },
  { title: 'Dept/Squad Toggle', desc: 'Global switch between department and squad views', tag: 'GLOBAL' },
];

features.forEach((f, i) => {
  const col = i % 4;
  const row = Math.floor(i / 4);
  const xPos = 0.8 + col * 3.15;
  const yPos = 4.4 + row * 1.6;

  s3.addShape(pres.ShapeType.roundRect, {
    x: xPos, y: yPos, w: 2.8, h: 1.3, rectRadius: 0.1,
    fill: { color: C.white },
    line: { color: 'e5e7eb', width: 0.5 }
  });
  s3.addText(f.tag, {
    x: xPos + 0.15, y: yPos + 0.12, w: 1.2, h: 0.22,
    fontSize: 7, bold: true, color: C.primary, fontFace: 'Inter',
    charSpacing: 2
  });
  s3.addText(f.title, {
    x: xPos + 0.15, y: yPos + 0.4, w: 2.5, h: 0.3,
    fontSize: 12, bold: true, color: C.dark, fontFace: 'Inter'
  });
  s3.addText(f.desc, {
    x: xPos + 0.15, y: yPos + 0.75, w: 2.5, h: 0.4,
    fontSize: 9.5, color: C.muted, fontFace: 'Inter', lineSpacingMultiple: 1.2
  });
});

// ════════════════════════════════════════════════════════════════
// SLIDE 4 — BY THE NUMBERS / IMPACT
// ════════════════════════════════════════════════════════════════
const s4 = pres.addSlide();
s4.background = { fill: C.white };

s4.addText('IMPACT', {
  x: 0.8, y: 0.5, w: 4, h: 0.3,
  fontSize: 10, bold: true, color: C.primary, fontFace: 'Inter',
  charSpacing: 4
});

s4.addText('From data chaos to decision clarity.', {
  x: 0.8, y: 0.9, w: 10, h: 0.7,
  fontSize: 36, bold: true, color: C.dark, fontFace: 'Inter'
});

const impacts = [
  { num: '2s', label: 'Upload to Dashboard', sub: 'vs 2 days manual reporting' },
  { num: '19', label: 'Project Squads', sub: 'Full squad-level visibility' },
  { num: '35+', label: 'API Endpoints', sub: 'Every data cut available instantly' },
  { num: '0', label: 'Excel Files to Open', sub: 'Self-service for every stakeholder' },
];

impacts.forEach((m, i) => {
  const xPos = 0.8 + i * 3.15;
  s4.addShape(pres.ShapeType.roundRect, {
    x: xPos, y: 1.9, w: 2.8, h: 2.2, rectRadius: 0.12,
    fill: { color: C.surface },
    line: { color: 'e5e7eb', width: 0.5 }
  });
  s4.addText(m.num, {
    x: xPos, y: 2.1, w: 2.8, h: 0.9,
    fontSize: 48, bold: true, color: C.primary, fontFace: 'Inter', align: 'center'
  });
  s4.addText(m.label, {
    x: xPos, y: 3.0, w: 2.8, h: 0.35,
    fontSize: 13, bold: true, color: C.dark, fontFace: 'Inter', align: 'center'
  });
  s4.addText(m.sub, {
    x: xPos, y: 3.35, w: 2.8, h: 0.4,
    fontSize: 10, color: C.muted, fontFace: 'Inter', align: 'center'
  });
});

// Who benefits table
s4.addText('Who Benefits', {
  x: 0.8, y: 4.5, w: 5, h: 0.4,
  fontSize: 18, bold: true, color: C.dark, fontFace: 'Inter'
});

const roles = [
  { role: 'CXO / Leadership', benefit: 'Portfolio summary with approval %, MoM trends, designation breakdown' },
  { role: 'PMO Director', benefit: 'Alert feed + squad allocation + compliance tracker + heatmaps' },
  { role: 'Delivery Head', benefit: 'Squad-based roster with heatmap + burnout risk flags' },
  { role: 'Finance', benefit: 'Entity billing + Skye exclusion + non-billable breakdown' },
  { role: 'HR / People Ops', benefit: 'Attendance grid + leave patterns + missed timesheet report' },
];

roles.forEach((r, i) => {
  const yPos = 5.05 + i * 0.42;
  const bg = i % 2 === 0 ? C.surface : C.white;
  s4.addShape(pres.ShapeType.rect, {
    x: 0.8, y: yPos, w: 11.7, h: 0.4,
    fill: { color: bg }
  });
  s4.addText(r.role, {
    x: 1.0, y: yPos, w: 3, h: 0.4,
    fontSize: 11, bold: true, color: C.dark, fontFace: 'Inter', valign: 'middle'
  });
  s4.addText(r.benefit, {
    x: 4.2, y: yPos, w: 8, h: 0.4,
    fontSize: 11, color: C.subtle, fontFace: 'Inter', valign: 'middle'
  });
});

// ════════════════════════════════════════════════════════════════
// SLIDE 5 — WHAT'S NEXT / CTA
// ════════════════════════════════════════════════════════════════
const s5 = pres.addSlide();
s5.background = { fill: C.primary };

s5.addShape(pres.ShapeType.ellipse, {
  x: 10, y: -2, w: 6, h: 6,
  fill: { color: C.secondary, transparency: 75 }
});
s5.addShape(pres.ShapeType.ellipse, {
  x: -2, y: 5, w: 5, h: 5,
  fill: { color: C.primaryDark, transparency: 60 }
});

s5.addText('ROADMAP', {
  x: 0.8, y: 0.5, w: 4, h: 0.3,
  fontSize: 10, bold: true, color: C.white, fontFace: 'Inter',
  charSpacing: 4, transparency: 30
});

s5.addText('Built for today.\nReady for tomorrow.', {
  x: 0.8, y: 1.0, w: 8, h: 1.4,
  fontSize: 40, bold: true, color: C.white, fontFace: 'Inter',
  lineSpacingMultiple: 1.0
});

const roadmap = [
  { phase: 'DELIVERED', items: '30+ features \u2022 Squad allocation \u2022 Attendance grid \u2022 Compliance tracker \u2022 Skye exclusion \u2022 Dept/Squad toggle \u2022 Burnout detection', color: C.accent },
  { phase: 'NEXT', items: 'User authentication \u2022 Project profitability \u2022 Dark mode \u2022 Data exports \u2022 SOW tracking', color: 'f59e0b' },
  { phase: 'FUTURE', items: 'Skills matrix \u2022 Resource optimizer \u2022 Automated imports \u2022 AI-powered insights', color: 'c084fc' },
];

roadmap.forEach((r, i) => {
  const yPos = 2.8 + i * 1.3;
  s5.addShape(pres.ShapeType.roundRect, {
    x: 0.8, y: yPos, w: 10, h: 1.0, rectRadius: 0.1,
    fill: { color: C.white, transparency: 88 }
  });
  s5.addShape(pres.ShapeType.roundRect, {
    x: 1.0, y: yPos + 0.2, w: 1.2, h: 0.28, rectRadius: 0.05,
    fill: { color: r.color }
  });
  s5.addText(r.phase, {
    x: 1.0, y: yPos + 0.2, w: 1.2, h: 0.28,
    fontSize: 8, bold: true, color: C.white, fontFace: 'Inter',
    align: 'center', valign: 'middle', charSpacing: 2
  });
  s5.addText(r.items, {
    x: 2.4, y: yPos + 0.15, w: 8, h: 0.38,
    fontSize: 11, color: C.white, fontFace: 'Inter', valign: 'middle'
  });
});

// CTA
s5.addShape(pres.ShapeType.roundRect, {
  x: 0.8, y: 6.2, w: 4.5, h: 0.7, rectRadius: 0.1,
  fill: { color: C.white }
});
s5.addText('Start your PMO transformation today \u2192', {
  x: 0.8, y: 6.2, w: 4.5, h: 0.7,
  fontSize: 14, bold: true, color: C.primary, fontFace: 'Inter',
  align: 'center', valign: 'middle'
});

s5.addText('github.com/Ramachandran-U/tinubu-pmo', {
  x: 6, y: 6.35, w: 6, h: 0.35,
  fontSize: 11, color: C.white, fontFace: 'Inter',
  transparency: 40, align: 'right'
});

// ── Generate ──
const outPath = './Tinubu_PMO_PitchDeck.pptx';
pres.writeFile({ fileName: outPath })
  .then(() => console.log(`Pitch deck saved to: ${outPath}`))
  .catch(err => console.error('Error:', err));
