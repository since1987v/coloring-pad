import { makeCanvas, hexToRgb, lighten } from './util.js';

// size·opacity는 기본값, min·max는 굵기 슬라이더 범위(캔버스 픽셀 기준, 도안 긴 변 2048)
// layered: 한 획을 따로 그린 뒤 마지막에 한 번에 합쳐서 획 안에서 겹친 곳이 진해지지 않게 한다
export const TOOLS = [
  { id: 'crayon', name: '크레파스', icon: '🖍️', min: 4, max: 90, size: 26, opacity: 1 },
  { id: 'pencil', name: '색연필', icon: '✏️', min: 2, max: 40, size: 9, opacity: 0.9 },
  { id: 'marker', name: '마커', icon: '🖊️', min: 4, max: 90, size: 20, opacity: 0.7, layered: true },
  { id: 'paint', name: '물감붓', icon: '🖌️', min: 4, max: 140, size: 34, opacity: 0.85, layered: true },
  { id: 'airbrush', name: '스프레이', icon: '💨', min: 10, max: 200, size: 60, opacity: 0.6 },
  { id: 'glitter', name: '반짝이', icon: '✨', min: 8, max: 120, size: 34, opacity: 1 },
  { id: 'rainbow', name: '무지개', icon: '🌈', min: 4, max: 90, size: 22, opacity: 1 },
  { id: 'fill', name: '채우기', icon: '🪣', opacity: 1 },
  { id: 'eraser', name: '지우개', icon: '🧽', min: 4, max: 200, size: 40, opacity: 1 },
];

// [최소 비율, 필압 비율] → 굵기 = size × (최소 + 필압 × 필압 비율)
const WIDTH = {
  crayon: [0.55, 0.45],
  pencil: [0.5, 0.5],
  marker: [0.85, 0.15],
  paint: [0.3, 0.7],
  rainbow: [0.7, 0.3],
  eraser: [0.6, 0.4],
  airbrush: [0.6, 0.4],
  glitter: [1, 0],
};

// ---- 종이 결(grain) 텍스처 ----
// 캔버스 원점 기준으로 반복되는 패턴이라 여러 번 칠해도 같은 자리에 빈틈이 남아 크레파스 질감이 난다
const G = 256;
let coarse = null;
let fine = null;

function tileNoise(octaves) {
  const out = new Float32Array(G * G);
  for (const [cell, wt] of octaves) {
    const n = Math.max(2, Math.round(G / cell));
    const g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = Math.random();
    for (let y = 0; y < G; y++) {
      const fy = (y / G) * n;
      const y0 = Math.floor(fy);
      const y1 = (y0 + 1) % n;
      const ty = fy - y0;
      const sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < G; x++) {
        const fx = (x / G) * n;
        const x0 = Math.floor(fx);
        const x1 = (x0 + 1) % n;
        const tx = fx - x0;
        const sx = tx * tx * (3 - 2 * tx);
        const top = g[y0 * n + x0] + (g[y0 * n + x1] - g[y0 * n + x0]) * sx;
        const bot = g[y1 * n + x0] + (g[y1 * n + x1] - g[y1 * n + x0]) * sx;
        out[y * G + x] += wt * (top + (bot - top) * sy);
      }
    }
  }
  let mean = 0;
  for (const v of out) mean += v;
  mean /= out.length;
  let vr = 0;
  for (const v of out) vr += (v - mean) ** 2;
  const sd = Math.sqrt(vr / out.length) || 1;
  for (let i = 0; i < out.length; i++) out[i] = Math.min(1, Math.max(0, 0.5 + (out[i] - mean) / (sd * 3.5)));
  return out;
}

function grains() {
  if (!coarse) {
    coarse = tileNoise([[8, 0.35], [4, 0.35], [2, 0.2], [1, 0.25]]);
    fine = tileNoise([[3, 0.3], [1, 0.7]]);
  }
}

// 필압 단계별 문턱값: 세게 누를수록 문턱이 낮아져 빈틈이 줄어든다
const CRAYON_T = [0.62, 0.52, 0.42, 0.3];
const PENCIL_T = [0.62, 0.5, 0.38, 0.26];
const patterns = new Map();

function grainPattern(ctx, kind, color, level) {
  const key = `${kind}|${color}|${level}`;
  let p = patterns.get(key);
  if (p) return p;
  grains();
  const [r, g, b] = hexToRgb(color);
  const c = makeCanvas(G, G);
  const x = c.getContext('2d');
  const d = x.createImageData(G, G);
  const px = d.data;
  const src = kind === 'crayon' ? coarse : fine;
  for (let i = 0; i < G * G; i++) {
    const v = src[i];
    let a;
    if (kind === 'crayon') {
      const t = CRAYON_T[level];
      a = v < t ? 0 : Math.min(1, 0.6 + (v - t) * 2.5);
    } else {
      a = Math.max(0, Math.min(1, (v - PENCIL_T[level]) * 2.2));
    }
    const j = i * 4;
    px[j] = r;
    px[j + 1] = g;
    px[j + 2] = b;
    px[j + 3] = a * 255;
  }
  x.putImageData(d, 0, 0);
  p = ctx.createPattern(c, 'repeat');
  if (patterns.size > 60) patterns.delete(patterns.keys().next().value);
  patterns.set(key, p);
  return p;
}

const dabs = new Map();
function softDab(color) {
  let c = dabs.get(color);
  if (c) return c;
  const [r, g, b] = hexToRgb(color);
  c = makeCanvas(64, 64);
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${r},${g},${b},1)`);
  gr.addColorStop(0.45, `rgba(${r},${g},${b},0.55)`);
  gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr;
  x.fillRect(0, 0, 64, 64);
  if (dabs.size > 30) dabs.delete(dabs.keys().next().value);
  dabs.set(color, c);
  return c;
}

function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4;
    const rr = i % 2 ? r * 0.28 : r;
    ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

const level = (p) => Math.min(3, Math.floor(p * 4));

// 한 번의 획. 점들을 중점 기준 2차 곡선으로 이어 부드럽게 그린다
export class Stroke {
  constructor(tool, color, size, opacity, pctx, sctx) {
    Object.assign(this, { tool, color, size, opacity, pctx, sctx });
    this.ctx = tool.layered ? sctx : pctx;
    this.last = null;
    this.lastMid = null;
    this.count = 0;
    this.box = [Infinity, Infinity, -Infinity, -Infinity];
    this.hue = Math.random() * 360;
    this.carry = 0;
  }

  width(p) {
    const [a, b] = WIDTH[this.tool.id];
    return this.size * (a + b * p);
  }

  add(x, y, p) {
    const last = this.last;
    if (last) {
      if ((x - last.x) ** 2 + (y - last.y) ** 2 < 2.25) return;
      p = last.p * 0.6 + p * 0.4;
      const m = { x: (last.x + x) / 2, y: (last.y + y) / 2, p: (last.p + p) / 2 };
      this.draw(this.lastMid, last, m);
      this.lastMid = m;
    } else {
      const pt = { x, y, p };
      this.lastMid = pt;
      this.draw(pt, pt, { x: x + 0.01, y, p });
    }
    this.last = { x, y, p };
    this.count++;
  }

  finish() {
    if (this.count > 1) this.draw(this.lastMid, this.last, this.last);
  }

  draw(a, c, b) {
    const t = this.tool.id;
    if (t === 'airbrush') return this.spray(a, b, c.p);
    if (t === 'glitter') return this.sparkle(a, b);
    const ctx = this.ctx;
    const w = this.width(c.p);
    let pad = w / 2 + 2;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = w;
    switch (t) {
      case 'crayon':
      case 'pencil':
        ctx.strokeStyle = grainPattern(ctx, t, this.color, level(c.p));
        ctx.globalAlpha = this.opacity;
        break;
      case 'marker':
        ctx.strokeStyle = this.color;
        break;
      case 'paint':
        ctx.strokeStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = w * 0.5;
        pad += w;
        break;
      case 'rainbow': {
        this.hue = (this.hue + Math.hypot(b.x - a.x, b.y - a.y) * 0.35) % 360;
        ctx.strokeStyle = `hsl(${this.hue},90%,55%)`;
        ctx.globalAlpha = this.opacity;
        break;
      }
      case 'eraser':
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = '#000';
        ctx.globalAlpha = this.opacity;
        break;
    }
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(c.x, c.y, b.x, b.y);
    ctx.stroke();
    ctx.restore();
    this.grow(a, pad);
    this.grow(c, pad);
    this.grow(b, pad);
  }

  spray(a, b, p) {
    const ctx = this.ctx;
    const r = this.width(p);
    const dab = softDab(this.color);
    const step = Math.max(1, r * 0.15);
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    ctx.save();
    ctx.globalAlpha = this.opacity * 0.16 * (0.4 + 0.6 * p);
    let t = this.carry;
    while (t <= d) {
      const k = d ? t / d : 0;
      ctx.drawImage(dab, a.x + (b.x - a.x) * k - r, a.y + (b.y - a.y) * k - r, r * 2, r * 2);
      t += step;
    }
    this.carry = t - d;
    ctx.restore();
    this.grow(a, r + 1);
    this.grow(b, r + 1);
  }

  sparkle(a, b) {
    const ctx = this.ctx;
    const R = this.size / 2;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(((d + 1) * this.size) / 45));
    const cols = [this.color, lighten(this.color, 0.45), lighten(this.color, 0.75), '#FFF6B0'];
    ctx.save();
    for (let i = 0; i < n; i++) {
      const k = Math.random();
      const ang = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(Math.random()) * R;
      const x = a.x + (b.x - a.x) * k + Math.cos(ang) * rr;
      const y = a.y + (b.y - a.y) * k + Math.sin(ang) * rr;
      const s = Math.max(1, this.size * (0.03 + Math.random() * 0.07));
      ctx.globalAlpha = this.opacity * (0.6 + Math.random() * 0.4);
      ctx.fillStyle = cols[(Math.random() * cols.length) | 0];
      if (Math.random() < 0.18) star(ctx, x, y, s * 2.4);
      else {
        ctx.beginPath();
        ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    const pad = R + this.size * 0.2;
    this.grow(a, pad);
    this.grow(b, pad);
  }

  grow(pt, pad) {
    const bx = this.box;
    bx[0] = Math.min(bx[0], pt.x - pad);
    bx[1] = Math.min(bx[1], pt.y - pad);
    bx[2] = Math.max(bx[2], pt.x + pad);
    bx[3] = Math.max(bx[3], pt.y + pad);
  }

  // 획이 닿은 영역 [x, y, w, h] (실행취소용)
  rect(W, H) {
    const [x0, y0, x1, y1] = this.box;
    if (x0 > x1) return null;
    const a = Math.max(0, Math.floor(x0));
    const b = Math.max(0, Math.floor(y0));
    const c = Math.min(W, Math.ceil(x1));
    const d = Math.min(H, Math.ceil(y1));
    return c > a && d > b ? [a, b, c - a, d - b] : null;
  }

  commit(W, H) {
    if (!this.tool.layered) return;
    const r = this.rect(W, H);
    if (!r) return;
    this.pctx.save();
    this.pctx.globalAlpha = this.opacity;
    this.pctx.drawImage(this.sctx.canvas, r[0], r[1], r[2], r[3], r[0], r[1], r[2], r[3]);
    this.pctx.restore();
    this.sctx.clearRect(r[0], r[1], r[2], r[3]);
  }
}
