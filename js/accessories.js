// 꾸미기 액세서리. 각 항목은 SVG 그림(색 c로 물들일 수 있음) 또는 이모지 스티커.
//  vb: 그림 비율 [가로, 세로]   at: 처음 놓일 자리 [가운데 x, 가운데 y, 너비] (얼굴 1200×1500 기준)
import { hexToRgb, rgbToHex } from './util.js';

const dark = (c, k = 0.25) => rgbToHex(...hexToRgb(c).map((v) => Math.round(v * (1 - k))));
const heart = (x, y, s) =>
  `M${x} ${y + s * 0.9} C${x - s * 1.4} ${y + s * 0.1} ${x - s * 0.9} ${y - s * 0.9} ${x} ${y - s * 0.3} C${x + s * 0.9} ${y - s * 0.9} ${x + s * 1.4} ${y + s * 0.1} ${x} ${y + s * 0.9}Z`;
const star = (x, y, R, r = R * 0.45) =>
  'M' + Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r : R;
    return `${(x + Math.cos(a) * rr).toFixed(1)} ${(y + Math.sin(a) * rr).toFixed(1)}`;
  }).join(' L') + 'Z';
const flower = (x, y, r, c) =>
  [0, 72, 144, 216, 288]
    .map((a) => `<circle cx="${x + Math.cos((a * Math.PI) / 180) * r * 0.9}" cy="${y + Math.sin((a * Math.PI) / 180) * r * 0.9}" r="${r * 0.72}" fill="${c}"/>`)
    .join('') + `<circle cx="${x}" cy="${y}" r="${r * 0.5}" fill="#FFD54F"/>`;
const pearl = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#FBF7F0" stroke="#E2D6C3" stroke-width="2"/><circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.3}" fill="#fff"/>`;
const hook = (x) => `<circle cx="${x}" cy="14" r="9" fill="none" stroke="#D9B44A" stroke-width="5"/><path d="M${x} 22 V46" stroke="#D9B44A" stroke-width="4"/>`;

export const ACC_CATS = [
  { id: 'head', name: '머리' },
  { id: 'eyes', name: '안경' },
  { id: 'ears', name: '귀걸이' },
  { id: 'neck', name: '목걸이' },
  { id: 'props', name: '소품' },
  { id: 'bubble', name: '말풍선' },
  { id: 'sticker', name: '스티커' },
];

// 인생네컷 사진관에 있는 소품들 (콧수염·왕안경·모자·동물 코·말풍선 …)
const mirrorX = (w, body) => `${body}<g transform="translate(${w} 0) scale(-1 1)">${body}</g>`;
const bubble = (key, name, text, c, at) => ({
  key, cat: 'bubble', name, vb: [260, 170], at, c,
  svg: (col) => `<path d="M22 10 H238 Q254 10 254 26 V108 Q254 124 238 124 H112 L70 164 L82 124 H22 Q6 124 6 108 V26 Q6 10 22 10Z" fill="#fff" stroke="#241B3A" stroke-width="6" stroke-linejoin="round"/><text x="130" y="88" text-anchor="middle" font-family="Do Hyeon, Apple SD Gothic Neo, sans-serif" font-size="${text.length > 3 ? 50 : 58}" font-weight="700" fill="${col}">${text}</text>`,
});
const PROPS = [
  { key: 'mustache', cat: 'props', name: '콧수염', vb: [200, 70], at: [600, 848, 210], c: '#3A2A20',
    svg: (c) => `<path d="M100 30 C80 10 50 10 35 25 C25 35 10 40 2 30 C8 55 40 62 70 50 C85 44 95 40 100 38 C105 40 115 44 130 50 C160 62 192 55 198 30 C190 40 175 35 165 25 C150 10 120 10 100 30Z" fill="${c}"/>` },
  { key: 'bigGlasses', cat: 'props', name: '왕안경', vb: [320, 140], at: [600, 692, 640], c: '#FF7AB6',
    svg: (c) => `<circle cx="80" cy="70" r="60" fill="${c}" fill-opacity=".25" stroke="#241B3A" stroke-width="16"/><circle cx="240" cy="70" r="60" fill="${c}" fill-opacity=".25" stroke="#241B3A" stroke-width="16"/><path d="M140 62 Q160 46 180 62" stroke="#241B3A" stroke-width="12" fill="none"/><circle cx="58" cy="48" r="10" fill="#fff" opacity=".6"/><circle cx="218" cy="48" r="10" fill="#fff" opacity=".6"/>` },
  { key: 'mask', cat: 'props', name: '가면', vb: [320, 130], at: [600, 692, 620], c: '#8C6CFF',
    svg: (c) => `<path fill-rule="evenodd" d="M10 40 C60 0 130 20 160 50 C190 20 260 0 310 40 C300 110 220 120 160 80 C100 120 20 110 10 40Z M52 62 a38 22 0 1 0 76 0 a38 22 0 1 0 -76 0Z M192 62 a38 22 0 1 0 76 0 a38 22 0 1 0 -76 0Z" fill="${c}" stroke="${dark(c)}" stroke-width="5"/><circle cx="160" cy="34" r="8" fill="#FFC12E"/><circle cx="40" cy="30" r="5" fill="#fff"/><circle cx="280" cy="30" r="5" fill="#fff"/>` },
  { key: 'clownNose', cat: 'props', name: '빨간 코', vb: [100, 100], at: [600, 800, 100], c: '#FF3B3B',
    svg: (c) => `<circle cx="50" cy="50" r="44" fill="${c}" stroke="${dark(c)}" stroke-width="4"/><circle cx="36" cy="34" r="12" fill="#fff" opacity=".6"/>` },
  { key: 'pigNose', cat: 'props', name: '돼지 코', vb: [120, 80], at: [600, 806, 130], c: '#FFAEC9',
    svg: (c) => `<ellipse cx="60" cy="40" rx="56" ry="38" fill="${c}" stroke="${dark(c, 0.3)}" stroke-width="4"/><ellipse cx="40" cy="40" rx="9" ry="14" fill="#8E3B46"/><ellipse cx="80" cy="40" rx="9" ry="14" fill="#8E3B46"/>` },
  { key: 'dogEars', cat: 'props', name: '강아지 귀', vb: [600, 300], at: [600, 520, 780], c: '#A0643C',
    svg: (c) => mirrorX(600, `<path d="M95 20 C40 20 10 90 20 200 C30 280 110 290 120 200 C125 140 130 60 95 20Z" fill="${c}" stroke="${dark(c, 0.35)}" stroke-width="6"/>`) },
  { key: 'dogNose', cat: 'props', name: '강아지 코', vb: [200, 170], at: [600, 862, 190], c: '#FF7A9A',
    svg: (c) => `<path d="M80 92 C80 160 120 160 120 92Z" fill="${c}" stroke="${dark(c)}" stroke-width="4"/><path d="M100 98 V135" stroke="${dark(c)}" stroke-width="4"/><path d="M100 70 V90 M68 90 Q100 110 132 90" stroke="#241B3A" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M100 70 C60 70 40 40 60 22 C80 6 120 6 140 22 C160 40 140 70 100 70Z" fill="#241B3A"/><ellipse cx="85" cy="28" rx="14" ry="7" fill="#fff" opacity=".5"/>` },
  { key: 'whiskers', cat: 'props', name: '고양이 수염', vb: [520, 120], at: [600, 830, 640], c: '#241B3A',
    svg: (c) => `${mirrorX(520, `<path d="M200 50 L22 18 M200 64 L10 64 M200 78 L22 110" stroke="${c}" stroke-width="7" stroke-linecap="round" fill="none"/>`)}<path d="M244 46 L276 46 L260 66Z" fill="#FF7A9A" stroke="#241B3A" stroke-width="4" stroke-linejoin="round"/>` },
  { key: 'devil', cat: 'props', name: '악마 뿔', vb: [400, 150], at: [600, 320, 560], c: '#E53935',
    svg: (c) => mirrorX(400, `<path d="M60 150 C40 100 50 40 90 10 C85 60 110 110 130 140Z" fill="${c}" stroke="${dark(c)}" stroke-width="5" stroke-linejoin="round"/>`) },
  { key: 'halo', cat: 'props', name: '천사 링', vb: [300, 90], at: [600, 210, 420], c: '#FFD54F',
    svg: (c) => `<ellipse cx="150" cy="45" rx="136" ry="30" fill="none" stroke="${c}" stroke-width="16"/><ellipse cx="150" cy="45" rx="136" ry="30" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="5"/>` },
  { key: 'boppers', cat: 'props', name: '하트 더듬이', vb: [420, 230], at: [600, 260, 640], c: '#FF4F79',
    svg: (c) => `<path d="M20 225 C40 120 380 120 400 225" stroke="#241B3A" stroke-width="12" fill="none" stroke-linecap="round"/>${mirrorX(420, `<path d="M130 150 Q112 112 130 82 Q148 54 122 36" stroke="#241B3A" stroke-width="5" fill="none"/><path d="${heart(118, 34, 26)}" fill="${c}" stroke="#241B3A" stroke-width="4"/>`)}` },
  { key: 'topHat', cat: 'props', name: '신사 모자', vb: [220, 200], at: [600, 210, 360], rot: -6, c: '#241B3A',
    svg: (c) => `<rect x="40" y="8" width="140" height="150" rx="12" fill="${c}"/><rect x="40" y="118" width="140" height="26" fill="#E53935"/><rect x="2" y="152" width="216" height="40" rx="20" fill="${c}"/><rect x="56" y="22" width="16" height="88" rx="8" fill="#fff" opacity=".18"/>` },
  { key: 'strawHat', cat: 'props', name: '밀짚모자', vb: [420, 180], at: [600, 290, 740], c: '#FF6A9A',
    svg: (c) => `<ellipse cx="210" cy="140" rx="205" ry="36" fill="#E9C46A" stroke="#B88A12" stroke-width="5"/><path d="M110 140 C110 50 150 20 210 20 C270 20 310 50 310 140Z" fill="#E9C46A" stroke="#B88A12" stroke-width="5"/><path d="M112 108 Q210 124 308 108 L310 134 Q210 150 110 134Z" fill="${c}"/>` },
  { key: 'beret', cat: 'props', name: '베레모', vb: [260, 130], at: [640, 300, 470], rot: 10, c: '#E53950',
    svg: (c) => `<ellipse cx="130" cy="80" rx="125" ry="45" fill="${c}"/><path d="M40 96 Q130 126 220 96" stroke="${dark(c)}" stroke-width="8" fill="none"/><rect x="124" y="20" width="12" height="22" rx="6" fill="${dark(c)}"/>` },
  { key: 'lipsProp', cat: 'props', name: '입술 막대', vb: [200, 220], at: [600, 990, 300], c: '#E53935',
    svg: (c) => `<rect x="94" y="100" width="12" height="118" rx="6" fill="#241B3A"/><path d="M20 70 C50 30 80 30 100 50 C120 30 150 30 180 70 C150 110 50 110 20 70Z" fill="${c}" stroke="${dark(c)}" stroke-width="5"/><path d="M28 70 C70 82 130 82 172 70" stroke="${dark(c, 0.4)}" stroke-width="4" fill="none"/>` },
  { key: 'heartsFloat', cat: 'props', name: '하트 뿅뿅', vb: [200, 170], at: [860, 360, 220], c: '#FF4F79',
    svg: (c) => `<path d="${heart(70, 95, 44)}" fill="${c}" stroke="#241B3A" stroke-width="4"/><path d="${heart(150, 60, 28)}" fill="${c}" stroke="#241B3A" stroke-width="4"/><path d="${heart(160, 135, 18)}" fill="${c}" stroke="#241B3A" stroke-width="3"/>` },
  bubble('b_love', 'LOVE', 'LOVE', '#FF4F79', [860, 380, 300]),
  bubble('b_best', '최고!', '최고!', '#FF5A3C', [860, 380, 300]),
  bubble('b_hi', '안녕!', '안녕!', '#3BA4FF', [860, 380, 300]),
  bubble('b_love2', '사랑해', '사랑해', '#E0457B', [860, 380, 300]),
  bubble('b_cute', '귀여워', '귀여워', '#8C6CFF', [860, 380, 300]),
  bubble('b_wow', 'WOW', 'WOW', '#2DBE7E', [860, 380, 300]),
];

export const ACC = [
  { key: 'crown', cat: 'head', name: '왕관', vb: [200, 120], at: [600, 285, 380], c: '#E53950',
    svg: (c) => `<path d="M20 110 L10 30 L60 70 L100 10 L140 70 L190 30 L180 110 Z" fill="#FFC83D" stroke="#E0A100" stroke-width="5" stroke-linejoin="round"/><rect x="18" y="96" width="164" height="18" rx="6" fill="#F5B400"/><circle cx="100" cy="72" r="13" fill="${c}"/><circle cx="55" cy="86" r="9" fill="${c}"/><circle cx="145" cy="86" r="9" fill="${c}"/><circle cx="10" cy="30" r="9" fill="#FFE08A"/><circle cx="100" cy="10" r="10" fill="#FFE08A"/><circle cx="190" cy="30" r="9" fill="#FFE08A"/>` },
  { key: 'tiara', cat: 'head', name: '티아라', vb: [240, 90], at: [600, 330, 380], c: '#58A8F5',
    svg: (c) => `<path d="M12 84 Q120 40 228 84" fill="none" stroke="#D9D4E8" stroke-width="10" stroke-linecap="round"/><path d="M40 70 L60 40 L80 62 L120 8 L160 62 L180 40 L200 70 Q120 45 40 70 Z" fill="#EDEAF7" stroke="#B9B2D6" stroke-width="4" stroke-linejoin="round"/><path d="M120 22 l10 18 -10 14 -10 -14z" fill="${c}"/><circle cx="60" cy="50" r="7" fill="${c}"/><circle cx="180" cy="50" r="7" fill="${c}"/>` },
  { key: 'bow', cat: 'head', name: '리본', vb: [200, 130], at: [830, 390, 250], rot: 18, c: '#FF6A9A',
    svg: (c) => `<path d="M90 70 L60 125 L80 120 L95 128 L100 75Z M110 70 L140 125 L120 120 L105 128 L100 75Z" fill="${dark(c, 0.1)}"/><path d="M100 65 C70 20 15 5 10 40 C5 80 40 110 100 65 Z" fill="${c}"/><path d="M100 65 C130 20 185 5 190 40 C195 80 160 110 100 65 Z" fill="${c}"/><rect x="84" y="47" width="32" height="36" rx="11" fill="${dark(c)}"/><path d="M30 40 C40 30 60 32 75 48" stroke="#fff" stroke-opacity=".35" stroke-width="6" fill="none" stroke-linecap="round"/>` },
  { key: 'headband', cat: 'head', name: '머리띠', vb: [400, 140], at: [600, 380, 660], c: '#FF6A4D',
    svg: (c) => `<path d="M20 135 C30 30 370 30 380 135" fill="none" stroke="${c}" stroke-width="26" stroke-linecap="round"/><path d="M45 105 C80 52 320 52 355 105" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="6" stroke-linecap="round"/>` },
  { key: 'flowers', cat: 'head', name: '꽃 화관', vb: [440, 130], at: [600, 330, 700], c: '#FF7AA8',
    svg: (c) => `<path d="M15 100 Q220 40 425 100" stroke="#6DBE7B" stroke-width="12" fill="none" stroke-linecap="round"/><ellipse cx="100" cy="88" rx="18" ry="8" fill="#6DBE7B" transform="rotate(-20 100 88)"/><ellipse cx="340" cy="88" rx="18" ry="8" fill="#6DBE7B" transform="rotate(20 340 88)"/>${flower(55, 92, 26, c)}${flower(140, 66, 28, '#FFFFFF')}${flower(220, 56, 32, c)}${flower(300, 66, 28, '#FFC1D6')}${flower(385, 92, 26, c)}` },
  { key: 'catEars', cat: 'head', name: '고양이 귀', vb: [400, 150], at: [600, 300, 660], c: '#3A3633',
    svg: (c) => `<path d="M40 150 L70 10 L170 120 Z" fill="${c}"/><path d="M75 120 L85 50 L140 110Z" fill="#FFB3C7"/><path d="M360 150 L330 10 L230 120Z" fill="${c}"/><path d="M325 120 L315 50 L260 110Z" fill="#FFB3C7"/>` },
  { key: 'bunny', cat: 'head', name: '토끼 귀', vb: [260, 260], at: [600, 170, 420], c: '#FFFFFF',
    svg: (c) => `<ellipse cx="80" cy="125" rx="42" ry="118" transform="rotate(-12 80 125)" fill="${c}" stroke="#E6DED3" stroke-width="4"/><ellipse cx="80" cy="130" rx="20" ry="88" transform="rotate(-12 80 130)" fill="#FFB3C7"/><ellipse cx="180" cy="125" rx="42" ry="118" transform="rotate(12 180 125)" fill="${c}" stroke="#E6DED3" stroke-width="4"/><ellipse cx="180" cy="130" rx="20" ry="88" transform="rotate(12 180 130)" fill="#FFB3C7"/>` },
  { key: 'partyHat', cat: 'head', name: '고깔모자', vb: [160, 200], at: [690, 200, 240], rot: 14, c: '#58A8F5',
    svg: (c) => `<path d="M80 18 L150 190 L10 190 Z" fill="${c}"/><circle cx="62" cy="90" r="9" fill="#fff" opacity=".7"/><circle cx="95" cy="130" r="9" fill="#fff" opacity=".7"/><circle cx="55" cy="160" r="9" fill="#fff" opacity=".7"/><circle cx="110" cy="172" r="7" fill="#fff" opacity=".7"/><rect x="6" y="182" width="148" height="16" rx="8" fill="#FFC83D"/><circle cx="80" cy="16" r="16" fill="#FFC83D"/>` },
  { key: 'starPin', cat: 'head', name: '별 머리핀', vb: [100, 100], at: [390, 440, 120], c: '#FFC83D',
    svg: (c) => `<path d="${star(50, 52, 46)}" fill="${c}" stroke="${dark(c)}" stroke-width="4" stroke-linejoin="round"/><path d="${star(42, 44, 10)}" fill="#fff" opacity=".6"/>` },
  { key: 'heartPin', cat: 'head', name: '하트 머리핀', vb: [100, 90], at: [800, 450, 110], c: '#FF4F79',
    svg: (c) => `<path d="${heart(50, 44, 34)}" fill="${c}" stroke="${dark(c)}" stroke-width="4"/><circle cx="34" cy="32" r="7" fill="#fff" opacity=".55"/>` },

  { key: 'roundGlasses', cat: 'eyes', name: '동그란 안경', vb: [300, 110], at: [600, 692, 540], c: '#2A2623',
    svg: (c) => `<circle cx="75" cy="60" r="48" fill="#BFE3FF" fill-opacity=".22" stroke="${c}" stroke-width="10"/><circle cx="225" cy="60" r="48" fill="#BFE3FF" fill-opacity=".22" stroke="${c}" stroke-width="10"/><path d="M123 55 Q150 38 177 55" stroke="${c}" stroke-width="9" fill="none"/><path d="M27 50 L4 40 M273 50 L296 40" stroke="${c}" stroke-width="9" stroke-linecap="round"/>` },
  { key: 'heartGlasses', cat: 'eyes', name: '하트 선글라스', vb: [300, 110], at: [600, 692, 560], c: '#FF4F79',
    svg: (c) => `<path d="${heart(75, 52, 44)}" fill="${c}" fill-opacity=".85" stroke="#2A2623" stroke-width="7"/><path d="${heart(225, 52, 44)}" fill="${c}" fill-opacity=".85" stroke="#2A2623" stroke-width="7"/><path d="M118 48 Q150 34 182 48" stroke="#2A2623" stroke-width="8" fill="none"/><circle cx="58" cy="40" r="8" fill="#fff" opacity=".5"/><circle cx="208" cy="40" r="8" fill="#fff" opacity=".5"/>` },
  { key: 'starGlasses', cat: 'eyes', name: '별 안경', vb: [300, 120], at: [600, 692, 580], c: '#FFC83D',
    svg: (c) => `<path d="${star(75, 64, 58, 30)}" fill="${c}" fill-opacity=".8" stroke="${dark(c, 0.35)}" stroke-width="6" stroke-linejoin="round"/><path d="${star(225, 64, 58, 30)}" fill="${c}" fill-opacity=".8" stroke="${dark(c, 0.35)}" stroke-width="6" stroke-linejoin="round"/><path d="M120 58 Q150 46 180 58" stroke="${dark(c, 0.35)}" stroke-width="7" fill="none"/>` },
  { key: 'sunglasses', cat: 'eyes', name: '선글라스', vb: [300, 100], at: [600, 692, 560], c: '#2A2623',
    svg: (c) => `<path d="M10 20 H140 Q140 85 80 88 Q15 88 10 20Z" fill="${c}" fill-opacity=".9"/><path d="M160 20 H290 Q285 88 220 88 Q160 85 160 20Z" fill="${c}" fill-opacity=".9"/><rect x="4" y="12" width="292" height="12" rx="6" fill="${c}"/><path d="M30 34 L60 34" stroke="#fff" stroke-opacity=".4" stroke-width="6" stroke-linecap="round"/>` },

  { key: 'pearlEar', cat: 'ears', name: '진주 귀걸이', vb: [700, 120], at: [600, 800, 700], c: '#FBF7F0',
    svg: () => `${hook(22)}${pearl(22, 70, 22)}${hook(678)}${pearl(678, 70, 22)}` },
  { key: 'heartEar', cat: 'ears', name: '하트 귀걸이', vb: [700, 120], at: [600, 800, 700], c: '#FF4F79',
    svg: (c) => `${hook(22)}<path d="${heart(22, 74, 24)}" fill="${c}"/>${hook(678)}<path d="${heart(678, 74, 24)}" fill="${c}"/>` },
  { key: 'hoopEar', cat: 'ears', name: '링 귀걸이', vb: [700, 120], at: [600, 800, 700], c: '#E8B931',
    svg: (c) => `<circle cx="22" cy="62" r="40" fill="none" stroke="${c}" stroke-width="9"/><circle cx="678" cy="62" r="40" fill="none" stroke="${c}" stroke-width="9"/>` },
  { key: 'starEar', cat: 'ears', name: '별 귀걸이', vb: [700, 120], at: [600, 800, 700], c: '#FFC83D',
    svg: (c) => `${hook(22)}<path d="${star(22, 76, 28)}" fill="${c}"/>${hook(678)}<path d="${star(678, 76, 28)}" fill="${c}"/>` },

  { key: 'pearls', cat: 'neck', name: '진주 목걸이', vb: [420, 150], at: [600, 1215, 430], c: '#FBF7F0',
    svg: () => Array.from({ length: 15 }, (_, i) => {
      const t = i / 14;
      return pearl(10 + t * 400, 12 + Math.sin(t * Math.PI) * 120, 14);
    }).join('') },
  { key: 'heartNeck', cat: 'neck', name: '하트 목걸이', vb: [400, 190], at: [600, 1225, 400], c: '#FF4F79',
    svg: (c) => `<path d="M10 10 Q200 230 390 10" fill="none" stroke="#D9B44A" stroke-width="5"/><path d="${heart(200, 140, 34)}" fill="${c}" stroke="${dark(c)}" stroke-width="4"/><circle cx="186" cy="128" r="7" fill="#fff" opacity=".55"/>` },
  { key: 'bowTie', cat: 'neck', name: '나비넥타이', vb: [160, 90], at: [600, 1240, 200], c: '#E53935',
    svg: (c) => `<path d="M80 45 L8 8 Q0 45 8 82 Z" fill="${c}"/><path d="M80 45 L152 8 Q160 45 152 82 Z" fill="${c}"/><rect x="64" y="28" width="32" height="34" rx="10" fill="${dark(c)}"/>` },
  { key: 'scarf', cat: 'neck', name: '스카프', vb: [340, 160], at: [600, 1215, 400], c: '#58A8F5',
    svg: (c) => `<path d="M10 20 Q170 90 330 20 L330 60 Q170 130 10 60 Z" fill="${c}"/><path d="M200 70 L240 150 L270 140 L235 62Z" fill="${dark(c, 0.12)}"/><path d="M40 44 Q170 100 300 44" stroke="#fff" stroke-opacity=".35" stroke-width="6" fill="none" stroke-dasharray="14 12"/>` },

  ...PROPS,
  { key: 'heartSt', cat: 'sticker', name: '하트', vb: [100, 90], at: [780, 880, 80], c: '#FF4F79',
    svg: (c) => `<path d="${heart(50, 44, 36)}" fill="${c}"/>` },
  { key: 'starSt', cat: 'sticker', name: '별', vb: [100, 100], at: [420, 880, 80], c: '#FFC83D',
    svg: (c) => `<path d="${star(50, 52, 46)}" fill="${c}"/>` },
  { key: 'sparkle', cat: 'sticker', name: '반짝', vb: [100, 100], at: [810, 560, 90], c: '#FFE27A',
    svg: (c) => `<path d="M50 4 Q56 44 96 50 Q56 56 50 96 Q44 56 4 50 Q44 44 50 4Z" fill="${c}" stroke="${dark(c, 0.2)}" stroke-width="3"/>` },
  ...[['butterfly', '🦋'], ['blossom', '🌸'], ['strawberry', '🍓'], ['rainbow', '🌈'], ['sparkles', '✨'], ['pinkHeart', '💖'], ['paw', '🐾'], ['lolly', '🍭']].map(
    ([key, emoji]) => ({ key, cat: 'sticker', name: emoji, emoji, vb: [1, 1], at: [760, 520, 130] }),
  ),
];

// 귀걸이는 양쪽 귀 사이가 넓어서, 목록 그림은 한쪽만 잘라 보여 준다
for (const a of ACC) if (a.cat === 'ears') a.thumbVb = [-38, 0, 120, 120];

// 목록 그림 위에 둘 액세서리 대표 그림
export const CAT_ICON = { head: 'crown', eyes: 'roundGlasses', ears: 'heartEar', neck: 'heartNeck', props: 'mustache', bubble: 'b_love', sticker: 'heartSt' };

export const ACC_MAP = Object.fromEntries(ACC.map((a) => [a.key, a]));

export function accThumbSvg(d) {
  const vb = d.thumbVb || [0, 0, d.vb[0], d.vb[1]];
  return `<svg viewBox="${vb.join(' ')}" aria-hidden="true">${d.svg(d.c)}</svg>`;
}

export const accHeight = (d, w) => (w * d.vb[1]) / d.vb[0];

export function accSvg(d, c, w, h) {
  const size = w ? ` width="${w}" height="${h}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d.vb[0]} ${d.vb[1]}"${size} aria-hidden="true">${d.svg(c || d.c)}</svg>`;
}
