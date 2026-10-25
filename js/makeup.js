import { $, $$, toast, uid, clamp, makeCanvas, freeCanvas, toBlob, loadImage, shareOrDownload, showScreen, hexToRgb, drawFit, pickFile } from './util.js';
import { db, getFile, putFile, delFile, getSetting, setSetting } from './store.js';
import { pressureOf } from './editor.js';
import {
  FW, FH, FACES, U, AXIS, EYES_AT, LIDS_AT, CHEEKS_AT, MOUTH_AT, eyePath, LIP_PATHS, FACE_PATH,
  drawBase, drawBackground, drawFeatures, drawShading, drawSkinShape, fillEllipse, faceThumb,
} from './faces.js';
import { ACC, ACC_CATS, ACC_MAP, CAT_ICON, accHeight, accSvg, accThumbSvg } from './accessories.js';
import { ICON } from './icons.js';
import { speak } from './speech.js';

// ---------- 화장 층 ----------
// 아래에서 위로: 파운데이션 → 볼 → 눈두덩 → 입술 → 아이라인 → 얼굴 그림 → (명암, 곱하기) → 광택·반짝이 → 눈·코·입 선 → 자유 그림
export const MK_LAYERS = ['foundation', 'blush', 'shadow', 'lips', 'liner', 'paint', 'shine', 'doodle'];
// 따로 자리가 정해진 층 (나머지는 #mkLayers 안에 순서대로 쌓인다)
const OWN_EL = { shine: 'shine', doodle: 'doodle' };

// ---------- 얼굴 위치 ----------
// 기본 얼굴(코드로 그린 그림)의 좌표를 '본'으로 삼고, 올린 사진은 눈·입 세 점으로 본을 사진 위에 옮긴다.
// T: 본 좌표 → 화면(1200×1500) 좌표.  Ue: 화면에서의 얼굴 크기 기준 (번짐·붓 크기)
let T = new DOMMatrix();
let Ti = new DOMMatrix();
let Ue = U;
let Sc = 1;
let ANG = 0;
const TPL = [EYES_AT[0], EYES_AT[1], MOUTH_AT]; // 본의 왼눈 · 오른눈 · 입

// 세 점 짝(본 → 사진)으로 아핀 변환을 구한다
export function affineFrom(Q) {
  const [[x1, y1], [x2, y2], [x3, y3]] = TPL;
  const det = x1 * (y2 - y3) - y1 * (x2 - x3) + (x2 * y3 - x3 * y2);
  const solve = (v1, v2, v3) => [
    (v1 * (y2 - y3) - y1 * (v2 - v3) + (v2 * y3 - v3 * y2)) / det,
    (x1 * (v2 - v3) - v1 * (x2 - x3) + (x2 * v3 - x3 * v2)) / det,
    (x1 * (y2 * v3 - y3 * v2) - y1 * (x2 * v3 - x3 * v2) + v1 * (x2 * y3 - x3 * y2)) / det,
  ];
  const [a, c, e] = solve(Q[0][0], Q[1][0], Q[2][0]);
  const [b, d, f] = solve(Q[0][1], Q[1][1], Q[2][1]);
  return new DOMMatrix([a, b, c, d, e, f]);
}

function setFaceTransform(m) {
  T = m;
  Ti = m.inverse();
  Sc = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
  ANG = (Math.atan2(m.b, m.a) * 180) / Math.PI;
  Ue = U * Sc;
}

const tp = (x, y) => {
  const p = T.transformPoint({ x, y });
  return [p.x, p.y];
};
// 좌우 같이 칠하기: 본으로 옮겨 대칭축(가운데)에서 뒤집은 뒤 다시 화면으로
function mirrorPt(x, y) {
  const p = Ti.transformPoint({ x, y });
  return tp(2 * AXIS - p.x, p.y);
}

// ---------- 색 ----------
const LIP = ['#FF4F79', '#E0115F', '#F77FBE', '#C2185B', '#FF7F6A', '#D8A1A4', '#9C27B0', '#8E3B46'];
const GLOSS = ['#FF8FB1', '#FFB3C7', '#F06292', '#FF8A80', '#E1BEE7', '#FFD1DC'];
const BLUSH = ['#FF8FAB', '#FFB3C1', '#FF9E80', '#F48FB1', '#E57373', '#D18EB5'];
const SHADOW = ['#C39BD3', '#85C1E9', '#F7DC6F', '#FFB6C1', '#A9DFBF', '#B0855B', '#2E86C1', '#8E44AD'];
const LINER = ['#1B1B1B', '#4E342E', '#1A237E', '#4A148C', '#00695C', '#C2185B'];
const FOUND = ['#FBE3D0', '#F8D9C2', '#F3CBA5', '#E0AC69', '#C68E63', '#8D5A3B'];
const BRIGHT = ['#FF5A5A', '#FFC12E', '#2DBE7E', '#3BA4FF', '#8C6CFF', '#FF7AB6', '#FFFFFF', '#FFD700'];
const TINT = ['#FF4F79', '#FF5A3C', '#FFC12E', '#2DBE7E', '#3BA4FF', '#8C6CFF', '#FFFFFF', '#241B3A', '#E8B931'];
const NAMES = {
  '#FF4F79': '딸기', '#E0115F': '루비', '#F77FBE': '솜사탕', '#C2185B': '체리', '#FF7F6A': '복숭아', '#D8A1A4': '모카',
  '#9C27B0': '포도', '#8E3B46': '베리', '#C39BD3': '라벤더', '#85C1E9': '바다', '#F7DC6F': '햇살', '#FFB6C1': '벚꽃',
  '#A9DFBF': '민트', '#B0855B': '코코아', '#2E86C1': '파도', '#8E44AD': '보라별',
};
const LOOKS = [
  { name: '핑크 공주', lipstick: '#FF4F79', gloss: '#FFB3C7', blush: '#FF8FAB', shadow: '#FFB6C1', liner: '#4E342E' },
  { name: '바다 요정', lipstick: '#F77FBE', gloss: '#E1BEE7', blush: '#FFB3C1', shadow: '#85C1E9', liner: '#1A237E' },
  { name: '가을 숲', lipstick: '#C2185B', gloss: '#FF8A80', blush: '#FF9E80', shadow: '#B0855B', liner: '#4E342E' },
  { name: '무지개 파티', lipstick: '#9C27B0', gloss: '#FFD1DC', blush: '#FF9E80', shadow: '#F7DC6F', liner: '#00695C' },
];

// ---------- 도구 설정 ----------
// r: 붓 반지름 (얼굴 너비 U에 대한 비율)   hard: 붓 가장자리 단단함(0=아주 부드러움)   dabA: 한 번 찍을 때 진하기
// flow: 한 손동작이 더하는 최대 진하기   max: 덧칠해도 넘지 않는 진하기   mask: 칠해지는 영역   snap: 시작점을 끌어오는 거리
// auto: 톡 누르면 한 번에 바르는 부위   mirror: 좌우 같이 칠하기 지원   small: 손가락에 가려지는 작은 부위 (확대경)
const MK_TOOLS = [
  { id: 'lipstick', name: '립스틱', layer: 'lips', palette: LIP, r: 0.03, hard: 0.7, dabA: 0.5, flow: 0.62, max: 0.92, mask: 'lips', snap: 0.07, auto: 'lips', small: true,
    icon: (c) => `<rect x="22" y="36" width="20" height="24" rx="3" fill="#241B3A"/><rect x="24" y="28" width="16" height="10" rx="2" fill="#D9C38A"/><path d="M26 28 V13 Q32 4 38 9 V28 Z" fill="${c}"/>` },
  { id: 'gloss', name: '립글로스', layer: 'lips', palette: GLOSS, r: 0.034, hard: 0.35, dabA: 0.4, flow: 0.38, max: 0.6, mask: 'lips', snap: 0.07, auto: 'lips', shine: true, small: true,
    icon: (c) => `<rect x="24" y="24" width="16" height="36" rx="7" fill="${c}" fill-opacity=".7" stroke="#241B3A" stroke-width="2"/><rect x="26" y="8" width="12" height="17" rx="3" fill="#241B3A"/><rect x="28" y="31" width="3" height="20" rx="1.5" fill="#fff" opacity=".85"/>` },
  { id: 'blush', name: '볼터치', layer: 'blush', palette: BLUSH, r: 0.12, hard: 0, dabA: 0.16, flow: 0.36, max: 0.6, mask: 'blush', auto: 'cheek', mirror: true,
    icon: (c) => `<circle cx="32" cy="36" r="22" fill="#241B3A"/><circle cx="32" cy="36" r="17" fill="${c}"/><circle cx="26" cy="30" r="5" fill="#fff" opacity=".4"/>` },
  { id: 'shadow', name: '아이섀도', layer: 'shadow', palette: SHADOW, r: 0.065, hard: 0.1, dabA: 0.32, flow: 0.62, max: 0.85, mask: 'lids', snap: 0.06, auto: 'lid', mirror: true, small: true,
    icon: (c) => `<rect x="8" y="16" width="48" height="34" rx="8" fill="#241B3A"/><rect x="13" y="21" width="17" height="11" rx="3" fill="${c}"/><rect x="34" y="21" width="17" height="11" rx="3" fill="#F7DC6F"/><rect x="13" y="35" width="17" height="11" rx="3" fill="#85C1E9"/><rect x="34" y="35" width="17" height="11" rx="3" fill="#FFB6C1"/>` },
  { id: 'liner', name: '아이라인', layer: 'liner', palette: LINER, r: 0.009, hard: 0.85, dabA: 0.9, flow: 0.95, max: 0.95, mask: 'liner', snap: 0.04, mirror: true, small: true,
    icon: (c) => `<g transform="rotate(30 32 32)"><rect x="28" y="4" width="9" height="40" rx="3" fill="#241B3A"/><path d="M28 44 H37 L33.5 60 H31.5 Z" fill="${c}"/></g>` },
  { id: 'foundation', name: '파운데이션', layer: 'foundation', palette: FOUND, r: 0.17, hard: 0, dabA: 0.14, flow: 0.3, max: 0.5, mask: 'skin',
    icon: (c) => `<rect x="18" y="24" width="28" height="34" rx="7" fill="${c}" stroke="#241B3A" stroke-width="2"/><rect x="25" y="11" width="14" height="14" rx="2" fill="#241B3A"/><rect x="22" y="31" width="6" height="18" rx="3" fill="#fff" opacity=".45"/>` },
  { id: 'glitter', name: '반짝이', layer: 'shine', palette: BRIGHT, r: 0.07, glitter: true, mask: 'glitter', mirror: true,
    icon: (c) => `<rect x="16" y="24" width="32" height="32" rx="8" fill="${c}" stroke="#241B3A" stroke-width="2"/><rect x="18" y="15" width="28" height="11" rx="3" fill="#CFC8BE" stroke="#241B3A" stroke-width="2"/><path d="M26 34l2 5 5 2-5 2-2 5-2-5-5-2 5-2z M39 44l1.4 3 3 1.4-3 1.4-1.4 3-1.4-3-3-1.4 3-1.4z" fill="#fff"/>` },
  { id: 'facepaint', name: '얼굴 그림', layer: 'paint', palette: BRIGHT, r: 0.02, hard: 0.85, dabA: 0.85, flow: 0.95, max: 0.95, mask: 'paint', small: true,
    icon: (c) => `<path d="M14 54 L40 22" stroke="#C9935E" stroke-width="7" stroke-linecap="round"/><path d="M38 24 L46 10 Q55 7 53 17 L44 28 Z" fill="${c}"/><circle cx="50" cy="50" r="7" fill="${c}" stroke="#241B3A" stroke-width="2"/>` },
  // 얼굴 밖(몸·옷·배경)까지 어디든 그리는 붓. 맨 위 층이라 눈·머리카락 위에도 그려진다
  { id: 'doodle', name: '그림 그리기', layer: 'doodle', palette: [...BRIGHT, '#8D5524', '#241B3A'], r: 0.022, hard: 0.85, dabA: 0.85, flow: 0.95, max: 0.97, mask: null, small: true, anywhere: true,
    icon: (c) => `<rect x="6" y="38" width="52" height="20" rx="4" fill="#fff" stroke="#241B3A" stroke-width="2"/><path d="M12 50 Q22 40 30 48 T48 46" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/><g transform="rotate(35 40 20)"><rect x="35" y="2" width="10" height="28" rx="2" fill="${c}" stroke="#241B3A" stroke-width="2"/><path d="M35 30 L45 30 L40 40 Z" fill="#EDCB98" stroke="#241B3A" stroke-width="2" stroke-linejoin="round"/></g>` },
  { id: 'tissue', name: '지우개', eraser: true, r: 0.07, hard: 0.2, palette: [],
    icon: () => `<rect x="10" y="32" width="44" height="24" rx="5" fill="#9ED3F5" stroke="#241B3A" stroke-width="2"/><path d="M22 32 Q24 12 32 15 Q40 10 42 32 Z" fill="#fff" stroke="#241B3A" stroke-width="2"/>` },
];
const SIZE_F = [0.6, 1, 1.6];
const toolIcon = (t, c) => `<svg viewBox="0 0 64 64" aria-hidden="true">${t.icon(c)}</svg>`;

const el = {};
const lctx = {}; // 화장 층 이름 → 2D 컨텍스트
const bkp = {}; // 화장 층 이름 → 손동작 직전 사본 (되돌리기·취소용)
let face = null;
let seg = 'makeup';
let prefs = { tool: 'lipstick', shades: {}, sizes: {}, cat: 'head', mirror: true };
let freeMode = false;
let boost = 1; // 어두운 피부에서 색이 묻히지 않게 진하기를 조금 올린다
let accs = [];
let sel = null;
let raw, rctx, dctx; // raw: 한 손동작의 붓 자국(영역 자르기 전)  dctx: 화면에 보이는 자국(영역으로 자른 것)
let masks = null;
let maskData = null;
let st = null; // 진행 중인 손동작
let penSeen = false;
let undo = [];
let redo = [];
let dirty = new Set();
let accDirty = false;
let saveTimer = 0;
let saving = Promise.resolve();
let scale = 1;
const pointers = new Map();
let gest = null;
let drag = null; // 액세서리 목록에서 끌어오는 중
let glitterCells = new Map();
let glitterCount = 0;
let loupeQueued = false;
let finishOpts = { bg: null, frame: 'none' };
let onClose = () => {};

const curTool = () => MK_TOOLS.find((t) => t.id === prefs.tool) || MK_TOOLS[0];
const shadeOf = (t) => prefs.shades[t.id] || t.palette[0] || '#000000';
const maskFor = (t) => (t.eraser || t.anywhere ? null : freeMode ? 'free' : t.mask);

export function setFreeMode(v) {
  freeMode = v;
}

// ---------- 영역(마스크) ----------
// 그림자 번짐으로 모양의 가장자리를 부드럽게 만든다 (blur: 픽셀, 얼굴 크기에 비례해서 넘긴다)
// 모양은 화면 밖에 그리고 그림자만 제자리에 떨어뜨린다. 그림자 거리는 화면 픽셀 기준이라 본→사진 변환이 있어도 맞게 화면 쪽에서 민다
function softFill(x, draw, blur, alpha = 1) {
  x.save();
  const m = x.getTransform();
  x.setTransform(m.a, m.b, m.c, m.d, m.e - 20000, m.f);
  x.shadowColor = `rgba(0,0,0,${alpha})`;
  x.shadowBlur = blur;
  x.shadowOffsetX = 20000;
  x.fillStyle = '#000';
  x.strokeStyle = '#000';
  draw(x);
  x.restore();
}

function cut(x, fn) {
  x.save();
  x.globalCompositeOperation = 'destination-out';
  fn(x);
  x.restore();
}

const eyesShape = (grow) => (y) => {
  for (const [ex, ey] of EYES_AT) y.fill(eyePath(ex, ey, grow));
};
const lipsShape = (y) => LIP_PATHS().forEach((p) => y.fill(p));
const lipsWide = (w) => (y) => {
  y.lineWidth = w;
  y.lineJoin = 'round';
  LIP_PATHS().forEach((p) => {
    y.fill(p);
    y.stroke(p);
  });
};

// 도구마다: 중심 영역(진하게) + 번짐 허용 영역(옅게) − 보호 영역.
// 모양은 본 좌표로 그리고(T로 사진 위에 옮김), 번짐(그림자) 크기는 화면에서의 얼굴 크기 Ue 기준
let masksFor = '';
function buildMasks(key) {
  if (masksFor === key) return;
  masksFor = key;
  const u = Ue;
  const mk = (fn) => {
    const c = makeCanvas(FW, FH);
    const x = c.getContext('2d');
    x.setTransform(T);
    fn(x);
    return c;
  };
  masks = {
    lips: mk((x) => {
      softFill(x, lipsWide(U * 0.045), u * 0.03, 0.3);
      softFill(x, lipsShape, u * 0.006, 1);
    }),
    lids: mk((x) => {
      softFill(x, (y) => LIDS_AT.forEach(([lx, ly]) => fillEllipse(y, lx, ly - 6, 150, 98)), u * 0.08, 0.42);
      softFill(x, (y) => LIDS_AT.forEach(([lx, ly]) => fillEllipse(y, lx, ly, 112, 64)), u * 0.05, 1);
      cut(x, (y) => softFill(y, eyesShape(0), u * 0.005, 1));
    }),
    liner: mk((x) => {
      softFill(x, eyesShape(24), u * 0.012, 1);
      cut(x, (y) => softFill(y, eyesShape(-7), 2, 1));
    }),
    blush: mk((x) => {
      softFill(x, drawSkinShape, u * 0.012, 1);
      cut(x, (y) => softFill(y, eyesShape(16), u * 0.03, 1));
      cut(x, (y) => softFill(y, lipsWide(U * 0.02), u * 0.02, 1));
    }),
    skin: mk((x) => {
      softFill(x, drawSkinShape, u * 0.012, 1);
      cut(x, (y) => softFill(y, eyesShape(4), u * 0.008, 1));
    }),
    paint: mk((x) => {
      softFill(x, drawSkinShape, u * 0.006, 1);
      cut(x, (y) => softFill(y, eyesShape(2), 2, 1));
    }),
    glitter: mk((x) => {
      softFill(x, drawSkinShape, u * 0.006, 1);
      cut(x, (y) => softFill(y, eyesShape(4), 2, 1));
    }),
    free: mk((x) => {
      softFill(x, drawSkinShape, u * 0.004, 1);
      cut(x, (y) => softFill(y, eyesShape(-2), 2, 1));
    }),
    // 립글로스 광택이 생기는 자리 (아랫입술 윗부분, 윗입술 양쪽)
    lipShine: mk((x) => {
      softFill(x, (y) => {
        fillEllipse(y, MOUTH_AT[0], 922, 42, 9);
        fillEllipse(y, 582, 889, 16, 5);
        fillEllipse(y, 618, 889, 16, 5);
      }, u * 0.012, 1);
    }),
    lipsCore: mk((x) => softFill(x, lipsWide(U * 0.06), u * 0.03, 1)),
    eyeArea: mk((x) => softFill(x, (y) => LIDS_AT.forEach(([lx, ly]) => fillEllipse(y, lx, ly + 10, 165, 115)), u * 0.04, 1)),
  };
  // 시작점 끌어오기·반짝이 밀도 확인용으로 영역의 진하기만 따로 모아 둔다
  maskData = {};
  for (const [k, c] of Object.entries(masks)) {
    const d = c.getContext('2d').getImageData(0, 0, FW, FH).data;
    const a = new Uint8Array(FW * FH);
    for (let i = 0, j = 3; i < a.length; i++, j += 4) a[i] = d[j];
    maskData[k] = a;
  }
}

const maskA = (name, x, y) => {
  x |= 0;
  y |= 0;
  if (x < 0 || y < 0 || x >= FW || y >= FH) return 0;
  return maskData[name][y * FW + x];
};

// 부위 바로 밖에서 시작한 손동작은 가까운 부위 안쪽으로 옮겨 준다 (너무 멀면 그대로 둔다)
function snapPoint(name, x, y, R) {
  // 이미 중심 영역 안이면 그대로 (옅은 번짐 구역에서 시작해도 안쪽으로 이어 준다)
  if (maskA(name, x, y) >= 160) return null;
  for (let r = 6; r <= R; r += 6) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (maskA(name, px, py) >= 200) return { x: px, y: py };
    }
  }
  return null;
}

// ---------- 붓 ----------
const dabs = new Map();
function dabFor(color, hard) {
  const key = `${color}|${hard}`;
  let c = dabs.get(key);
  if (c) return c;
  const [r, g, b] = hexToRgb(color);
  c = makeCanvas(128, 128);
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, `rgba(${r},${g},${b},1)`);
  if (hard > 0) gr.addColorStop(hard, `rgba(${r},${g},${b},1)`);
  gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr;
  x.fillRect(0, 0, 128, 128);
  if (dabs.size > 40) dabs.delete(dabs.keys().next().value);
  dabs.set(key, c);
  return c;
}

export async function initMakeup(opts) {
  onClose = opts.onClose;
  for (const [k, id] of Object.entries({
    wrap: 'mkWrap', stage: 'mkStage', base: 'mkBase', layers: 'mkLayers', scratch: 'mkScratch', shade: 'mkShade', shine: 'mkShine', feat: 'mkFeat', doodle: 'mkDoodle', acc: 'mkAcc',
    rail: 'mkRail', sizes: 'mkSizes', shades: 'mkShades', items: 'mkItems', accTools: 'mkAccTools', undo: 'mkUndo', redo: 'mkRedo',
    menu: 'dlgMkMenu', title: 'mkTitle', mirror: 'mkMirror', looks: 'mkLooks', loupe: 'mkLoupe', ghost: 'mkGhost', finish: 'mkFinish',
  })) el[k] = document.getElementById(id);
  for (const k of MK_LAYERS) {
    const c = OWN_EL[k] ? el[OWN_EL[k]] : el.layers.appendChild(document.createElement('canvas'));
    c.width = FW;
    c.height = FH;
    lctx[k] = c.getContext('2d');
    const b = makeCanvas(FW, FH);
    bkp[k] = b.getContext('2d');
  }
  for (const c of [el.base, el.scratch, el.shade, el.feat]) {
    c.width = FW;
    c.height = FH;
  }
  el.stage.style.width = FW + 'px';
  el.stage.style.height = FH + 'px';
  dctx = el.scratch.getContext('2d');
  raw = makeCanvas(FW, FH);
  rctx = raw.getContext('2d');
  prefs = { ...prefs, ...(await getSetting('makeupPrefs', {})) };
  bindFaceFit();
  bindFaceGate();

  $('#mkSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) setSeg(b.dataset.seg);
  });
  el.rail.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tool],[data-cat]');
    if (!b) return;
    if (b.dataset.tool) prefs.tool = b.dataset.tool;
    else prefs.cat = b.dataset.cat;
    savePrefs();
    renderRail();
    renderDock();
  });
  el.sizes.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    prefs.sizes[prefs.tool] = +b.dataset.i;
    savePrefs();
    renderDock();
  });
  el.shades.addEventListener('click', (e) => {
    const b = e.target.closest('.sw');
    if (!b) return;
    if (seg === 'makeup') {
      prefs.shades[prefs.tool] = b.dataset.c;
      savePrefs();
      renderRail();
    } else if (sel != null) {
      snapshotAcc();
      accs[sel].c = b.dataset.c;
      renderAcc();
      markAcc();
    }
    renderDock();
  });
  el.mirror.addEventListener('click', () => {
    prefs.mirror = !prefs.mirror;
    savePrefs();
    renderDock();
    toast(prefs.mirror ? '한쪽을 칠하면 반대쪽도 같이 칠해져요' : '한쪽씩 따로 칠해요');
  });
  el.looks.addEventListener('click', openLooks);
  $('#dlgLooks').addEventListener('click', (e) => {
    const b = e.target.closest('[data-look]');
    if (b) {
      const look = LOOKS[+b.dataset.look];
      for (const k of ['lipstick', 'gloss', 'blush', 'shadow', 'liner']) prefs.shades[k] = look[k];
      savePrefs();
      renderRail();
      renderDock();
      toast(`‘${look.name}’ 색을 골라 놨어요. 이제 칠해 봐요!`);
    }
    if (b || e.target.closest('[data-act=close]')) $('#dlgLooks').close();
  });
  bindItems();
  el.accTools.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (sel == null || !act) return;
    snapshotAcc();
    if (act === 'flip') accs[sel].flip = !accs[sel].flip;
    else if (act === 'front') {
      accs.push(accs.splice(sel, 1)[0]);
      sel = accs.length - 1;
    } else if (act === 'del') {
      accs.splice(sel, 1);
      sel = null;
    }
    renderAcc();
    renderDock();
    markAcc();
  });

  const w = el.wrap;
  const stop = (e) => e.preventDefault();
  w.addEventListener('touchstart', stop, { passive: false });
  w.addEventListener('touchmove', stop, { passive: false });
  w.addEventListener('contextmenu', stop);
  w.addEventListener('pointerdown', onDown);
  w.addEventListener('pointermove', onMove);
  w.addEventListener('pointerup', onUp);
  w.addEventListener('pointercancel', onCancel);

  $('#mkBack').addEventListener('click', close);
  $('#mkDone').addEventListener('click', openFinish);
  el.undo.addEventListener('click', () => step(undo, redo));
  el.redo.addEventListener('click', () => step(redo, undo));
  $('#mkMore').addEventListener('click', () => el.menu.showModal());
  el.menu.addEventListener('click', onMenu);
  bindFinish();
  window.addEventListener('resize', () => face && fit());
  document.addEventListener('visibilitychange', () => document.hidden && saveNow());
}

function savePrefs() {
  setSetting('makeupPrefs', prefs);
}

// ---------- 열기·닫기 ----------
export async function openMakeup(f) {
  face = f;
  el.title.textContent = f.name;
  showScreen('makeup');
  const bx = el.base.getContext('2d');
  const sx = el.shade.getContext('2d');
  const fx = el.feat.getContext('2d');
  for (const x of [bx, sx, fx, dctx, rctx]) x.clearRect(0, 0, FW, FH);
  el.stage.style.background = `radial-gradient(circle at 50% 43%, rgba(255,255,255,.75), rgba(255,255,255,0) 48%), ${f.bg}`;
  let skin;
  if (f.custom) {
    // 올린 사진: 사진이 바탕이고, 눈·입 세 점으로 화장 영역을 사진 얼굴에 맞춘다
    setFaceTransform(affineFrom([f.lm.l, f.lm.r, f.lm.m]));
    const photo = await getFile(`face_${f.id}`, 'photo');
    if (photo) bx.drawImage(await loadImage(photo), 0, 0, FW, FH);
    const [cx, cy] = tp(CHEEKS_AT[0][0], CHEEKS_AT[0][1]);
    skin = bx.getImageData(clamp(cx | 0, 0, FW - 1), clamp(cy | 0, 0, FH - 1), 1, 1).data;
  } else {
    setFaceTransform(new DOMMatrix());
    drawBase(bx, f, false);
    drawShading(sx, f);
    drawFeatures(fx, f);
    skin = hexToRgb(f.skin);
  }
  buildMasks(f.custom ? `${f.id}|${f.lm.l}|${f.lm.r}|${f.lm.m}` : 'builtin');
  boost = (0.299 * skin[0] + 0.587 * skin[1] + 0.114 * skin[2]) / 255 < 0.55 ? 1.25 : 1;
  for (const k of MK_LAYERS) {
    lctx[k].clearRect(0, 0, FW, FH);
    const blob = await getFile(`mk_${f.id}`, k);
    if (blob) lctx[k].drawImage(await loadImage(blob), 0, 0, FW, FH);
  }
  glitterCells = new Map();
  glitterCount = 0;
  const saved = await getSetting(`mk:${f.id}`, null);
  accs = saved?.acc ? structuredClone(saved.acc) : [];
  sel = null;
  undo = [];
  redo = [];
  dirty = new Set();
  accDirty = false;
  updateUndo();
  setSeg(seg);
  fit();
}

async function close() {
  if (st) endStroke();
  await saveNow();
  face = null;
  el.loupe.hidden = true;
  showScreen('library');
  onClose();
}

function fit() {
  const r = el.wrap.getBoundingClientRect();
  scale = Math.min(r.width / FW, r.height / FH) * 0.96;
  el.stage.style.transform = `translate(${(r.width - FW * scale) / 2}px, ${(r.height - FH * scale) / 2}px) scale(${scale})`;
  el.stage.style.setProperty('--inv', 1 / scale);
}

function setSeg(s) {
  seg = s;
  $$('#mkSeg button').forEach((b) => b.classList.toggle('on', b.dataset.seg === s));
  el.stage.classList.toggle('acc-mode', s === 'acc');
  if (s === 'makeup') sel = null;
  renderRail();
  renderDock();
  renderAcc();
}

// ---------- 화면 그리기 ----------
function renderRail() {
  if (seg === 'makeup') {
    el.rail.innerHTML = MK_TOOLS.map(
      (t) => `<button class="mk-tool ${t.id === prefs.tool ? 'on' : ''}" data-tool="${t.id}" aria-pressed="${t.id === prefs.tool}">${toolIcon(t, shadeOf(t))}<span>${t.name}</span></button>`,
    ).join('');
  } else {
    el.rail.innerHTML = ACC_CATS.map(
      (c) => `<button class="mk-tool ${c.id === prefs.cat ? 'on' : ''}" data-cat="${c.id}" aria-pressed="${c.id === prefs.cat}">${accThumb(ACC_MAP[CAT_ICON[c.id]])}<span>${c.name}</span></button>`,
    ).join('');
  }
}

const accThumb = (d) => (d.emoji ? `<i class="emo">${d.emoji}</i>` : accThumbSvg(d));
const swatches = (list, on) =>
  list.map((c) => `<button class="sw ${c === on ? 'on' : ''}" data-c="${c}" style="--c:${c}" aria-label="${NAMES[c] || c}" aria-pressed="${c === on}"></button>`).join('');

function renderDock() {
  const makeup = seg === 'makeup';
  el.mirror.hidden = !makeup;
  el.looks.hidden = !makeup;
  el.sizes.hidden = !makeup;
  el.items.hidden = makeup;
  if (makeup) {
    const t = curTool();
    el.accTools.hidden = true;
    el.mirror.classList.toggle('on', !!(t.mirror && prefs.mirror));
    el.mirror.classList.toggle('dim', !t.mirror);
    el.mirror.disabled = !t.mirror;
    const cur = prefs.sizes[t.id] ?? 1;
    const c = t.eraser ? '#9ED3F5' : shadeOf(t);
    // 굵기 점 = 미리보기: 도구의 가장자리 부드러움까지 보여 준다
    const soft = Math.round((t.hard ?? 0.5) * 100);
    el.sizes.innerHTML = SIZE_F.map(
      (_, i) => `<button class="size-dot ${i === cur ? 'on' : ''}" data-i="${i}" aria-label="굵기 ${i + 1}" aria-pressed="${i === cur}"><i style="width:${14 + i * 10}px;height:${14 + i * 10}px;background:radial-gradient(circle, ${c} ${soft}%, ${c}00 100%)"></i></button>`,
    ).join('');
    el.shades.hidden = !t.palette.length;
    const cs = shadeOf(t);
    el.shades.innerHTML = swatches(t.palette.includes(cs) || !t.palette.length ? t.palette : [cs, ...t.palette], cs);
    return;
  }
  el.items.innerHTML = ACC.filter((a) => a.cat === prefs.cat)
    .map((a) => `<button class="acc-item" data-key="${a.key}" aria-label="${a.name}">${accThumb(a)}</button>`)
    .join('');
  const s = sel != null ? accs[sel] : null;
  const tintable = s && !ACC_MAP[s.key].emoji;
  el.accTools.hidden = !s;
  el.shades.hidden = !tintable;
  if (tintable) el.shades.innerHTML = swatches(TINT, s.c);
}

function renderAcc(guide) {
  el.acc.innerHTML =
    accs
      .map((a, i) => {
        const d = ACC_MAP[a.key];
        if (!d) return '';
        const h = accHeight(d, a.w);
        const body = d.emoji ? `<span class="emo" style="font-size:${h * 0.86}px">${d.emoji}</span>` : accSvg(d, a.c);
        const handles = i === sel ? `<b class="h h-del" data-h="del">${ICON.close}</b><b class="h h-rot" data-h="rot">${ICON.redo}</b>` : '';
        return `<div class="acc ${i === sel ? 'sel' : ''}" data-i="${i}" style="left:${a.x - a.w / 2}px;top:${a.y - h / 2}px;width:${a.w}px;height:${h}px;transform:rotate(${a.rot}deg) scaleX(${a.flip ? -1 : 1})">${body}${handles}</div>`;
      })
      .join('') + (guide ? `<div class="acc-guide" style="left:${guide.x - guide.r}px;top:${guide.y - guide.r}px;width:${guide.r * 2}px;height:${guide.r * 2}px"></div>` : '');
}

// ---------- 화장 칠하기 ----------
const toStage = (e) => {
  const r = el.stage.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * FW, y: ((e.clientY - r.top) / r.height) * FH };
};

function onDown(e) {
  if (!face || el.finish.hidden === false) return;
  if (e.pointerType === 'pen') penSeen = true;
  if (seg === 'acc') {
    accDown(e);
    return;
  }
  if (e.pointerType === 'touch' && penSeen) return; // 펜슬을 쓰면 손바닥·손가락은 무시
  // 칠하는 중 다른 손가락이 닿으면 그 손동작은 없던 일로 한다
  if (st) {
    cancelStroke();
    return;
  }
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  try {
    el.wrap.setPointerCapture(e.pointerId);
  } catch {}
  beginStroke(e);
}

function onMove(e) {
  if (seg === 'acc') {
    accMove(e);
    return;
  }
  if (!st || e.pointerId !== st.id) return;
  const list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
  for (const ev of list && list.length ? list : [e]) {
    const p = toStage(ev);
    addPoint(p.x, p.y, pressureOf(ev));
  }
  refresh();
  showLoupe(e);
}

function onUp(e) {
  if (seg === 'acc') {
    accUp(e);
    return;
  }
  if (st && e.pointerId === st.id) endStroke();
}

function onCancel(e) {
  if (seg === 'acc') accUp(e);
  else if (st && e.pointerId === st.id) cancelStroke();
}

function beginStroke(e) {
  const t = curTool();
  const p0 = toStage(e);
  const mask = maskFor(t);
  let off = { x: 0, y: 0 };
  if (t.snap && !freeMode) {
    const s = snapPoint(mask, p0.x, p0.y, Ue * t.snap);
    if (s) off = { x: s.x - p0.x, y: s.y - p0.y };
  }
  const layers = t.eraser ? MK_LAYERS : t.shine ? [t.layer, 'shine'] : [t.layer];
  for (const k of layers) {
    bkp[k].clearRect(0, 0, FW, FH);
    bkp[k].drawImage(lctx[k].canvas, 0, 0);
  }
  st = {
    t, mask, off, layers, color: shadeOf(t), mirror: !!(t.mirror && prefs.mirror),
    // 얼굴 화장 붓은 얼굴 크기에, 자유 그림 붓은 종이 크기에 맞춘다
    r: (t.anywhere ? U : Ue) * t.r * SIZE_F[prefs.sizes[t.id] ?? 1], box: [Infinity, Infinity, -Infinity, -Infinity],
    last: null, sm: null, carry: 0, len: 0, t0: performance.now(), id: e.pointerId, type: e.pointerType,
    start: { x: p0.x + off.x, y: p0.y + off.y }, dab: t.eraser || t.glitter ? null : dabFor(shadeOf(t), t.hard),
  };
  if (t.eraser) st.dab = dabFor('#000000', t.hard);
  rctx.clearRect(0, 0, FW, FH);
  dctx.clearRect(0, 0, FW, FH);
  el.scratch.style.opacity = Math.min(1, (t.flow || 1) * boost);
  addPoint(p0.x, p0.y, pressureOf(e));
  refresh();
  showLoupe(e);
}

function addPoint(x, y, p) {
  x += st.off.x;
  y += st.off.y;
  // 작은 손 떨림은 줄이되, 그린 방향과 모양은 그대로 둔다
  if (st.sm) {
    x = st.sm.x + (x - st.sm.x) * 0.55;
    y = st.sm.y + (y - st.sm.y) * 0.55;
  }
  st.sm = { x, y };
  const r = st.r * (0.75 + 0.25 * p);
  if (!st.last) {
    stamp(x, y, r, p);
    st.last = { x, y };
    return;
  }
  const dx = x - st.last.x;
  const dy = y - st.last.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.5) return;
  st.len += d;
  // 거리마다 일정한 간격으로 찍어서, 빨리 그어도 끊기지 않고 천천히 그어도 뭉치지 않는다
  const gap = Math.max(1, r * (st.t.glitter ? 0.7 : 0.16));
  let t = gap - st.carry;
  while (t <= d) {
    stamp(st.last.x + (dx * t) / d, st.last.y + (dy * t) / d, r, p);
    t += gap;
  }
  st.carry = d - (t - gap);
  st.last = { x, y };
}

function grow(x, y, r) {
  const b = st.box;
  b[0] = Math.min(b[0], x - r);
  b[1] = Math.min(b[1], y - r);
  b[2] = Math.max(b[2], x + r);
  b[3] = Math.max(b[3], y + r);
}

function stamp(x, y, r, p) {
  const pts = st.mirror ? [[x, y], mirrorPt(x, y)] : [[x, y]];
  for (const [px, py] of pts) {
    grow(px, py, r + 2);
    if (st.t.eraser) {
      for (const k of MK_LAYERS) {
        const c = lctx[k];
        c.globalCompositeOperation = 'destination-out';
        c.globalAlpha = 0.45;
        c.drawImage(st.dab, px - r, py - r, r * 2, r * 2);
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'source-over';
      }
    } else if (st.t.glitter) sparkle(px, py, r);
    else {
      rctx.globalAlpha = st.t.dabA * (0.6 + 0.4 * p);
      rctx.drawImage(st.dab, px - r, py - r, r * 2, r * 2);
    }
  }
}

// 반짝이: 바탕을 가리지 않는 작은 점. 칸마다 개수를 제한해 한곳에 뭉치지 않게 한다
function sparkle(x, y, r) {
  const c = lctx.shine;
  const [cr, cg, cb] = hexToRgb(st.color);
  for (let n = 0; n < 2; n++) {
    if (glitterCount > 3000) return;
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * r;
    const px = x + Math.cos(a) * d;
    const py = y + Math.sin(a) * d;
    if (maskA(st.mask, px, py) < 120) continue;
    const key = ((px / 18) | 0) * 1000 + ((py / 18) | 0);
    const k = glitterCells.get(key) || 0;
    if (k >= 3) continue;
    glitterCells.set(key, k + 1);
    glitterCount++;
    const s = Ue * (0.004 + Math.random() * 0.006);
    const mixW = Math.random() * 0.6;
    c.fillStyle = `rgba(${Math.round(cr + (255 - cr) * mixW)},${Math.round(cg + (255 - cg) * mixW)},${Math.round(cb + (255 - cb) * mixW)},0.95)`;
    c.beginPath();
    if (Math.random() < 0.3) {
      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI) / 4;
        const rr = i % 2 ? s * 0.6 : s * 2.2;
        c.lineTo(px + Math.cos(ang) * rr, py + Math.sin(ang) * rr);
      }
    } else c.arc(px, py, s, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.beginPath();
    c.arc(px - s * 0.3, py - s * 0.3, s * 0.35, 0, Math.PI * 2);
    c.fill();
  }
}

// 붓 자국을 도구 영역으로 잘라서 화면에 보여 준다 (가장자리는 영역의 부드러움을 따라 옅어진다)
function refresh(s = st) {
  if (!s || s.t.eraser || s.t.glitter) return;
  dctx.clearRect(0, 0, FW, FH);
  dctx.globalCompositeOperation = 'source-over';
  dctx.drawImage(raw, 0, 0);
  if (s.mask) {
    dctx.globalCompositeOperation = 'destination-in';
    dctx.drawImage(masks[s.mask], 0, 0);
    dctx.globalCompositeOperation = 'source-over';
  }
}

function rectOf(box) {
  const x0 = Math.max(0, Math.floor(box[0]));
  const y0 = Math.max(0, Math.floor(box[1]));
  const x1 = Math.min(FW, Math.ceil(box[2]));
  const y1 = Math.min(FH, Math.ceil(box[3]));
  return x1 > x0 && y1 > y0 ? [x0, y0, x1 - x0, y1 - y0] : null;
}

// 톡 누르면 그 부위에 기본 진하기로 한 번에 바른다.
// 거리 판단과 그리기는 본 좌표에서 하고(T로 화면에 옮김), 칠한 범위(box)는 화면 좌표로 넓힌다
function autoApply(s) {
  const q = Ti.transformPoint({ x: s.start.x, y: s.start.y });
  const near = (list, R) => {
    let best = null;
    for (const c of list) {
      const d = Math.hypot(c[0] - q.x, c[1] - q.y);
      if (d < R && (!best || d < best.d)) best = { c, d };
    }
    return best;
  };
  const growBox = (x0, y0, x1, y1) => {
    for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
      const [sx, sy] = tp(x, y);
      s.box[0] = Math.min(s.box[0], sx);
      s.box[1] = Math.min(s.box[1], sy);
      s.box[2] = Math.max(s.box[2], sx);
      s.box[3] = Math.max(s.box[3], sy);
    }
  };
  if (s.t.auto === 'lips') {
    if (Math.hypot(MOUTH_AT[0] - q.x, MOUTH_AT[1] - q.y) > U * 0.17) return false;
    rctx.clearRect(0, 0, FW, FH);
    rctx.save();
    rctx.setTransform(T);
    rctx.globalAlpha = 1;
    rctx.fillStyle = s.color;
    LIP_PATHS().forEach((p) => rctx.fill(p));
    rctx.restore();
    s.box = [Infinity, Infinity, -Infinity, -Infinity];
    growBox(MOUTH_AT[0] - 110, MOUTH_AT[1] - 70, MOUTH_AT[0] + 110, MOUTH_AT[1] + 70);
    return true;
  }
  const list = s.t.auto === 'cheek' ? CHEEKS_AT : LIDS_AT;
  const hit = near(list, U * 0.22);
  if (!hit) return false;
  const targets = s.mirror ? list : [hit.c];
  rctx.clearRect(0, 0, FW, FH);
  rctx.globalAlpha = 1;
  const [cr, cg, cb] = hexToRgb(s.color);
  s.box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [cx, cy] of targets) {
    const [rx, ry] = s.t.auto === 'cheek' ? [U * 0.15, U * 0.11] : [U * 0.19, U * 0.1];
    rctx.save();
    rctx.setTransform(T);
    rctx.translate(cx, cy);
    rctx.scale(1, ry / rx);
    const g = rctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(${cr},${cg},${cb},0.9)`);
    g.addColorStop(0.5, `rgba(${cr},${cg},${cb},0.6)`);
    g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    rctx.fillStyle = g;
    rctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    rctx.restore();
    growBox(cx - rx, cy - ry, cx + rx, cy + ry);
  }
  return true;
}

// 손동작 하나를 화장 층에 더한다. 한 번에 flow 이상 진해지지 않고, 덧칠해도 max를 넘지 않는다
function commit(s, rect) {
  const [x0, y0, w, h] = rect;
  const disp = dctx.getImageData(x0, y0, w, h).data;
  const L = lctx[s.t.layer].getImageData(x0, y0, w, h);
  const Ld = L.data;
  const [cr, cg, cb] = hexToRgb(s.color);
  const flow = Math.min(1, s.t.flow * boost);
  const max = Math.min(0.97, s.t.max * boost);
  let S = null;
  let Sd = null;
  const shineM = maskData.lipShine;
  if (s.t.shine) {
    S = lctx.shine.getImageData(x0, y0, w, h);
    Sd = S.data;
  }
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const i = (yy * w + xx) * 4;
      const a = (disp[i + 3] / 255) * flow;
      if (a < 0.004) continue;
      const oa = Ld[i + 3] / 255;
      const keep = oa * (1 - a);
      const na = a + keep;
      Ld[i] = (cr * a + Ld[i] * keep) / na;
      Ld[i + 1] = (cg * a + Ld[i + 1] * keep) / na;
      Ld[i + 2] = (cb * a + Ld[i + 2] * keep) / na;
      Ld[i + 3] = Math.min(na, Math.max(max, oa)) * 255;
      if (Sd) {
        const sa = (shineM[(y0 + yy) * FW + x0 + xx] / 255) * a * 0.9;
        if (sa > 0.01) {
          const so = Sd[i + 3] / 255;
          const sk = so * (1 - sa);
          const sn = sa + sk;
          Sd[i] = (255 * sa + Sd[i] * sk) / sn;
          Sd[i + 1] = (255 * sa + Sd[i + 1] * sk) / sn;
          Sd[i + 2] = (255 * sa + Sd[i + 2] * sk) / sn;
          Sd[i + 3] = Math.min(sn, 0.75) * 255;
        }
      }
    }
  }
  lctx[s.t.layer].putImageData(L, x0, y0);
  if (S) lctx.shine.putImageData(S, x0, y0);
}

function endStroke() {
  const s = st;
  st = null;
  el.loupe.hidden = true;
  const tap = performance.now() - s.t0 < 350 && s.len < Ue * 0.02;
  if (tap && s.t.auto) {
    if (autoApply(s)) refresh(s);
  }
  const rect = rectOf(s.box);
  if (rect && !s.t.eraser && !s.t.glitter) commit(s, rect);
  rctx.clearRect(0, 0, FW, FH);
  dctx.clearRect(0, 0, FW, FH);
  if (!rect) return;
  const [x, y, w, h] = rect;
  pushUndo({ type: 'paint', parts: s.layers.map((k) => ({ layer: k, x, y, img: bkp[k].getImageData(x, y, w, h) })) });
  s.layers.forEach((k) => dirty.add(k));
}

function cancelStroke() {
  const s = st;
  st = null;
  el.loupe.hidden = true;
  rctx.clearRect(0, 0, FW, FH);
  dctx.clearRect(0, 0, FW, FH);
  for (const k of s.layers) {
    lctx[k].clearRect(0, 0, FW, FH);
    lctx[k].drawImage(bkp[k].canvas, 0, 0);
  }
}

// ---------- 확대경: 작은 부위를 손가락으로 칠할 때 손가락 위쪽에 크게 보여 준다 ----------
function showLoupe(e) {
  if (!st || !st.t.small || st.type !== 'touch') return;
  const p = toStage(e);
  const wr = el.wrap.getBoundingClientRect();
  const L = el.loupe;
  L.hidden = false;
  let top = e.clientY - wr.top - 90 - 150;
  if (top < 4) top = e.clientY - wr.top + 70;
  L.style.left = clamp(e.clientX - wr.left - 90, 4, wr.width - 184) + 'px';
  L.style.top = top + 'px';
  if (loupeQueued) return;
  loupeQueued = true;
  requestAnimationFrame(() => {
    loupeQueued = false;
    if (!st) return;
    const x = L.getContext('2d');
    const src = 180 / (scale * 2.4);
    const sx = p.x + st.off.x - src / 2;
    const sy = p.y + st.off.y - src / 2;
    x.save();
    x.clearRect(0, 0, 180, 180);
    x.beginPath();
    x.arc(90, 90, 88, 0, Math.PI * 2);
    x.clip();
    x.fillStyle = face.bg;
    x.fillRect(0, 0, 180, 180);
    const draw = (c, alpha = 1, op = 'source-over') => {
      x.globalAlpha = alpha;
      x.globalCompositeOperation = op;
      x.drawImage(c, sx, sy, src, src, 0, 0, 180, 180);
    };
    draw(el.base);
    for (const k of MK_LAYERS) if (!OWN_EL[k]) draw(lctx[k].canvas);
    draw(el.scratch, +el.scratch.style.opacity || 1);
    draw(el.shade, 1, 'multiply');
    draw(el.shine);
    draw(el.feat);
    draw(el.doodle);
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'source-over';
    x.strokeStyle = 'rgba(36,27,58,.6)';
    x.lineWidth = 2;
    x.beginPath();
    x.arc(90, 90, Math.max(4, st.r * scale * 2.4), 0, Math.PI * 2);
    x.stroke();
    x.restore();
  });
}

// ---------- 액세서리 ----------
const anchorOf = (d) => tp(d.at[0], d.at[1]);

function addAcc(key, at) {
  const d = ACC_MAP[key];
  snapshotAcc();
  // 같은 것을 여러 번 누르면 겹치지 않게 조금씩 비켜서 놓는다
  const same = accs.filter((a) => a.key === key).length;
  const jitter = d.emoji && !at ? (Math.random() - 0.5) * 160 : 0;
  // 기본 자리는 본 좌표 → 올린 사진이면 사진 얼굴 위치·크기·기울기에 맞춘다
  const [ax, ay] = anchorOf(d);
  const x = at ? at.x : ax + jitter + same * 46;
  const y = at ? at.y : ay + jitter * 0.6 + same * 34;
  accs.push({ key, x, y, w: d.at[2] * Sc, rot: (d.rot || 0) + ANG, c: d.c || null, flip: false });
  sel = accs.length - 1;
  renderAcc();
  renderDock();
  markAcc();
}

// 목록에서 끌어서 붙이기: 끄는 동안 그림이 손가락을 따라오고, 원래 자리 바로 가까이 가면 붙일 곳을 안내한다.
// 옆으로 밀면 목록이 넘어가고, 위로 끌면 붙이기가 된다 (브라우저 스크롤에 맡기면 끌기가 중간에 끊겨서 직접 처리한다)
function bindItems() {
  el.items.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-key]');
    drag = { key: b?.dataset.key, id: e.pointerId, x0: e.clientX, y0: e.clientY, mode: null, snap: null, scroll0: el.items.scrollLeft };
    try {
      el.items.setPointerCapture(e.pointerId);
    } catch {}
  });
  el.items.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    if (!drag.mode) {
      if (Math.hypot(dx, dy) < 10) return;
      drag.mode = drag.key && Math.abs(dy) > Math.abs(dx) ? 'drag' : 'scroll';
      if (drag.mode === 'drag') {
        el.ghost.innerHTML = accThumb(ACC_MAP[drag.key]);
        el.ghost.hidden = false;
      }
    }
    if (drag.mode === 'scroll') {
      el.items.scrollLeft = drag.scroll0 - dx;
      return;
    }
    const d = ACC_MAP[drag.key];
    el.ghost.style.left = e.clientX + 'px';
    el.ghost.style.top = e.clientY + 'px';
    const p = toStage(e);
    const [ax, ay] = anchorOf(d);
    const near = Math.hypot(p.x - ax, p.y - ay) < Ue * 0.08;
    drag.snap = near ? { x: ax, y: ay } : null;
    drag.inside = p.x > 0 && p.y > 0 && p.x < FW && p.y < FH;
    drag.p = p;
    renderAcc(near ? { x: ax, y: ay, r: Math.max(d.at[2], accHeight(d, d.at[2])) * 0.6 * Sc } : null);
  });
  const end = (e, cancelled) => {
    if (!drag || e.pointerId !== drag.id) return;
    const g = drag;
    drag = null;
    el.ghost.hidden = true;
    if (g.mode === 'scroll') return;
    if (cancelled) {
      renderAcc();
      return;
    }
    if (!g.mode) {
      if (g.key) addAcc(g.key);
    } else if (g.inside) addAcc(g.key, g.snap || g.p);
    else renderAcc();
  };
  el.items.addEventListener('pointerup', (e) => end(e, false));
  el.items.addEventListener('pointercancel', (e) => end(e, true));
}

const ang = (dx, dy) => (Math.atan2(dy, dx) * 180) / Math.PI;

function accDown(e) {
  // 화면 밖에서 손을 뗀 손가락이 남아 있으면 다음 터치가 '두 번째 손가락'으로 잘못 읽혀 아무것도 안 된다.
  // 첫 손가락이 닿을 때마다 새로 시작하고, 손을 어디서 떼도 알 수 있게 포인터를 붙잡아 둔다
  if (e.isPrimary) {
    pointers.clear();
    gest = null;
  }
  try {
    el.wrap.setPointerCapture(e.pointerId);
  } catch {}
  pointers.set(e.pointerId, toStage(e));
  if (pointers.size === 2 && sel != null) {
    const [p, q] = [...pointers.values()];
    const a = accs[sel];
    gest = { type: 'pinch', d0: Math.hypot(q.x - p.x, q.y - p.y), a0: ang(q.x - p.x, q.y - p.y), w0: a.w, r0: a.rot, mx: (p.x + q.x) / 2, my: (p.y + q.y) / 2, x0: a.x, y0: a.y };
    return;
  }
  if (pointers.size > 1) return;
  const h = e.target.closest('[data-h]');
  const box = e.target.closest('.acc');
  const p = pointers.get(e.pointerId);
  if (h && sel != null) {
    snapshotAcc();
    if (h.dataset.h === 'del') {
      accs.splice(sel, 1);
      sel = null;
      renderAcc();
      renderDock();
      markAcc();
      return;
    }
    const a = accs[sel];
    gest = { type: 'rot', a0: ang(p.x - a.x, p.y - a.y), d0: Math.hypot(p.x - a.x, p.y - a.y), w0: a.w, r0: a.rot };
    return;
  }
  if (box) {
    const i = +box.dataset.i;
    if (sel !== i) {
      sel = i;
      renderAcc();
      renderDock();
    }
    snapshotAcc();
    gest = { type: 'drag', px: p.x, py: p.y, x0: accs[i].x, y0: accs[i].y };
    return;
  }
  if (sel != null) {
    sel = null;
    renderAcc();
    renderDock();
  }
}

function accMove(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, toStage(e));
  if (!gest || sel == null) return;
  const a = accs[sel];
  const p = pointers.get(e.pointerId);
  if (gest.type === 'drag') {
    a.x = gest.x0 + p.x - gest.px;
    a.y = gest.y0 + p.y - gest.py;
  } else if (gest.type === 'rot') {
    a.w = clamp((gest.w0 * Math.hypot(p.x - a.x, p.y - a.y)) / Math.max(1, gest.d0), 30, 1500);
    a.rot = gest.r0 + ang(p.x - a.x, p.y - a.y) - gest.a0;
  } else if (gest.type === 'pinch' && pointers.size >= 2) {
    const [p1, q] = [...pointers.values()];
    a.w = clamp((gest.w0 * Math.hypot(q.x - p1.x, q.y - p1.y)) / Math.max(1, gest.d0), 30, 1500);
    a.rot = gest.r0 + ang(q.x - p1.x, q.y - p1.y) - gest.a0;
    a.x = gest.x0 + (p1.x + q.x) / 2 - gest.mx;
    a.y = gest.y0 + (p1.y + q.y) / 2 - gest.my;
  }
  const node = el.acc.querySelector(`.acc[data-i="${sel}"]`);
  const h = accHeight(ACC_MAP[a.key], a.w);
  Object.assign(node.style, {
    left: a.x - a.w / 2 + 'px', top: a.y - h / 2 + 'px', width: a.w + 'px', height: h + 'px',
    transform: `rotate(${a.rot}deg) scaleX(${a.flip ? -1 : 1})`,
  });
  const emo = node.querySelector('.emo');
  if (emo) emo.style.fontSize = h * 0.86 + 'px';
}

function accUp(e) {
  pointers.delete(e.pointerId);
  if (pointers.size === 0 && gest) {
    gest = null;
    markAcc();
  }
}

// ---------- 되돌리기 ----------
// 화장은 바뀐 영역 그림, 액세서리는 바뀌기 전 목록을 저장해 두고 지금 것과 맞바꾼다
function snapshotAcc() {
  pushUndo({ type: 'acc', data: JSON.stringify(accs) });
}

function pushUndo(e) {
  undo.push(e);
  if (undo.length > 40) undo.shift();
  redo = [];
  updateUndo();
  markDirty();
}

function step(from, to) {
  if (st) return;
  const e = from.pop();
  if (!e) return;
  if (e.type === 'paint') {
    for (const part of e.parts) {
      const c = lctx[part.layer];
      const now = c.getImageData(part.x, part.y, part.img.width, part.img.height);
      c.putImageData(part.img, part.x, part.y);
      part.img = now;
      dirty.add(part.layer);
    }
  } else {
    const now = JSON.stringify(accs);
    accs = JSON.parse(e.data);
    e.data = now;
    sel = null;
    renderAcc();
    renderDock();
    accDirty = true;
  }
  to.push(e);
  updateUndo();
  markDirty();
}

function updateUndo() {
  el.undo.disabled = !undo.length;
  el.redo.disabled = !redo.length;
}

// 부위만 지우기: parts = [[층, 영역 이름 또는 null(층 전체)], …]. 한 번의 되돌리기로 살릴 수 있다
function resetPart(parts) {
  pushUndo({ type: 'paint', parts: parts.map(([k]) => ({ layer: k, x: 0, y: 0, img: lctx[k].getImageData(0, 0, FW, FH) })) });
  for (const [k, maskName] of parts) {
    const c = lctx[k];
    if (maskName) {
      c.save();
      c.globalCompositeOperation = 'destination-out';
      c.drawImage(masks[maskName], 0, 0);
      c.restore();
    } else c.clearRect(0, 0, FW, FH);
    dirty.add(k);
    if (k === 'shine' && !maskName) {
      glitterCells = new Map();
      glitterCount = 0;
    }
  }
}

function onMenu(e) {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  el.menu.close();
  if (act === 'eyes') resetPart([['shadow', null], ['liner', null], ['shine', 'eyeArea']]);
  else if (act === 'lips') resetPart([['lips', null], ['shine', 'lipsCore']]);
  else if (act === 'cheeks') resetPart([['blush', null]]);
  else if (act === 'paint') resetPart([['paint', null], ['doodle', null], ['shine', null], ['foundation', null]]);
  else if (act === 'unacc' && accs.length) {
    snapshotAcc();
    accs = [];
    sel = null;
    renderAcc();
    renderDock();
    markAcc();
  } else if (act === 'export') exportImage();
  else if (act === 'wipe' && confirm('화장을 모두 지울까요? (되돌리기로 살릴 수 있어요)')) resetPart(MK_LAYERS.map((k) => [k, null]));
}

function openLooks() {
  $('#looksList').innerHTML = LOOKS.map(
    (l, i) => `<button class="look" data-look="${i}">${l.name}<span class="dots">${['lipstick', 'blush', 'shadow', 'gloss'].map((k) => `<i style="background:${l[k]}"></i>`).join('')}</span></button>`,
  ).join('');
  $('#dlgLooks').showModal();
}

// ---------- 저장 ----------
function markAcc() {
  accDirty = true;
  markDirty();
}

function markDirty() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 1500);
}

function saveNow() {
  clearTimeout(saveTimer);
  if (!face || (!dirty.size && !accDirty)) return saving;
  const f = face;
  const layers = [...dirty];
  const list = structuredClone(accs);
  dirty = new Set();
  accDirty = false;
  saving = saving
    .then(async () => {
      for (const k of layers) await putFile(`mk_${f.id}`, k, await toBlob(lctx[k].canvas));
      const c = await composite(360);
      const thumb = await toBlob(c, 'image/jpeg', 0.85);
      freeCanvas(c);
      await setSetting(`mk:${f.id}`, { acc: list, thumb, at: Date.now() });
    })
    .catch((err) => {
      layers.forEach((k) => dirty.add(k));
      toast('저장 실패: ' + err.message);
    });
  return saving;
}

const svgImages = new Map();
function svgImage(d, c) {
  const key = `${d.key}|${c}`;
  if (!svgImages.has(key)) {
    svgImages.set(
      key,
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(accSvg(d, c, d.vb[0] * 4, d.vb[1] * 4));
      }),
    );
  }
  return svgImages.get(key);
}

const FRAMES = {
  none: { pad: 0, bottom: 0 },
  wood: { pad: 70, bottom: 70, fill: '#B87B45', inner: '#8A5427', light: '#D9A06A' },
  gold: { pad: 60, bottom: 60, fill: '#E8B931', inner: '#B88A12', light: '#FFE38A' },
  polaroid: { pad: 50, bottom: 190, fill: '#FFFFFF', inner: '#E6DED3', light: '#FFFFFF' },
};

// 완성 그림: 배경 + 인물 + 화장 + 명암 + 광택 + 이목구비 + 액세서리 (+ 액자). 조작 표시는 들어가지 않는다
async function composite(maxW, opts = {}) {
  const fr = FRAMES[opts.frame || 'none'];
  const TW = FW + fr.pad * 2;
  const TH = FH + fr.pad + fr.bottom;
  const s = Math.min(1, maxW / TW);
  const c = makeCanvas(Math.round(TW * s), Math.round(TH * s));
  const x = c.getContext('2d');
  x.scale(s, s);
  if (fr.pad) {
    x.fillStyle = fr.fill;
    x.fillRect(0, 0, TW, TH);
    x.strokeStyle = fr.light;
    x.lineWidth = 8;
    x.strokeRect(6, 6, TW - 12, TH - 12);
    x.strokeStyle = fr.inner;
    x.lineWidth = 10;
    x.strokeRect(fr.pad - 6, fr.pad - 6, FW + 12, FH + 12);
  }
  x.save();
  x.translate(fr.pad, fr.pad);
  x.beginPath();
  x.rect(0, 0, FW, FH);
  x.clip();
  drawBackground(x, opts.bg || face.bg);
  x.drawImage(el.base, 0, 0);
  for (const k of MK_LAYERS) if (!OWN_EL[k]) x.drawImage(lctx[k].canvas, 0, 0);
  x.globalCompositeOperation = 'multiply';
  x.drawImage(el.shade, 0, 0);
  x.globalCompositeOperation = 'source-over';
  x.drawImage(el.shine, 0, 0);
  x.drawImage(el.feat, 0, 0);
  x.drawImage(el.doodle, 0, 0);
  for (const a of accs) {
    const d = ACC_MAP[a.key];
    if (!d) continue;
    const h = accHeight(d, a.w);
    x.save();
    x.translate(a.x, a.y);
    x.rotate((a.rot * Math.PI) / 180);
    x.scale(a.flip ? -1 : 1, 1);
    if (d.emoji) {
      x.font = `${h * 0.86}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(d.emoji, 0, h * 0.04);
    } else x.drawImage(await svgImage(d, a.c || d.c), -a.w / 2, -h / 2, a.w, h);
    x.restore();
  }
  x.restore();
  if (fr === FRAMES.polaroid) {
    x.fillStyle = '#241B3A';
    x.font = '76px "Do Hyeon", sans-serif';
    x.textAlign = 'center';
    x.fillText(`${face.name}의 꾸미기`, TW / 2, FH + fr.pad + 120);
  }
  return c;
}

// ---------- 완성 화면 ----------
const FIN_BG = ['', '#FFFFFF', '#FFE3EF', '#DFF1FF', '#E2F7EC', '#FFF1D0', '#EFE8FF', '#241B3A'];

function styleName() {
  // 입술·눈두덩에 칠해진 색 이름으로 짓는다 (외모 점수가 아니라 고른 색을 칭찬)
  const has = (k) => {
    const [x0, y0] = tp(500, 860);
    const [x1, y1] = tp(700, 960);
    const rx = clamp(Math.min(x0, x1) | 0, 0, FW - 1);
    const ry = clamp(Math.min(y0, y1) | 0, 0, FH - 1);
    const d = lctx[k].getImageData(rx, ry, Math.max(1, Math.abs(x1 - x0) | 0), Math.max(1, Math.abs(y1 - y0) | 0)).data;
    for (let i = 3; i < d.length; i += 64) if (d[i] > 30) return true;
    return false;
  };
  const pick = (has('lips') && NAMES[shadeOf(MK_TOOLS[0])]) || NAMES[shadeOf(MK_TOOLS[3])];
  return pick ? `${pick} 스타일 완성!` : '반짝반짝 스타일 완성!';
}

function bindFinish() {
  $('#finBg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-bg]');
    if (!b) return;
    finishOpts.bg = b.dataset.bg || null;
    renderFinish();
  });
  $('#finFrame').addEventListener('click', (e) => {
    const b = e.target.closest('[data-frame]');
    if (!b) return;
    finishOpts.frame = b.dataset.frame;
    renderFinish();
  });
  $('#finBack').addEventListener('click', () => (el.finish.hidden = true));
  $('#finShare').addEventListener('click', async () => {
    const c = await composite(1400, finishOpts);
    const blob = await toBlob(c, 'image/png');
    freeCanvas(c);
    await shareOrDownload(blob, `${face.name} 꾸미기.png`);
  });
  $('#finSave').addEventListener('click', async () => {
    await saveNow();
    const big = await composite(1400, finishOpts);
    const image = await toBlob(big, 'image/jpeg', 0.92);
    freeCanvas(big);
    const small = await composite(420, finishOpts);
    const thumb = await toBlob(small, 'image/jpeg', 0.85);
    freeCanvas(small);
    await db.put('gallery', { id: uid('a'), pictureId: `mk_${face.id}`, title: `${face.name} 꾸미기`, createdAt: Date.now(), image, thumb });
    el.finish.hidden = true;
    toast('내 작품에 걸었어요!');
  });
}

function openFinish() {
  if (st) endStroke();
  sel = null;
  renderAcc();
  renderDock();
  finishOpts = { bg: null, frame: 'none' };
  const title = styleName();
  $('#finTitle').textContent = title;
  el.finish.hidden = false;
  renderFinish();
  speak(title, 'ko');
}

async function renderFinish() {
  // 올린 사진은 사진 자체가 배경이라 배경 고르기를 숨긴다
  $('#finBg').hidden = $('#finBg').previousElementSibling.hidden = !!face.custom;
  $('#finBg').innerHTML = FIN_BG.map(
    (c) => `<button class="opt ${(finishOpts.bg || '') === c ? 'on' : ''}" data-bg="${c}" style="--c:${c || face.bg}" aria-label="${c ? '배경 ' + c : '기본 배경'}">${c ? '' : '기본'}</button>`,
  ).join('');
  const frames = [['none', '없음', '#FFFFFF'], ['wood', '나무', FRAMES.wood.fill], ['gold', '금색', FRAMES.gold.fill], ['polaroid', '사진', '#F4F0EA']];
  $('#finFrame').innerHTML = frames
    .map(([k, n, c]) => `<button class="opt ${finishOpts.frame === k ? 'on' : ''}" data-frame="${k}" style="--c:${c}">${n}</button>`)
    .join('');
  const c = await composite(900, finishOpts);
  const out = $('#finCanvas');
  out.width = c.width;
  out.height = c.height;
  out.getContext('2d').drawImage(c, 0, 0);
  freeCanvas(c);
}

async function exportImage() {
  const c = await composite(1400);
  const blob = await toBlob(c, 'image/png');
  freeCanvas(c);
  await shareOrDownload(blob, `${face.name} 꾸미기.png`);
}

// ---------- 처음 화면의 꾸미기 목록 ----------
const defaultThumbs = new Map();
let thumbUrls = [];

async function defaultThumb(f) {
  if (f.custom) {
    const blob = await getFile(`face_${f.id}`, 'thumb');
    const u = blob ? URL.createObjectURL(blob) : '';
    if (u) thumbUrls.push(u);
    return u;
  }
  if (!defaultThumbs.has(f.id)) {
    const c = faceThumb(f, 360);
    defaultThumbs.set(f.id, URL.createObjectURL(await toBlob(c, 'image/jpeg', 0.88)));
    freeCanvas(c);
  }
  return defaultThumbs.get(f.id);
}

const FACE_BANDS = ['#FFE3EF', '#E3F2FF', '#FFF1D0', '#EFE8FF', '#E2F7EC', '#FFE6DC'];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function renderMakeupHome(container) {
  for (const u of thumbUrls) URL.revokeObjectURL(u);
  thumbUrls = [];
  const all = await allFaces();
  const cards = await Promise.all(
    all.map(async (f, i) => {
      const saved = await getSetting(`mk:${f.id}`, null);
      let src;
      if (saved?.thumb) {
        src = URL.createObjectURL(saved.thumb);
        thumbUrls.push(src);
      } else src = await defaultThumb(f);
      const busy = saved && (saved.acc?.length || saved.thumb);
      return `<article class="card face-card" data-face="${esc(f.id)}" style="animation-delay:${Math.min(i, 12) * 30}ms;--band:${FACE_BANDS[i % FACE_BANDS.length]}">
        <div class="thumb"><img alt="" src="${src}">${busy ? '<span class="sticker sky">꾸미는 중</span>' : ''}</div>
        <div class="band"><div><div class="title">${esc(f.name)}</div><div class="sub">${f.custom ? '내가 넣은 얼굴' : '화장 · 액세서리'}</div></div></div></article>`;
    }),
  );
  const addTile = `<button class="card tile" data-act="addface"><span class="ic">${ICON.plus}</span>내 사진 넣기<small class="hint">어른이 꾹 눌러요</small></button>`;
  container.innerHTML = `<div class="grid faces">${cards.join('')}${addTile}</div>`;
  homeContainer = container;
  container.querySelector('.grid').addEventListener('click', (e) => {
    if (e.target.closest('[data-act=addface]')) {
      openFaceGate();
      return;
    }
    const c = e.target.closest('[data-face]');
    if (c) openMakeup(all.find((f) => f.id === c.dataset.face));
  });
}

// ---------- 꾸미기 목록에서 바로 '내 사진 넣기' ----------
// 아이가 실수로 못 넣도록 버튼을 1.2초 꾹 눌러야 풀린다. 사진 고르기 창은 '누르기' 동작 안에서만 열리므로
// 꾹 눌러 풀린 뒤 손을 떼는 그 순간(클릭)에 연다
let homeContainer = null;
let gateArmed = false;

function openFaceGate() {
  gateArmed = false;
  const b = $('#gateBtn');
  b.classList.remove('armed', 'holding');
  b.textContent = '꾹 눌러서 사진 고르기';
  $('#dlgFaceGate').showModal();
}

function bindFaceGate() {
  const dlg = $('#dlgFaceGate');
  const b = $('#gateBtn');
  let timer = 0;
  const cancel = () => {
    clearTimeout(timer);
    b.classList.remove('holding');
  };
  b.addEventListener('pointerdown', () => {
    if (gateArmed) return;
    b.classList.add('holding');
    timer = setTimeout(() => {
      cancel();
      gateArmed = true;
      b.classList.add('armed');
      b.textContent = '손을 떼면 사진을 골라요';
    }, 1200);
  });
  b.addEventListener('pointerleave', cancel);
  b.addEventListener('pointercancel', cancel);
  b.addEventListener('pointerup', () => !gateArmed && cancel());
  b.addEventListener('click', async () => {
    if (!gateArmed) {
      toast('어른이 버튼을 꾹 눌러 주세요');
      return;
    }
    const f = await pickFile($('#fileFace'));
    dlg.close();
    if (!f) return;
    toast('사진을 넣는 중…');
    try {
      const face = await addCustomFace(f);
      openFaceFit(face, () => homeContainer && renderMakeupHome(homeContainer));
    } catch (err) {
      console.error(err);
      toast('사진을 넣지 못했어요: ' + err.message);
    }
  });
  dlg.addEventListener('click', (e) => e.target.closest('[data-act=close]') && dlg.close());
}

// ---------- 내가 넣은 얼굴 (가족·연예인 사진) ----------
// 목록은 설정 'customFaces'에, 사진은 files 'face_{id}:photo' · 'face_{id}:thumb'에 둔다.
// lm: 화면(1200×1500) 좌표의 왼눈 l · 오른눈 r · 입 m (화면에서 본 왼쪽·오른쪽)
const toFace = (c) => ({ ...c, custom: true, bg: '#FFF1D0' });

export async function customFaces() {
  return getSetting('customFaces', []);
}

export async function allFaces() {
  return [...FACES, ...(await customFaces()).map(toFace)];
}

// 사진을 1200×1500 종이에 맞춰 넣고(빈 곳은 크림색), 눈·입 점은 일단 가운데 근처에 둔다
export async function addCustomFace(file) {
  const img = await loadImage(file);
  const fitted = drawFit(img, FH, null, true);
  const c = makeCanvas(FW, FH);
  const x = c.getContext('2d');
  x.fillStyle = '#FFF1D0';
  x.fillRect(0, 0, FW, FH);
  const s = Math.min(FW / fitted.width, FH / fitted.height);
  const w = fitted.width * s;
  const h = fitted.height * s;
  x.drawImage(fitted, (FW - w) / 2, (FH - h) / 2, w, h);
  freeCanvas(fitted);
  const list = await customFaces();
  const id = uid('f');
  // 처음 점 위치 = 기본 얼굴의 눈·입 자리 (사진을 맞춘 뒤 옮긴다)
  const face = { id, name: `얼굴 ${list.length + 1}`, createdAt: Date.now(), lm: { l: [...EYES_AT[0]], r: [...EYES_AT[1]], m: [...MOUTH_AT] } };
  await putFile(`face_${id}`, 'photo', await toBlob(c, 'image/jpeg', 0.9));
  const t = drawFit(c, 360, '#fff');
  await putFile(`face_${id}`, 'thumb', await toBlob(t, 'image/jpeg', 0.85));
  freeCanvas(t);
  freeCanvas(c);
  await setSetting('customFaces', [...list, face]);
  return face;
}

export async function updateCustomFace(id, patch) {
  const list = await customFaces();
  const i = list.findIndex((f) => f.id === id);
  if (i < 0) return;
  list[i] = { ...list[i], ...patch };
  await setSetting('customFaces', list);
}

// 얼굴 사진과 그 얼굴에 한 화장·액세서리까지 지운다 (내 작품에 건 그림은 남는다)
export async function deleteCustomFace(id) {
  await setSetting('customFaces', (await customFaces()).filter((f) => f.id !== id));
  await Promise.all(['photo', 'thumb'].map((k) => delFile(`face_${id}`, k)));
  await Promise.all([...MK_LAYERS, 'paint'].map((k) => delFile(`mk_${id}`, k)));
  await db.del('kv', `mk:${id}`);
}

// ---------- 눈·입 위치 맞추기 ----------
// 사진 위에 점 세 개(왼눈·오른눈·입)를 끌어 놓으면, 본 얼굴 윤곽(초록 선)이 따라 움직여 맞는지 보여 준다
let fitting = null;

function bindFaceFit() {
  const dlg = $('#dlgFaceFit');
  const wrap = $('#fitWrap');
  wrap.addEventListener('pointerdown', (e) => {
    const m = e.target.closest('[data-k]');
    if (!m || !fitting) return;
    fitting.drag = { k: m.dataset.k, id: e.pointerId };
    try {
      wrap.setPointerCapture(e.pointerId);
    } catch {}
    e.preventDefault();
  });
  wrap.addEventListener('pointermove', (e) => {
    if (!fitting?.drag || e.pointerId !== fitting.drag.id) return;
    const r = $('#fitCanvas').getBoundingClientRect();
    fitting.lm[fitting.drag.k] = [clamp(((e.clientX - r.left) / r.width) * FW, 0, FW), clamp(((e.clientY - r.top) / r.height) * FH, 0, FH)];
    drawFit_();
  });
  const end = () => fitting && (fitting.drag = null);
  wrap.addEventListener('pointerup', end);
  wrap.addEventListener('pointercancel', end);
  dlg.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act || !fitting) return;
    if (act === 'save') {
      const name = $('#fitName').value.trim() || fitting.face.name;
      await updateCustomFace(fitting.face.id, { lm: fitting.lm, name });
      toast('얼굴을 저장했어요');
    }
    dlg.close();
    const done = fitting.onDone;
    fitting = null;
    done?.();
  });
}

export async function openFaceFit(face, onDone) {
  const blob = await getFile(`face_${face.id}`, 'photo');
  if (!blob) return;
  fitting = { face, lm: structuredClone(face.lm), img: await loadImage(blob), onDone, drag: null };
  $('#fitName').value = face.name;
  const c = $('#fitCanvas');
  c.width = 600;
  c.height = 750;
  $('#dlgFaceFit').showModal();
  drawFit_();
}

function drawFit_() {
  const c = $('#fitCanvas');
  const x = c.getContext('2d');
  const k = c.width / FW;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, c.width, c.height);
  x.drawImage(fitting.img, 0, 0, c.width, c.height);
  // 지금 점 위치로 본 얼굴 윤곽을 사진 위에 옮겨 그린다
  const m = affineFrom([fitting.lm.l, fitting.lm.r, fitting.lm.m]);
  x.setTransform(new DOMMatrix([k, 0, 0, k, 0, 0]).multiply(m));
  x.strokeStyle = 'rgba(45,190,126,0.95)';
  x.lineWidth = 6;
  x.setLineDash([14, 10]);
  x.stroke(FACE_PATH());
  x.setLineDash([]);
  x.lineWidth = 4;
  for (const [ex, ey] of EYES_AT) x.stroke(eyePath(ex, ey));
  LIP_PATHS().forEach((p) => x.stroke(p));
  x.setTransform(1, 0, 0, 1, 0, 0);
  for (const [key, el2] of Object.entries({ l: '#fitL', r: '#fitR', m: '#fitM' })) {
    const [px, py] = fitting.lm[key];
    const n = $(el2);
    n.style.left = (px / FW) * 100 + '%';
    n.style.top = (py / FH) * 100 + '%';
  }
}
