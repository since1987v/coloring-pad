import { $, $$, toast, clamp, uid, makeCanvas, freeCanvas, loadImage, toBlob, hexToRgb, rgbToHex, shareOrDownload, showScreen } from './util.js';
import { db, getFile, putFile, getSetting, setSetting, deletePicture } from './store.js';
import { TOOLS, Stroke } from './brushes.js';
import { buildMask, floodFill, applyFill } from './fill.js';
import { toolSvg } from './icons.js';

export const PALETTE = [
  '#B71C1C', '#E53935', '#FF5252', '#FF8A80', '#E65100', '#FB8C00', '#FFB74D', '#F9A825',
  '#FDD835', '#FFEB3B', '#FFF59D', '#C0CA33', '#1B5E20', '#43A047', '#81C784', '#00BFA5',
  '#00ACC1', '#80DEEA', '#0D47A1', '#1E88E5', '#64B5F6', '#4A148C', '#7E57C2', '#8E24AA',
  '#BA68C8', '#AD1457', '#EC407A', '#F48FB1', '#FF80AB', '#3E2723', '#6D4C41', '#A1887F',
  '#D7A86E', '#8D5524', '#C68642', '#E0AC69', '#F1C27D', '#FFE0BD', '#000000', '#424242',
  '#757575', '#BDBDBD', '#E0E0E0', '#FFFFFF',
];
// 아래 바에 바로 보이는 색 (나머지는 무지개 버튼 → 시트)
export const QUICK = ['#E53935', '#FB8C00', '#FDD835', '#8BC34A', '#2E7D32', '#4FC3F7', '#1E88E5', '#7E57C2', '#EC407A', '#8D5524', '#F1C27D', '#212121'];
const SIZE_STEPS = [0.06, 0.2, 0.42, 0.75]; // 굵기 점 4개 = 도구 굵기 범위의 이 비율
const UNDO_BYTES = 120 * 1024 * 1024;
const UNDO_STEPS = 60;

const el = {};
let pic = null;
let W = 0;
let H = 0;
let pctx, sctx, bctx, backup;
let mask = null;
let ready = false; // 도안·색칠층을 다 불러온 뒤에만 그리기를 받는다
let lineImg = null;
let lineUrl = null;
let sampleUrl = null;
let sampleCtx = null;
let undo = [];
let redo = [];
let undoBytes = 0;
let dirty = false;
let saveTimer = 0;
let saving = Promise.resolve();
const view = { s: 1, tx: 0, ty: 0, fit: 1 };
// finger: 'auto' = 펜슬이 감지되기 전까지만 손가락으로 그림
let prefs = { tool: 'crayon', lastBrush: 'crayon', color: '#E53935', recent: [], tools: {}, finger: 'auto', sampleOpen: true };
let prefsTimer = 0;
let penSeen = false;
let stroke = null;
let strokeId = null;
let strokeType = '';
const touches = new Map();
let gesture = null;
let touchBlocked = false;
let onClose = () => {};

const currentTool = () => TOOLS.find((t) => t.id === prefs.tool) || TOOLS[0];

export async function initEditor(opts) {
  onClose = opts.onClose;
  for (const [k, id] of Object.entries({
    vp: 'viewport', stage: 'stage', paint: 'cvPaint', stroke: 'cvStroke', line: 'imgLine', title: 'edTitle',
    tools: 'tools', sizes: 'sizes', quick: 'quickColors', cur: 'curColor', palBtn: 'btnPalette', sheet: 'dlgPalette',
    palAll: 'paletteAll', recent: 'recent', custom: 'customColor', size: 'sizeRange', sizeRow: 'sizeRow', opacity: 'opacityRange',
    undo: 'btnUndo', redo: 'btnRedo', finger: 'btnFinger', sampleBtn: 'btnSample',
    sp: 'samplePanel', spImg: 'spImg', loading: 'edLoading', menu: 'dlgEdMenu',
  })) el[k] = document.getElementById(id);
  pctx = el.paint.getContext('2d');
  sctx = el.stroke.getContext('2d');
  backup = makeCanvas(1, 1);
  bctx = backup.getContext('2d');

  const saved = await getSetting('editorPrefs', null);
  if (saved) prefs = { ...prefs, ...saved, tools: { ...(saved.tools || {}) } };
  for (const t of TOOLS) prefs.tools[t.id] = { size: t.size, opacity: t.opacity, ...(prefs.tools[t.id] || {}) };

  buildTools();
  buildPalette();
  bindPointer();
  bindButtons();
  selectTool(prefs.tool, false);
  setColor(prefs.color, false);
  updateFingerBtn();

  window.addEventListener('resize', () => pic && ready && fitView());
  document.addEventListener('visibilitychange', () => document.hidden && saveNow());
  window.addEventListener('pagehide', () => saveNow());
}

export async function openEditor(meta) {
  pic = meta;
  ready = false;
  el.title.textContent = meta.title;
  showScreen('editor');
  el.loading.hidden = false;
  try {
    const lineBlob = await getFile(meta.id, 'line');
    if (!lineBlob) throw new Error('도안 파일이 없어요');
    const img = await loadImage(lineBlob);
    W = img.naturalWidth;
    H = img.naturalHeight;
    for (const c of [el.paint, el.stroke, backup]) {
      c.width = W;
      c.height = H;
    }
    el.stage.style.width = W + 'px';
    el.stage.style.height = H + 'px';
    if (lineUrl) URL.revokeObjectURL(lineUrl);
    lineUrl = URL.createObjectURL(lineBlob);
    el.line.src = lineUrl;
    lineImg = img;

    const mc = makeCanvas(W, H);
    const mx = mc.getContext('2d', { willReadFrequently: true });
    mx.fillStyle = '#fff';
    mx.fillRect(0, 0, W, H);
    mx.drawImage(img, 0, 0);
    mask = buildMask(mx, W, H);
    freeCanvas(mc);

    pctx.clearRect(0, 0, W, H);
    const paintBlob = await getFile(meta.id, 'paint');
    if (paintBlob) pctx.drawImage(await loadImage(paintBlob), 0, 0, W, H);
    undo = [];
    redo = [];
    undoBytes = 0;
    dirty = false;
    updateUndo();
    fitView();
    ready = true;
    await loadSample();
  } catch (err) {
    console.error(err);
    toast('그림을 열지 못했어요: ' + err.message);
    await close();
  } finally {
    el.loading.hidden = true;
  }
}

async function close() {
  if (stroke) endDraw();
  await saveNow();
  // 아무것도 그리지 않은 흰 도화지는 목록에 남기지 않는다
  if (pic?.blank && !pic.coloredAt) await deletePicture(pic.id);
  showScreen('library');
  const id = pic?.id;
  pic = null;
  ready = false;
  mask = null;
  lineImg = null;
  undo = [];
  redo = [];
  undoBytes = 0;
  for (const c of [el.paint, el.stroke, backup]) {
    c.width = 1;
    c.height = 1;
  }
  el.line.removeAttribute('src');
  if (lineUrl) URL.revokeObjectURL(lineUrl);
  lineUrl = null;
  el.sp.hidden = true;
  onClose(id);
}

// ---------- 저장 ----------
function markDirty() {
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 1500);
}

function saveNow() {
  clearTimeout(saveTimer);
  if (!dirty || !pic) return saving;
  dirty = false;
  const meta = pic;
  saving = saving
    .then(async () => {
      await putFile(meta.id, 'paint', await toBlob(el.paint));
      const t = composite(420);
      meta.colorThumb = await toBlob(t, 'image/jpeg', 0.85);
      freeCanvas(t);
      meta.coloredAt = Date.now();
      await db.put('pictures', meta);
    })
    .catch((e) => {
      dirty = true;
      toast('저장 실패: ' + e.message);
    });
  return saving;
}

// 흰 종이 + 색칠 층 + 도안 선(곱하기)을 합친 완성 이미지
function composite(max) {
  const s = Math.min(1, max / Math.max(W, H));
  const w = Math.round(W * s);
  const h = Math.round(H * s);
  const c = makeCanvas(w, h);
  const x = c.getContext('2d');
  x.fillStyle = '#fff';
  x.fillRect(0, 0, w, h);
  x.drawImage(el.paint, 0, 0, w, h);
  x.globalCompositeOperation = 'multiply';
  x.drawImage(lineImg, 0, 0, w, h);
  return c;
}

function savePrefs() {
  clearTimeout(prefsTimer);
  prefsTimer = setTimeout(() => setSetting('editorPrefs', prefs), 400);
}

// ---------- 도구·굵기·색 ----------
const tintable = (id) => id !== 'eraser' && id !== 'rainbow';

// 크레파스 상자: 도구 그림 + 이름. 고른 색으로 도구가 물든다
function buildTools() {
  el.tools.innerHTML = TOOLS.map(
    (t) => `<button class="box-tool" data-tool="${t.id}" aria-label="${t.name}">${toolSvg(t.id, prefs.color)}<span>${t.name}</span></button>`,
  ).join('');
  el.tools.addEventListener('click', (e) => {
    const b = e.target.closest('.box-tool');
    if (b) selectTool(b.dataset.tool);
  });
}

function tintTools() {
  $$('.box-tool', el.tools).forEach((b) => {
    if (tintable(b.dataset.tool)) b.querySelector('svg').outerHTML = toolSvg(b.dataset.tool, prefs.color);
  });
}

function selectTool(id, save = true) {
  const t = TOOLS.find((x) => x.id === id) || TOOLS[0];
  prefs.tool = t.id;
  if (t.id !== 'eraser') prefs.lastBrush = t.id;
  $$('.box-tool', el.tools).forEach((b) => b.classList.toggle('on', b.dataset.tool === t.id));
  renderSizes();
  if (save) savePrefs();
}

function renderSizes() {
  const t = currentTool();
  const st = prefs.tools[t.id];
  el.sizes.classList.toggle('off', !t.max);
  const vals = t.max ? SIZE_STEPS.map((f) => Math.round(t.min + (t.max - t.min) * f)) : SIZE_STEPS.map(() => 0);
  let near = 0;
  vals.forEach((v, i) => {
    if (Math.abs(v - st.size) < Math.abs(vals[near] - st.size)) near = i;
  });
  const fill = t.id === 'eraser' ? '#ffffff' : t.id === 'rainbow' ? 'conic-gradient(#ff5a5a,#ffc83d,#5cc8a4,#58a8f5,#9b7bf0,#ff5a5a)' : prefs.color;
  el.sizes.innerHTML = vals
    .map((v, i) => {
      const d = 10 + i * 8;
      return `<button class="size-dot ${i === near ? 'on' : ''}" data-v="${v}" aria-label="굵기 ${i + 1}"><i style="width:${d}px;height:${d}px;background:${fill}"></i></button>`;
    })
    .join('');
}

function buildPalette() {
  el.quick.innerHTML = QUICK.map(swatch).join('');
  el.palAll.innerHTML = PALETTE.map(swatch).join('');
  const pick = (e) => {
    const b = e.target.closest('.sw');
    if (!b) return;
    setColor(b.dataset.c);
    if (el.sheet.contains(b)) el.sheet.close();
  };
  el.quick.addEventListener('click', pick);
  el.palAll.addEventListener('click', pick);
  el.recent.addEventListener('click', pick);
  el.custom.addEventListener('input', () => setColor(el.custom.value.toUpperCase()));
  el.sizes.addEventListener('click', (e) => {
    const b = e.target.closest('.size-dot');
    if (!b) return;
    prefs.tools[prefs.tool].size = +b.dataset.v;
    renderSizes();
    savePrefs();
  });
  el.palBtn.addEventListener('click', openSheet);
  // 시트 바깥(배경)을 누르면 닫힌다
  el.sheet.addEventListener('click', (e) => e.target === el.sheet && el.sheet.close());
  el.size.addEventListener('input', () => {
    prefs.tools[prefs.tool].size = +el.size.value;
    renderSizes();
    savePrefs();
  });
  el.opacity.addEventListener('input', () => {
    prefs.tools[prefs.tool].opacity = el.opacity.value / 100;
    savePrefs();
  });
}

const swatch = (c) => `<button class="sw" data-c="${c}" style="--c:${c}" aria-label="${c}"></button>`;

function openSheet() {
  const t = currentTool();
  const st = prefs.tools[t.id];
  el.sizeRow.hidden = !t.max;
  if (t.max) {
    el.size.min = t.min;
    el.size.max = t.max;
    el.size.value = st.size;
  }
  el.opacity.value = Math.round(st.opacity * 100);
  el.recent.innerHTML = prefs.recent.map((c) => `<button class="sw sm" data-c="${c}" style="--c:${c}"></button>`).join('');
  el.sheet.showModal();
}

function setColor(c, save = true) {
  prefs.color = c;
  el.cur.style.setProperty('--c', c);
  el.custom.value = c.toLowerCase();
  $$('.sw', el.quick).forEach((b) => b.classList.toggle('on', b.dataset.c === c));
  $$('.sw', el.palAll).forEach((b) => b.classList.toggle('on', b.dataset.c === c));
  // 지우개나 무지개를 든 채 색을 고르면 쓰던 붓으로 돌아간다
  if (save && (prefs.tool === 'eraser' || prefs.tool === 'rainbow')) selectTool(prefs.lastBrush === 'rainbow' ? 'crayon' : prefs.lastBrush || 'crayon');
  if (save) {
    prefs.recent = [c, ...prefs.recent.filter((x) => x !== c)].slice(0, 10);
    savePrefs();
  }
  tintTools();
  renderSizes();
}

// ---------- 그리기·제스처 ----------
function bindPointer() {
  const vp = el.vp;
  const stop = (e) => e.preventDefault();
  vp.addEventListener('touchstart', stop, { passive: false });
  vp.addEventListener('touchmove', stop, { passive: false });
  vp.addEventListener('contextmenu', stop);
  vp.addEventListener('pointerdown', onDown);
  vp.addEventListener('pointermove', onMove);
  vp.addEventListener('pointerup', onUp);
  vp.addEventListener('pointercancel', onUp);
  vp.addEventListener('wheel', onWheel, { passive: false });
}

const fingerCanDraw = () => prefs.finger === 'on' || (prefs.finger === 'auto' && !penSeen);

function onDown(e) {
  if (!pic || !ready) return;
  if (e.pointerType === 'pen') {
    if (!penSeen) {
      penSeen = true;
      if (prefs.finger === 'auto') toast('애플펜슬 연결! 손가락은 확대·이동에 쓰여요');
      updateFingerBtn();
    }
    if (gesture) {
      gesture = null;
      touchBlocked = true;
    }
    if (stroke && strokeType === 'touch') cancelStroke();
  }
  if (e.pointerType === 'touch') {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (stroke && strokeType === 'pen') return; // 펜으로 그리는 중 닿은 손바닥은 무시
    if (touchBlocked) return;
    if (touches.size >= 2) {
      if (stroke) cancelStroke();
      startGesture(!!gesture);
      return;
    }
    if (!fingerCanDraw()) return;
  }
  if (stroke) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  try {
    el.vp.setPointerCapture(e.pointerId);
  } catch {}
  beginDraw(e);
}

function onMove(e) {
  if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesture) {
      moveGesture();
      return;
    }
  }
  if (stroke && e.pointerId === strokeId) {
    const r = el.paint.getBoundingClientRect();
    const list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
    for (const ev of list && list.length ? list : [e]) {
      const [x, y] = toCanvas(ev, r);
      stroke.add(x, y, pressureOf(ev));
    }
  }
}

function onUp(e) {
  if (e.pointerType === 'touch') {
    touches.delete(e.pointerId);
    if (touches.size === 0) touchBlocked = false;
    if (gesture) {
      if (touches.size === 0) endGesture();
      else startGesture(true);
      return;
    }
  }
  if (stroke && e.pointerId === strokeId) endDraw();
}

function toCanvas(e, r) {
  return [((e.clientX - r.left) * W) / r.width, ((e.clientY - r.top) * H) / r.height];
}

export function pressureOf(e) {
  if (e.pointerType !== 'pen') return 0.65;
  return Math.pow(clamp(e.pressure || 0.25, 0.05, 1), 0.75);
}

function beginDraw(e) {
  const [x, y] = toCanvas(e, el.paint.getBoundingClientRect());
  const tool = currentTool();
  if (tool.id === 'fill') {
    fillAt(x, y);
    return;
  }
  bctx.clearRect(0, 0, W, H);
  bctx.drawImage(el.paint, 0, 0);
  const st = prefs.tools[tool.id];
  el.stroke.style.opacity = tool.layered ? st.opacity : 1;
  stroke = new Stroke(tool, prefs.color, st.size, st.opacity, pctx, sctx);
  strokeId = e.pointerId;
  strokeType = e.pointerType;
  stroke.add(x, y, pressureOf(e));
}

function endDraw() {
  const s = stroke;
  stroke = null;
  strokeId = null;
  s.finish();
  s.commit(W, H);
  const r = s.rect(W, H);
  if (r) pushUndo({ x: r[0], y: r[1], img: bctx.getImageData(r[0], r[1], r[2], r[3]) });
}

function cancelStroke() {
  stroke = null;
  strokeId = null;
  sctx.clearRect(0, 0, W, H);
  pctx.clearRect(0, 0, W, H);
  pctx.drawImage(backup, 0, 0);
}

function fillAt(x, y) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const res = floodFill(mask, W, H, x, y);
  if (!res) {
    toast('선 위를 눌렀어요. 칸 안쪽을 눌러 주세요');
    return;
  }
  const before = applyFill(pctx, res, W, hexToRgb(prefs.color), prefs.tools.fill.opacity);
  pushUndo({ x: res.minX, y: res.minY, img: before });
}

const centroid = (pts) => ({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// keep: 손가락 수가 바뀌어도 같은 제스처로 이어 본다 (두 손가락 탭 판정용)
function startGesture(keep) {
  const pts = [...touches.values()];
  const prev = keep ? gesture : null;
  gesture = {
    c0: centroid(pts),
    d0: pts.length > 1 ? dist(pts[0], pts[1]) : 0,
    s0: view.s,
    tx0: view.tx,
    ty0: view.ty,
    t0: prev ? prev.t0 : performance.now(),
    moved: prev ? prev.moved : false,
    maxN: Math.max(prev ? prev.maxN : 0, pts.length),
  };
}

function moveGesture() {
  const g = gesture;
  const pts = [...touches.values()];
  const c = centroid(pts);
  let s = g.s0;
  if (pts.length > 1 && g.d0 > 0) s = clamp((g.s0 * dist(pts[0], pts[1])) / g.d0, view.fit * 0.5, view.fit * 12);
  const r = el.vp.getBoundingClientRect();
  const sx = (g.c0.x - r.left - g.tx0) / g.s0;
  const sy = (g.c0.y - r.top - g.ty0) / g.s0;
  view.s = s;
  view.tx = c.x - r.left - sx * s;
  view.ty = c.y - r.top - sy * s;
  if (dist(c, g.c0) > 12 || Math.abs(s / g.s0 - 1) > 0.06) g.moved = true;
  applyView();
}

// 두 손가락 톡 = 실행취소, 세 손가락 톡 = 다시실행
function endGesture() {
  const g = gesture;
  gesture = null;
  if (g.moved || performance.now() - g.t0 > 350) return;
  if (g.maxN === 2) doUndo();
  else if (g.maxN >= 3) doRedo();
}

function onWheel(e) {
  if (!pic || !ready) return;
  e.preventDefault();
  const r = el.vp.getBoundingClientRect();
  const mx = e.clientX - r.left;
  const my = e.clientY - r.top;
  const s = clamp(view.s * Math.exp(-e.deltaY * 0.0015), view.fit * 0.5, view.fit * 12);
  const k = s / view.s;
  view.tx = mx - (mx - view.tx) * k;
  view.ty = my - (my - view.ty) * k;
  view.s = s;
  applyView();
}

function applyView() {
  el.stage.style.transform = `translate(${view.tx}px, ${view.ty}px) scale(${view.s})`;
}

function fitView() {
  const r = el.vp.getBoundingClientRect();
  const s = Math.min(r.width / W, r.height / H) * 0.94;
  view.fit = view.s = s;
  view.tx = (r.width - W * s) / 2;
  view.ty = (r.height - H * s) / 2;
  applyView();
}

// ---------- 실행취소 ----------
// 바뀐 영역만 ImageData로 저장하고, 되돌릴 때 지금 그림과 맞바꾼다
const bytes = (e) => e.img.width * e.img.height * 4;

function pushUndo(e) {
  for (const r of redo) undoBytes -= bytes(r);
  redo = [];
  undo.push(e);
  undoBytes += bytes(e);
  while (undo.length > UNDO_STEPS || (undoBytes > UNDO_BYTES && undo.length > 1)) undoBytes -= bytes(undo.shift());
  updateUndo();
  markDirty();
}

function swap(e) {
  const now = pctx.getImageData(e.x, e.y, e.img.width, e.img.height);
  pctx.putImageData(e.img, e.x, e.y);
  e.img = now;
}

function doUndo() {
  if (stroke) return;
  const e = undo.pop();
  if (!e) return;
  swap(e);
  redo.push(e);
  updateUndo();
  markDirty();
}

function doRedo() {
  if (stroke) return;
  const e = redo.pop();
  if (!e) return;
  swap(e);
  undo.push(e);
  updateUndo();
  markDirty();
}

function updateUndo() {
  el.undo.disabled = !undo.length;
  el.redo.disabled = !redo.length;
}

function clearAll() {
  pushUndo({ x: 0, y: 0, img: pctx.getImageData(0, 0, W, H) });
  pctx.clearRect(0, 0, W, H);
}

// ---------- 샘플 ----------
async function loadSample() {
  el.sp.hidden = true;
  sampleCtx = null;
  el.sampleBtn.classList.toggle('dim', !pic.hasSample);
  el.sampleBtn.classList.remove('on');
  if (!pic.hasSample) return;
  const blob = await getFile(pic.id, 'sample');
  if (!blob || !pic) return;
  if (sampleUrl) URL.revokeObjectURL(sampleUrl);
  sampleUrl = URL.createObjectURL(blob);
  el.spImg.src = sampleUrl;
  const img = await loadImage(blob);
  const s = Math.min(1, 800 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = makeCanvas(Math.round(img.naturalWidth * s), Math.round(img.naturalHeight * s));
  sampleCtx = c.getContext('2d', { willReadFrequently: true });
  sampleCtx.drawImage(img, 0, 0, c.width, c.height);
  el.sp.hidden = !prefs.sampleOpen;
  el.sampleBtn.classList.toggle('on', !el.sp.hidden);
}

function toggleSample() {
  if (!pic?.hasSample) {
    toast('이 그림은 샘플이 없어요');
    return;
  }
  el.sp.hidden = !el.sp.hidden;
  el.sampleBtn.classList.toggle('on', !el.sp.hidden);
  prefs.sampleOpen = !el.sp.hidden;
  savePrefs();
}

// 샘플 그림을 누르면 그 자리 색(주변 5×5 평균)을 붓 색으로 고른다
function pickFromSample(e) {
  e.preventDefault();
  e.stopPropagation();
  const r = el.spImg.getBoundingClientRect();
  if (!sampleCtx || !r.width) return;
  const c = sampleCtx.canvas;
  const x = clamp(Math.round(((e.clientX - r.left) / r.width) * c.width), 2, c.width - 3);
  const y = clamp(Math.round(((e.clientY - r.top) / r.height) * c.height), 2, c.height - 3);
  const d = sampleCtx.getImageData(x - 2, y - 2, 5, 5).data;
  let rr = 0, gg = 0, bb = 0;
  for (let i = 0; i < d.length; i += 4) {
    rr += d[i];
    gg += d[i + 1];
    bb += d[i + 2];
  }
  const n = d.length / 4;
  setColor(rgbToHex(Math.round(rr / n), Math.round(gg / n), Math.round(bb / n)));
}

// ---------- 버튼 ----------
function updateFingerBtn() {
  const on = fingerCanDraw();
  el.finger.classList.toggle('on', on);
  el.finger.setAttribute('aria-label', on ? '손가락으로 그리는 중' : '손가락은 확대·이동만');
}

function bindButtons() {
  $('#edBack').addEventListener('click', close);
  $('#btnDone').addEventListener('click', saveToGallery);
  el.undo.addEventListener('click', doUndo);
  el.redo.addEventListener('click', doRedo);
  $('#btnFit').addEventListener('click', fitView);
  el.sampleBtn.addEventListener('click', toggleSample);
  el.finger.addEventListener('click', () => {
    prefs.finger = fingerCanDraw() ? 'off' : 'on';
    updateFingerBtn();
    savePrefs();
    toast(fingerCanDraw() ? '손가락으로도 그려요' : '손가락은 확대·이동만 해요');
  });
  el.spImg.addEventListener('pointerdown', pickFromSample);
  $('#spClose').addEventListener('click', toggleSample);
  $('#spBig').addEventListener('click', () => el.sp.classList.toggle('big'));
  $('#spSide').addEventListener('click', () => el.sp.classList.toggle('left'));
  $('#btnEdMore').addEventListener('click', () => el.menu.showModal());
  el.menu.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    el.menu.close();
    if (act === 'done') await saveToGallery();
    else if (act === 'export') await exportImage();
    else if (act === 'clear' && confirm('색칠한 것을 전부 지울까요? (되돌리기로 살릴 수 있어요)')) clearAll();
  });
  document.addEventListener('keydown', (e) => {
    if (!pic || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
    e.preventDefault();
    e.shiftKey ? doRedo() : doUndo();
  });
}

async function saveToGallery() {
  await saveNow();
  const big = composite(2048);
  const image = await toBlob(big, 'image/jpeg', 0.92);
  freeCanvas(big);
  const small = composite(420);
  const thumb = await toBlob(small, 'image/jpeg', 0.85);
  freeCanvas(small);
  await db.put('gallery', { id: uid('a'), pictureId: pic.id, title: pic.title, createdAt: Date.now(), image, thumb });
  toast('내 작품에 걸었어요!');
  if (confirm('내 작품에 걸었어요!\n새 종이에 처음부터 다시 색칠할까요?')) clearAll();
}

async function exportImage() {
  const c = composite(2048);
  const blob = await toBlob(c, 'image/png');
  freeCanvas(c);
  await shareOrDownload(blob, `${pic.title}.png`);
}
