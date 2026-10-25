// 채우기(페인트통): 도안의 선을 벽으로 보고 칸 하나를 칠한다

// 1 = 벽(선). 선을 1px 두껍게 해서 작은 틈으로 색이 새는 것을 막는다
export function buildMask(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data;
  const n = w * h;
  const m = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    m[i] = (d[j] * 299 + d[j + 1] * 587 + d[j + 2] * 114) / 1000 < 165 ? 1 : 0;
  }
  const out = m.slice();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!m[i]) continue;
      if (x > 0) out[i - 1] = 1;
      if (x < w - 1) out[i + 1] = 1;
      if (y > 0) out[i - w] = 1;
      if (y < h - 1) out[i + w] = 1;
    }
  }
  return out;
}

export function floodFill(mask, w, h, sx, sy) {
  if (mask[sy * w + sx]) return null;
  const region = new Uint8Array(w * h);
  let minX = sx, maxX = sx, minY = sy, maxY = sy;
  const stack = [sx, sy];
  while (stack.length) {
    const y = stack.pop();
    let x = stack.pop();
    let i = y * w + x;
    if (region[i] || mask[i]) continue;
    while (x > 0 && !mask[i - 1] && !region[i - 1]) {
      x--;
      i--;
    }
    let upOpen = false;
    let downOpen = false;
    while (x < w && !mask[i] && !region[i]) {
      region[i] = 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y > 0) {
        const open = !mask[i - w] && !region[i - w];
        if (open && !upOpen) stack.push(x, y - 1);
        upOpen = open;
      }
      if (y < h - 1) {
        const open = !mask[i + w] && !region[i + w];
        if (open && !downOpen) stack.push(x, y + 1);
        downOpen = open;
      }
      x++;
      i++;
    }
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  // 선 밑으로 2px 번지게 해서 선과 색 사이에 흰 틈이 안 보이게 한다 (선 안쪽으로만)
  for (let it = 0; it < 2; it++) {
    const add = [];
    const x0 = Math.max(0, minX - 1), x1 = Math.min(w - 1, maxX + 1);
    const y0 = Math.max(0, minY - 1), y1 = Math.min(h - 1, maxY + 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * w + x;
        if (region[i] || !mask[i]) continue;
        if ((x > 0 && region[i - 1]) || (x < w - 1 && region[i + 1]) || (y > 0 && region[i - w]) || (y < h - 1 && region[i + w])) add.push(i);
      }
    }
    for (const i of add) region[i] = 1;
    minX = x0; maxX = x1; minY = y0; maxY = y1;
  }
  return { region, minX, minY, maxX, maxY };
}

// 칠하고, 칠하기 전 영역(ImageData)을 돌려준다
export function applyFill(ctx, res, w, rgb, alpha) {
  const { region, minX, minY, maxX, maxY } = res;
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const img = ctx.getImageData(minX, minY, bw, bh);
  const before = new ImageData(new Uint8ClampedArray(img.data), bw, bh);
  const p = img.data;
  const [r, g, b] = rgb;
  for (let y = 0; y < bh; y++) {
    const row = (y + minY) * w + minX;
    for (let x = 0; x < bw; x++) {
      if (!region[row + x]) continue;
      const k = (y * bw + x) * 4;
      if (alpha >= 1) {
        p[k] = r; p[k + 1] = g; p[k + 2] = b; p[k + 3] = 255;
      } else {
        const da = p[k + 3] / 255;
        const oa = alpha + da * (1 - alpha);
        p[k] = (r * alpha + p[k] * da * (1 - alpha)) / oa;
        p[k + 1] = (g * alpha + p[k + 1] * da * (1 - alpha)) / oa;
        p[k + 2] = (b * alpha + p[k + 2] * da * (1 - alpha)) / oa;
        p[k + 3] = oa * 255;
      }
    }
  }
  ctx.putImageData(img, minX, minY);
  return before;
}
