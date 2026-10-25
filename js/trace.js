import { $, $$, toast, makeCanvas, freeCanvas, showScreen } from './util.js';
import { TOOLS, Stroke } from './brushes.js';
import { ICON, toolUpright } from './icons.js';
import { speak, stopSpeaking } from './speech.js';
import { pressureOf } from './editor.js';
import { starsOf, saveStars } from './progress.js';

const TR_TOOLS = ['marker', 'crayon', 'pencil', 'eraser'];
const TR_COLORS = ['#E53935', '#FB8C00', '#FDD835', '#43A047', '#1E88E5', '#7E57C2', '#EC407A', '#212121'];
// 굵기: 한 칸 크기에 대한 비율
const TR_SIZE = { crayon: 0.075, pencil: 0.05, marker: 0.075, eraser: 0.16 };
const KO_FONT = (px) => `700 ${px}px "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif`;
// 알파벳은 아이 글씨 교본용 글꼴 Andika (a·g가 손글씨 모양)
const EN_FONT = (px) => `700 ${px}px Andika, "Arial Rounded MT Bold", "Helvetica Neue", Arial, sans-serif`;
const MAX_LINES = 4;
const MSG = {
  ko: ['선을 따라 다시 써 볼까요?', '좋아요! 조금만 더!', '잘했어요!', '참 잘했어요!'],
  en: ["Let's try again!", 'Good try!', 'Great job!', 'Excellent!'],
};

const el = {};
let deck = null;
let idx = 0;
let item = null;
let lang = 'ko';
let opts = {};
let tool = 'marker';
let lay = null; // 종이 배치: 한글 {kind:'ko', cols, rows} · 영어 {kind:'en', lines}
let color = '#E53935';
let W = 0;
let H = 0;
let dpr = 1;
let gctx, ictx, sctx, backup, bctx;
let stroke = null;
let strokeId = null;
let penSeen = false;
let undo = [];

export function initTrace() {
  for (const [k, id] of Object.entries({
    stage: 'trStage', paper: 'trPaper', guide: 'trGuide', ink: 'trInk', stroke: 'trStroke', title: 'trTitle', count: 'trCount',
    stars: 'trStars', name: 'trGlyphName', emoji: 'trEmoji', word: 'trWord', example: 'trExample', speak: 'trSpeak',
    tools: 'trTools', colors: 'trColors', result: 'trResult', resStars: 'resStars', resMsg: 'resMsg',
  })) el[k] = document.getElementById(id);
  gctx = el.guide.getContext('2d');
  ictx = el.ink.getContext('2d');
  sctx = el.stroke.getContext('2d');
  backup = makeCanvas(1, 1);
  bctx = backup.getContext('2d');

  el.colors.innerHTML = TR_COLORS.map((c) => `<button class="sw" data-c="${c}" style="--c:${c}" aria-label="${c}"></button>`).join('');
  el.colors.addEventListener('click', (e) => {
    const b = e.target.closest('.sw');
    if (!b) return;
    color = b.dataset.c;
    if (tool === 'eraser') tool = 'crayon';
    renderTray();
  });
  el.tools.addEventListener('click', (e) => {
    const b = e.target.closest('.tray-tool');
    if (!b) return;
    tool = b.dataset.tool;
    renderTray();
  });
  renderTray();

  const p = el.paper;
  const stop = (e) => e.preventDefault();
  p.addEventListener('touchstart', stop, { passive: false });
  p.addEventListener('touchmove', stop, { passive: false });
  p.addEventListener('contextmenu', stop);
  p.addEventListener('pointerdown', onDown);
  p.addEventListener('pointermove', onMove);
  p.addEventListener('pointerup', onUp);
  p.addEventListener('pointercancel', onUp);

  $('#trBack').addEventListener('click', close);
  $('#trPrev').addEventListener('click', () => idx > 0 && load(idx - 1));
  $('#trNext').addEventListener('click', next);
  el.speak.addEventListener('click', () => say(item.say));
  el.example.addEventListener('click', () => say(item.ex || item.t));
  $('#trUndo').addEventListener('click', doUndo);
  $('#trClear').addEventListener('click', clearInk);
  $('#trDone').addEventListener('click', check);
  $('#resAgain').addEventListener('click', () => {
    el.result.hidden = true;
    clearInk();
  });
  $('#resNext').addEventListener('click', () => {
    el.result.hidden = true;
    next();
  });
  window.addEventListener('resize', () => deck && $('#trace').classList.contains('active') && layout(true));
}

function renderTray() {
  el.tools.innerHTML = TR_TOOLS.map(
    (id) => `<button class="tray-tool ${id === tool ? 'on' : ''}" data-tool="${id}" aria-label="${TOOLS.find((t) => t.id === id).name}">${toolUpright(id, color)}</button>`,
  ).join('');
  $$('.sw', el.colors).forEach((b) => b.classList.toggle('on', b.dataset.c === color && tool !== 'eraser'));
}

export function openTrace(d, i, o) {
  deck = d;
  opts = o;
  showScreen('trace');
  load(i);
}

function close() {
  stopSpeaking();
  el.result.hidden = true;
  showScreen('library');
  for (const c of [el.guide, el.ink, el.stroke, backup]) {
    c.width = 1;
    c.height = 1;
  }
  deck = null;
  opts.onClose?.();
}

function next() {
  if (idx + 1 < deck.items.length) load(idx + 1);
  else {
    toast(lang === 'en' ? 'All done! 🎉' : '다 썼어요! 🎉');
    close();
  }
}

function load(i) {
  idx = i;
  item = deck.items[i];
  lang = item.lang || deck.lang;
  el.title.textContent = deck.title;
  el.count.textContent = `${i + 1} / ${deck.items.length}`;
  el.name.textContent = deck.word ? '' : item.name;
  el.name.hidden = deck.word || !item.name;
  el.emoji.textContent = item.em || '';
  el.emoji.hidden = !item.em;
  // 영어 예시 낱말은 첫 글자를 강조한다 (apple → *a*pple)
  el.word.textContent = '';
  const ex = item.ex || item.t;
  if (lang === 'en' && !deck.word && ex[0].toLowerCase() === item.t.toLowerCase()) {
    const b = document.createElement('b');
    b.textContent = ex[0];
    el.word.append(b, ex.slice(1));
  } else el.word.textContent = ex;
  el.word.style.fontFamily = lang === 'en' ? 'Andika, "Arial Rounded MT Bold", sans-serif' : '';
  $('#trPrev').disabled = i === 0;
  showStars(starsOf(opts.keyOf(deck, item)));
  undo = [];
  layout(false);
  // 글꼴을 다 받기 전에 그리면 다른 글꼴로 나오므로, 받은 뒤 한 번 더 그린다
  if (lang === 'en') document.fonts?.load(EN_FONT(100)).then(() => item === deck?.items[i] && layout(true));
  say(item.say);
}

function showStars(n) {
  el.stars.innerHTML = [1, 2, 3].map((k) => ICON.star.replace('<svg', `<svg class="${k <= n ? 'on' : ''}"`)).join('');
}

function say(text) {
  el.speak.classList.add('talking');
  const done = () => el.speak.classList.remove('talking');
  if (!speak(text, lang, done)) toast('이 기기에서는 읽어주기를 쓸 수 없어요');
  setTimeout(done, 6000);
}

// ---------- 종이 크기·안내 글자 ----------
const chars = () => [...item.t];

// 영어 낱말을 L줄로 나눈다. 띄어쓰기에서 먼저 나누고, 너무 긴 낱말은 글자 단위로 나눈다
function wrapLines(text, L, x) {
  if (L === 1) return [text];
  const target = x.measureText(text).width / L;
  const pieces = [];
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const ww = x.measureText(w).width;
    if (ww <= target * 1.15) {
      pieces.push(w);
      continue;
    }
    const per = Math.ceil(w.length / Math.ceil(ww / target));
    for (let i = 0; i < w.length; i += per) pieces.push(w.slice(i, i + per));
  }
  const lines = [];
  let cur = '';
  for (const p of pieces) {
    const cand = cur ? `${cur} ${p}` : p;
    if (cur && x.measureText(cand).width > target * 1.15) {
      lines.push(cur);
      cur = p;
    } else cur = cand;
  }
  if (cur) lines.push(cur);
  return lines;
}

// 낱말이 길어도 글자가 작아지지 않게, 칸(한글)이나 줄(영어)을 여러 줄로 나눠 가장 큰 글자가 나오는 배치를 고른다
function plan(sw, sh) {
  if (lang === 'ko') {
    const n = Math.max(1, chars().length);
    let best = null;
    for (let c = 1; c <= n; c++) {
      const r = Math.ceil(n / c);
      if (r > MAX_LINES) continue;
      const size = Math.min(sw / c, sh / r);
      if (!best || size > best.size + 0.5) best = { c, r, size };
    }
    return { kind: 'ko', cols: best.c, rows: best.r, w: best.size * best.c, h: best.size * best.r };
  }
  const x = makeCanvas(1, 1).getContext('2d');
  x.font = EN_FONT(100);
  const letters = item.t.replace(/\s/g, '').length;
  let best = null;
  for (let L = 1; L <= Math.min(MAX_LINES, letters); L++) {
    const lines = wrapLines(item.t, L, x);
    const maxW = Math.max(...lines.map((l) => x.measureText(l).width));
    // 한 줄 높이 b일 때 글자 크기는 0.62b → 글자 폭 = maxW/100 × 0.62b
    const b = Math.min(sh / lines.length, (sw * 0.9 * 100) / (0.62 * maxW));
    if (!best || b > best.b + 0.5) best = { lines, b, maxW };
  }
  const w = Math.min(sw, Math.max(best.b * 1.25, (best.maxW * 0.62 * best.b) / 100 + best.b * 0.5));
  return { kind: 'en', lines: best.lines, w, h: best.b * best.lines.length };
}

function layout(keepInk) {
  const cs = getComputedStyle(el.stage);
  const sw = Math.min(900, el.stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
  const sh = el.stage.clientHeight - 16;
  lay = plan(sw, sh);
  const w = Math.max(120, Math.floor(lay.w));
  const h = Math.max(80, Math.floor(lay.h));
  el.paper.style.width = w + 'px';
  el.paper.style.height = h + 'px';
  dpr = Math.min(2, window.devicePixelRatio || 1);
  let old = null;
  if (keepInk && W) {
    old = makeCanvas(W, H);
    old.getContext('2d').drawImage(el.ink, 0, 0);
  }
  W = Math.round(w * dpr);
  H = Math.round(h * dpr);
  for (const c of [el.guide, el.ink, el.stroke, backup]) {
    c.width = W;
    c.height = H;
  }
  if (old) {
    ictx.drawImage(old, 0, 0, W, H);
    freeCanvas(old);
  }
  drawGuide(gctx, W, H, false);
}

// 한 칸(한글) · 한 줄(영어) 크기 = 붓 굵기의 기준
const unit = () => (lay.kind === 'ko' ? W / lay.cols : H / lay.lines.length);

// 글자 실제 모양(바운딩 박스)을 칸 가운데에 maxW×maxH 안으로 맞춰 그린다
function glyphFit(ctx, ch, cx, cy, maxW, maxH, score) {
  ctx.font = KO_FONT(100);
  const m = ctx.measureText(ch);
  const bw = m.actualBoundingBoxLeft + m.actualBoundingBoxRight || 60;
  const bh = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent || 60;
  const k = Math.min(maxW / bw, maxH / bh);
  const size = 100 * k;
  ctx.font = KO_FONT(size);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const x = cx - (bw * k) / 2 + m.actualBoundingBoxLeft * k;
  const y = cy - (bh * k) / 2 + m.actualBoundingBoxAscent * k;
  paintText(ctx, ch, x, y, size, score);
}

function paintText(ctx, t, x, y, size, score) {
  if (score) {
    ctx.fillStyle = '#000';
    ctx.fillText(t, x, y);
    return;
  }
  ctx.fillStyle = '#EEE8DF';
  ctx.fillText(t, x, y);
  ctx.save();
  ctx.strokeStyle = '#C3B8AA';
  // 자모처럼 작은 글자는 크게 키워 그리므로, 점선 굵기는 종이 높이 기준으로 제한한다
  const s = Math.min(size, H);
  ctx.lineWidth = Math.max(1.5, s * 0.01);
  ctx.setLineDash([s * 0.03, s * 0.024]);
  ctx.lineJoin = 'round';
  ctx.strokeText(t, x, y);
  ctx.restore();
}

function dashed(ctx, x0, y0, x1, y1, color, lw, dash) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}

function drawGuide(ctx, w, h, score) {
  ctx.clearRect(0, 0, w, h);
  const lw = Math.max(1, dpr * 1.2);
  if (lay.kind === 'ko') {
    // 한글·숫자: 글자마다 정사각 칸 + 가운데 십자 점선. 칸이 넘치면 다음 줄로
    const cw = w / lay.cols;
    const ch = h / lay.rows;
    chars().forEach((c, i) => {
      const x0 = (i % lay.cols) * cw;
      const y0 = Math.floor(i / lay.cols) * ch;
      if (!score) {
        if (x0 > 0) dashed(ctx, x0, y0, x0, y0 + ch, '#E4DACD', lw * 1.5, []);
        if (y0 > 0) dashed(ctx, x0, y0, x0 + cw, y0, '#E4DACD', lw * 1.5, []);
        dashed(ctx, x0 + cw / 2, y0 + ch * 0.04, x0 + cw / 2, y0 + ch * 0.96, '#EEE6DA', lw, [8 * dpr, 7 * dpr]);
        dashed(ctx, x0 + cw * 0.04, y0 + ch / 2, x0 + cw * 0.96, y0 + ch / 2, '#EEE6DA', lw, [8 * dpr, 7 * dpr]);
      }
      if (c.trim()) glyphFit(ctx, c, x0 + cw / 2, y0 + ch / 2, cw * 0.72, ch * 0.72, score);
    });
    return;
  }
  // 영어: 줄마다 네 줄 공책 (윗줄 · 가운데 점선 · 밑줄 · 아랫줄)
  const band = h / lay.lines.length;
  lay.lines.forEach((line, li) => {
    const top = li * band;
    let size = band * 0.62;
    ctx.font = EN_FONT(size);
    const capA = ctx.measureText('H').actualBoundingBoxAscent || size * 0.7;
    const xA = ctx.measureText('x').actualBoundingBoxAscent || size * 0.5;
    const desc = ctx.measureText('g').actualBoundingBoxDescent || size * 0.2;
    const base = top + (band + capA - desc) / 2 + desc * 0.1;
    if (!score) {
      const pad = w * 0.03;
      dashed(ctx, pad, base - capA, w - pad, base - capA, '#E4DACD', lw * 1.5, []);
      dashed(ctx, pad, base - xA, w - pad, base - xA, '#E9DFD2', lw, [8 * dpr, 7 * dpr]);
      dashed(ctx, pad, base, w - pad, base, '#F2B8AA', lw * 1.8, []);
      dashed(ctx, pad, base + desc, w - pad, base + desc, '#E4DACD', lw * 1.5, []);
    }
    let tw = ctx.measureText(line).width;
    if (tw > w * 0.94) {
      size *= (w * 0.94) / tw;
      ctx.font = EN_FONT(size);
      tw = ctx.measureText(line).width;
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    paintText(ctx, line, (w - tw) / 2, base, size, score);
  });
}

// ---------- 쓰기 ----------
function toInk(e) {
  const r = el.paper.getBoundingClientRect();
  return [((e.clientX - r.left) * W) / r.width, ((e.clientY - r.top) * H) / r.height];
}

function onDown(e) {
  if (e.pointerType === 'pen') penSeen = true;
  if (e.pointerType === 'touch' && penSeen) return; // 펜슬을 쓰면 손바닥·손가락은 무시
  if (stroke || !el.result.hidden) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  try {
    el.paper.setPointerCapture(e.pointerId);
  } catch {}
  bctx.clearRect(0, 0, W, H);
  bctx.drawImage(el.ink, 0, 0);
  const t = TOOLS.find((x) => x.id === tool);
  // 글씨 쓰기용 마커는 사인펜처럼 진하게 (색칠용 마커는 반투명)
  const opacity = t.id === 'marker' ? 1 : t.opacity;
  el.stroke.style.opacity = t.layered ? opacity : 1;
  stroke = new Stroke(t, color, unit() * TR_SIZE[tool], opacity, ictx, sctx);
  strokeId = e.pointerId;
  const [x, y] = toInk(e);
  stroke.add(x, y, pressureOf(e));
}

function onMove(e) {
  if (!stroke || e.pointerId !== strokeId) return;
  const list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
  for (const ev of list && list.length ? list : [e]) {
    const [x, y] = toInk(ev);
    stroke.add(x, y, pressureOf(ev));
  }
}

function onUp(e) {
  if (!stroke || e.pointerId !== strokeId) return;
  const s = stroke;
  stroke = null;
  s.finish();
  s.commit(W, H);
  const r = s.rect(W, H);
  if (r) {
    undo.push({ x: r[0], y: r[1], img: bctx.getImageData(r[0], r[1], r[2], r[3]) });
    if (undo.length > 30) undo.shift();
  }
}

function doUndo() {
  const u = undo.pop();
  if (u) ictx.putImageData(u.img, u.x, u.y);
}

function clearInk() {
  undo.push({ x: 0, y: 0, img: ictx.getImageData(0, 0, W, H) });
  ictx.clearRect(0, 0, W, H);
}

// ---------- 채점 ----------
// 작은 해상도에서 글자 칸을 얼마나 덮었는지(덮은 비율)와, 글자 밖에 얼마나 썼는지(벗어난 비율)로 별 0~3개
function dilate(m, w, h, r) {
  let cur = m;
  for (let k = 0; k < r; k++) {
    const out = cur.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!cur[i]) continue;
        if (x > 0) out[i - 1] = 1;
        if (x < w - 1) out[i + 1] = 1;
        if (y > 0) out[i - w] = 1;
        if (y < h - 1) out[i + w] = 1;
      }
    }
    cur = out;
  }
  return cur;
}

function grade() {
  const s = 180 / Math.max(W, H);
  const w = Math.max(1, Math.round(W * s));
  const h = Math.max(1, Math.round(H * s));
  const gc = makeCanvas(w, h);
  const g = gc.getContext('2d', { willReadFrequently: true });
  g.scale(s, s);
  drawGuide(g, W, H, true);
  const gd = g.getImageData(0, 0, w, h).data;
  const kc = makeCanvas(w, h);
  const k = kc.getContext('2d', { willReadFrequently: true });
  k.drawImage(el.ink, 0, 0, w, h);
  const kd = k.getImageData(0, 0, w, h).data;
  const n = w * h;
  const gm = new Uint8Array(n);
  const im = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    gm[i] = gd[i * 4 + 3] > 100 ? 1 : 0;
    im[i] = kd[i * 4 + 3] > 30 ? 1 : 0;
  }
  const imD = dilate(im, w, h, 1);
  const gmD = dilate(gm, w, h, 2);
  let glyphN = 0, covered = 0, inkN = 0, outside = 0;
  for (let i = 0; i < n; i++) {
    if (gm[i]) {
      glyphN++;
      if (imD[i]) covered++;
    }
    if (im[i]) {
      inkN++;
      if (!gmD[i]) outside++;
    }
  }
  freeCanvas(gc);
  freeCanvas(kc);
  if (!glyphN || inkN < glyphN * 0.12) return 0;
  const cov = covered / glyphN;
  const out = outside / inkN;
  if (cov >= 0.6 && out <= 0.3) return 3;
  if (cov >= 0.42 && out <= 0.45) return 2;
  if (cov >= 0.22) return 1;
  return 0;
}

function check() {
  if (stroke) return;
  const n = grade();
  saveStars(opts.keyOf(deck, item), n);
  showStars(Math.max(n, starsOf(opts.keyOf(deck, item))));
  el.resStars.innerHTML = [1, 2, 3].map((k) => ICON.star.replace('<svg', `<svg class="${k <= n ? 'on' : ''}"`)).join('');
  const msg = MSG[lang][n];
  el.resMsg.textContent = msg;
  $('#resNext').textContent = idx + 1 < deck.items.length ? (lang === 'en' ? 'Next' : '다음 글자') : '끝내기';
  $('#resAgain').textContent = lang === 'en' ? 'Try again' : '다시 쓰기';
  el.result.hidden = false;
  speak(msg, lang);
  if (n === 3) confetti();
}

function confetti() {
  const colors = ['#FF6A4D', '#FFC83D', '#5CC8A4', '#58A8F5', '#9B7BF0', '#FF7AC1'];
  for (let i = 0; i < 46; i++) {
    const c = document.createElement('i');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = colors[i % colors.length];
    c.style.setProperty('--dx', (Math.random() - 0.5) * 200 + 'px');
    c.style.setProperty('--rot', Math.random() * 720 + 'deg');
    c.style.animationDelay = Math.random() * 0.4 + 's';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 2600);
  }
}
