// 꾸미기용 얼굴 그림. 이미지 파일 없이 코드로 그린다 (1200×1500).
//  drawBase     : 배경 · 뒷머리 · 목 · 옷 · 귀 · 얼굴 · 입술 바탕   (화장 층 아래)
//  drawFeatures : 앞머리 · 눈썹 · 눈 · 코 · 입술 선                (화장 층 위)
//  buildMasks   : 화장이 묻을 수 있는 영역 (피부 / 입술 / 눈두덩이)
import { hexToRgb, rgbToHex, makeCanvas } from './util.js';

export const FW = 1200;
export const FH = 1500;

export const FACES = [
  { id: 'harin', name: '하린', hair: 'long', skin: '#F8D9C2', hairC: '#3B2A22', iris: '#6B4630', lip: '#E6A09C', shirt: '#F7A8C4', bg: '#FDE8EF' },
  { id: 'sua', name: '수아', hair: 'bob', skin: '#F3CBA5', hairC: '#221C19', iris: '#3B2E28', lip: '#DE9890', shirt: '#9AD0F5', bg: '#E6F3FD' },
  { id: 'jiu', name: '지우', hair: 'pigtails', skin: '#FBE3D0', hairC: '#C2733A', iris: '#4E8A5B', lip: '#EBA2A2', shirt: '#FFD66B', bg: '#FFF6D6' },
  { id: 'maya', name: '마야', hair: 'bun', skin: '#C68E63', hairC: '#2A1A12', iris: '#3B2416', lip: '#B4685B', shirt: '#B39DDB', bg: '#EFE8FF' },
  { id: 'doyun', name: '도윤', hair: 'short', skin: '#EFC6A0', hairC: '#2B2321', iris: '#3A2A20', lip: '#D69687', shirt: '#7FD1AE', bg: '#E3F6EE' },
  { id: 'ana', name: '아나', hair: 'curly', skin: '#8D5A3B', hairC: '#16100D', iris: '#2A1A10', lip: '#8A473B', shirt: '#FF9E80', bg: '#FFEDE6' },
];

const mix = (a, b, k) => {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex(...x.map((v, i) => Math.round(v + (y[i] - v) * k)));
};
const P = (d) => new Path2D(d);
const rgba = (hex, a) => `rgba(${hexToRgb(hex).join(',')},${a})`;

// 얼굴 크기 기준값: 번짐·브러시 크기는 픽셀이 아니라 이 너비에 대한 비율로 정한다
export const U = 650;
export const AXIS = 600; // 얼굴 좌우 대칭 축 (좌우 같이 칠하기)
export const EYES_AT = [[470, 690], [730, 690]];
export const LIDS_AT = [[470, 660], [730, 660]];
export const CHEEKS_AT = [[425, 855], [775, 855]];
export const MOUTH_AT = [600, 905];

export function eyePath(cx, cy, grow = 0) {
  const p = new Path2D();
  p.moveTo(cx - 78 - grow, cy);
  p.bezierCurveTo(cx - 42, cy - 50 - grow, cx + 42, cy - 50 - grow, cx + 78 + grow, cy);
  p.bezierCurveTo(cx + 42, cy + 44 + grow, cx - 42, cy + 44 + grow, cx - 78 - grow, cy);
  return p;
}

const FACE ='M 600 300 C 815 300 925 455 925 680 C 925 905 790 1075 600 1085 C 410 1075 275 905 275 680 C 275 455 385 300 600 300 Z';
const NECK = 'M 515 960 L 515 1300 L 685 1300 L 685 960 Z';
const SHIRT = 'M 90 1500 L 130 1360 C 260 1285 420 1255 515 1240 Q 600 1300 685 1240 C 780 1255 940 1285 1070 1360 L 1110 1500 Z';
const UPPER_LIP = 'M 528 902 C 552 874 580 870 600 884 C 620 870 648 874 672 902 C 640 914 560 914 528 902 Z';
const LOWER_LIP = 'M 528 902 C 560 914 640 914 672 902 C 650 948 550 948 528 902 Z';
const EYES = [[470, 690, -1], [730, 690, 1]]; // [x, y, 바깥쪽 방향]

const HAIR_BACK = {
  long: 'M 600 235 C 905 235 1015 455 1005 760 C 998 1010 1070 1220 1010 1345 C 900 1395 300 1395 190 1345 C 130 1220 202 1010 195 760 C 185 455 295 235 600 235 Z',
  bob: 'M 600 245 C 885 245 985 430 985 700 C 985 870 965 975 925 1015 C 800 1040 400 1040 275 1015 C 235 975 215 870 215 700 C 215 430 315 245 600 245 Z',
  pigtails: 'M 600 250 C 880 250 960 430 950 660 L 250 660 C 240 430 320 250 600 250 Z',
  bun: 'M 600 255 C 880 255 950 440 945 660 L 255 660 C 250 440 320 255 600 255 Z',
  short: 'M 600 255 C 875 255 955 430 945 650 L 255 650 C 245 430 325 255 600 255 Z',
};
const HAIR_FRONT = {
  long: 'M 272 660 C 268 420 410 280 600 280 C 795 280 932 420 928 660 C 905 545 840 455 735 425 C 660 505 520 545 385 548 C 330 575 290 615 272 660 Z',
  bob: 'M 272 650 C 270 410 410 282 600 282 C 790 282 930 410 928 650 C 915 590 890 560 850 548 C 760 560 690 548 600 552 C 510 548 440 560 350 548 C 310 560 285 590 272 650 Z',
  pigtails: 'M 280 600 C 285 390 420 280 600 280 C 785 280 918 390 922 600 C 900 560 860 540 820 545 L 780 515 L 720 548 L 660 515 L 600 548 L 540 515 L 480 548 L 420 515 L 380 545 C 340 540 300 560 280 600 Z',
  bun: 'M 272 640 C 270 400 420 285 600 285 C 780 285 930 400 928 640 C 900 480 760 405 600 410 C 440 405 300 480 272 640 Z',
  short: 'M 268 630 C 266 385 420 268 600 268 C 790 268 934 385 932 630 C 905 525 850 470 790 458 C 705 472 625 452 560 420 C 500 470 400 482 335 498 C 300 538 280 580 268 630 Z',
  curly: 'M 280 600 C 285 390 420 288 600 288 C 780 288 915 390 920 600 C 880 500 760 455 600 455 C 440 455 320 500 280 600 Z',
};

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
}

function hairBack(ctx, f) {
  ctx.fillStyle = f.hairC;
  if (f.hair === 'curly') {
    ellipse(ctx, 600, 660, 395, 430);
    for (let a = 150; a <= 390; a += 20) {
      const r = (a * Math.PI) / 180;
      circle(ctx, 600 + Math.cos(r) * 400, 640 + Math.sin(r) * 420, 105);
    }
    return;
  }
  ctx.fill(P(HAIR_BACK[f.hair]));
  if (f.hair === 'pigtails') {
    ellipse(ctx, 190, 800, 105, 200, -0.25);
    ellipse(ctx, 1010, 800, 105, 200, 0.25);
  }
  if (f.hair === 'bun') circle(ctx, 600, 215, 125);
}

function hairFront(ctx, f) {
  ctx.fillStyle = f.hairC;
  ctx.fill(P(HAIR_FRONT[f.hair]));
  if (f.hair === 'curly') {
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      circle(ctx, 300 + t * 600, 520 - Math.sin(t * Math.PI) * 70, 58);
    }
  }
  if (f.hair === 'pigtails') {
    ctx.fillStyle = '#FF6A4D';
    circle(ctx, 232, 612, 26);
    circle(ctx, 968, 612, 26);
  }
  // 머리 윤기
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 18;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(420, 370);
  ctx.bezierCurveTo(480, 325, 560, 308, 650, 314);
  ctx.stroke();
  ctx.restore();
}

function eye(ctx, f, cx, cy, out) {
  const shape = new Path2D();
  shape.moveTo(cx - 78, cy);
  shape.bezierCurveTo(cx - 42, cy - 50, cx + 42, cy - 50, cx + 78, cy);
  shape.bezierCurveTo(cx + 42, cy + 44, cx - 42, cy + 44, cx - 78, cy);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill(shape);
  ctx.save();
  ctx.clip(shape);
  const g = ctx.createRadialGradient(cx, cy + 8, 4, cx, cy + 2, 40);
  g.addColorStop(0, mix(f.iris, '#FFFFFF', 0.35));
  g.addColorStop(1, f.iris);
  ctx.fillStyle = g;
  circle(ctx, cx, cy + 2, 39);
  ctx.fillStyle = '#1A1210';
  circle(ctx, cx, cy + 2, 17);
  ctx.fillStyle = '#FFFFFF';
  circle(ctx, cx + 13, cy - 11, 10);
  circle(ctx, cx - 12, cy + 14, 5);
  ctx.restore();
  // 위 속눈썹 선
  ctx.save();
  ctx.strokeStyle = '#2A1D18';
  ctx.lineCap = 'round';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(cx - 80, cy + 2);
  ctx.bezierCurveTo(cx - 42, cy - 52, cx + 42, cy - 52, cx + 80, cy - 2);
  ctx.stroke();
  ctx.lineWidth = 6;
  for (const [x0, y0, x1, y1] of [[78, -2, 98, -22], [64, -20, 80, -44], [46, -32, 56, -56]]) {
    ctx.beginPath();
    ctx.moveTo(cx + out * x0, cy + y0);
    ctx.lineTo(cx + out * x1, cy + y1);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 70, cy + 6);
  ctx.bezierCurveTo(cx - 40, cy + 42, cx + 40, cy + 42, cx + 70, cy + 6);
  ctx.stroke();
  ctx.restore();
}

export const FACE_PATH = () => P(FACE);
export const NECK_PATH = () => P(NECK);
export const LIP_PATHS = () => [P(UPPER_LIP), P(LOWER_LIP)];

export function drawBackground(ctx, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, FW, FH);
  const g = ctx.createRadialGradient(600, 650, 60, 600, 650, 720);
  g.addColorStop(0, 'rgba(255,255,255,0.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FW, FH);
}

// bg: false 이면 배경 없이 인물만 그린다 (완성 화면에서 배경을 바꾸기 위해)
export function drawBase(ctx, f, bg = true) {
  if (bg) drawBackground(ctx, f.bg);
  hairBack(ctx, f);
  const shade = mix(f.skin, '#7A3F22', 0.2);
  ctx.fillStyle = f.skin;
  ctx.fill(P(NECK));
  ctx.save();
  ctx.clip(P(NECK));
  ctx.fillStyle = shade;
  ctx.globalAlpha = 0.35;
  ellipse(ctx, 600, 1040, 170, 75);
  ctx.restore();

  ctx.fillStyle = f.shirt;
  ctx.fill(P(SHIRT));
  ctx.save();
  ctx.strokeStyle = mix(f.shirt, '#000000', 0.12);
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.stroke(P('M 515 1242 Q 600 1302 685 1242'));
  ctx.restore();

  ctx.fillStyle = f.skin;
  ellipse(ctx, 282, 700, 48, 78);
  ellipse(ctx, 918, 700, 48, 78);
  ctx.fillStyle = shade;
  ctx.globalAlpha = 0.45;
  ellipse(ctx, 290, 706, 20, 44);
  ellipse(ctx, 910, 706, 20, 44);
  ctx.globalAlpha = 1;
  ctx.fillStyle = f.skin;
  ctx.fill(P(FACE));

  ctx.fillStyle = f.lip;
  ctx.fill(P(UPPER_LIP));
  ctx.fill(P(LOWER_LIP));
}

// 얼굴 명암: 화장 위에 '곱하기'로 얹어서 화장을 해도 입체감이 남게 한다
export function drawShading(ctx, f) {
  const sh = mix(f.skin, '#6A3420', 0.4);
  ctx.save();
  ctx.clip(P(FACE));
  const g = ctx.createRadialGradient(600, 640, 230, 600, 690, 430);
  g.addColorStop(0, rgba(sh, 0));
  g.addColorStop(1, rgba(sh, 0.5));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FW, FH);
  ctx.filter = 'none';
  ctx.fillStyle = rgba(sh, 0.22);
  ctx.shadowColor = rgba(sh, 0.22);
  ctx.shadowBlur = 18;
  ellipse(ctx, 580, 800, 14, 34);
  ellipse(ctx, 600, 962, 46, 10);
  ctx.restore();
}

export function drawFeatures(ctx, f) {
  hairFront(ctx, f);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = mix(f.hairC, f.skin, 0.12);
  ctx.lineWidth = 14;
  ctx.stroke(P('M 400 612 Q 465 572 540 600'));
  ctx.stroke(P('M 660 600 Q 735 572 800 612'));
  ctx.restore();
  for (const [x, y, out] of EYES) eye(ctx, f, x, y, out);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = mix(f.skin, '#7A3F22', 0.35);
  ctx.lineWidth = 7;
  ctx.stroke(P('M 588 770 Q 575 820 600 826 Q 616 826 624 816'));
  ctx.strokeStyle = mix(f.lip, '#3A1A1A', 0.45);
  ctx.lineWidth = 5;
  ctx.stroke(P('M 530 902 C 562 912 638 912 670 902'));
  ctx.restore();
}

export function drawSkinShape(x) {
  x.fill(P(FACE));
  x.fill(P(NECK));
  ellipse(x, 282, 700, 48, 78);
  ellipse(x, 918, 700, 48, 78);
}

export { ellipse as fillEllipse };

// 목록에 쓰는 작은 얼굴 그림
export function faceThumb(f, w = 360) {
  const s = w / FW;
  const c = makeCanvas(w, Math.round(FH * s));
  const x = c.getContext('2d');
  x.scale(s, s);
  drawBase(x, f);
  x.globalCompositeOperation = 'multiply';
  drawShading(x, f);
  x.globalCompositeOperation = 'source-over';
  drawFeatures(x, f);
  return c;
}
