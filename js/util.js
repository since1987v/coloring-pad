export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export const uid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function showScreen(id) {
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
}

let toastTimer = 0;
export function toast(msg, ms = 2400) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// iOS Safari는 캔버스 메모리를 늦게 돌려주므로 다 쓴 큰 캔버스는 크기를 0으로 만든다
export function freeCanvas(c) {
  c.width = 0;
  c.height = 0;
}

export function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 열 수 없어요'));
    };
    img.src = url;
  });
}

export function fitSize(w, h, max, allowUp = false) {
  let s = max / Math.max(w, h);
  if (!allowUp) s = Math.min(1, s);
  return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))];
}

export function drawFit(src, max, bg, allowUp = false) {
  const sw = src.naturalWidth || src.width;
  const sh = src.naturalHeight || src.height;
  const [w, h] = fitSize(sw, sh, max, allowUp);
  const c = makeCanvas(w, h);
  const x = c.getContext('2d');
  if (bg) {
    x.fillStyle = bg;
    x.fillRect(0, 0, w, h);
  }
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  x.drawImage(src, 0, 0, w, h);
  return c;
}

export function toBlob(c, type = 'image/png', q) {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지 저장 실패'))), type, q),
  );
}

export async function thumbBlob(src, max = 420) {
  const c = drawFit(src, max, '#fff');
  try {
    return await toBlob(c, 'image/jpeg', 0.85);
  } finally {
    freeCanvas(c);
  }
}

// 흑백으로 바꾸고 옅은 회색 배경은 흰색, 진한 선은 검정으로 당겨서 선을 또렷하게 만든다
export function cleanLineArt(c) {
  const x = c.getContext('2d');
  const d = x.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const a = p[i + 3] / 255;
    let l = (0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]) * a + 255 * (1 - a);
    l = l >= 215 ? 255 : l <= 70 ? 0 : Math.round(((l - 70) / 145) * 255);
    p[i] = p[i + 1] = p[i + 2] = l;
    p[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  return c;
}

// 사진처럼 명암(중간 밝기)이 많은 그림인지. 선 그림은 거의 흰색·검은색뿐이다
export function looksLikePhoto(c) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let mid = 0;
  let n = 0;
  for (let i = 0; i < d.length; i += 4 * 17) {
    const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (l > 50 && l < 205) mid++;
    n++;
  }
  return mid / n > 0.3;
}

// 가로·세로로 한 번씩 평균을 내는 빠른 흐림 (반지름 r)
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const k = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let s = 0;
    for (let x = -r; x <= r; x++) s += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = s * k;
      s += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = s * k;
      s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

// 사진을 연한 연필 스케치 도안으로: 흑백 → 반전해 흐린 것과 '닷지' 합성(윤곽만 남음) → 옅은 음영은 날린다
export function photoToSketch(c) {
  const x = c.getContext('2d');
  const w = c.width;
  const h = c.height;
  const img = x.getImageData(0, 0, w, h);
  const p = img.data;
  const n = w * h;
  const g = new Float32Array(n);
  const inv = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const a = p[j + 3] / 255;
    g[i] = (0.299 * p[j] + 0.587 * p[j + 1] + 0.114 * p[j + 2]) * a + 255 * (1 - a);
    inv[i] = 255 - g[i];
  }
  const r = Math.max(2, Math.round(Math.max(w, h) / 160));
  const b = boxBlur(boxBlur(inv, w, h, r), w, h, r);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    let v = b[i] >= 254 ? 255 : Math.min(255, (g[i] * 255) / (255 - b[i]));
    // 진하기(0~1)를 거듭제곱으로 눌러서 옅은 그림자는 거의 없애고 윤곽선만 또렷하게 둔다
    const dark = Math.min(1, Math.pow((255 - v) / 255, 1.25) * 2.4);
    v = dark < 0.07 ? 255 : 255 - dark * 255;
    p[j] = p[j + 1] = p[j + 2] = v;
    p[j + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return c;
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function lighten(hex, k) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(...[r, g, b].map((v) => Math.round(v + (255 - v) * k)));
}

// iPad에서는 공유 시트(사진에 저장·파일에 저장)를 띄우고, 안 되면 다운로드로 내려받는다
export async function shareOrDownload(blob, filename) {
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 4000);
}

export function pickFile(input) {
  return new Promise((resolve) => {
    input.value = '';
    input.onchange = () => resolve(input.files[0] || null);
    input.click();
  });
}
