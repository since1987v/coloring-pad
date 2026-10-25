import { hexToRgb, rgbToHex } from './util.js';

const svg = (body) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICON = {
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  next: svg('<path d="M9 5l7 7-7 7"/>'),
  undo: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>'),
  redo: svg('<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 000 11H13"/>'),
  image: svg('<rect x="3" y="4" width="18" height="16" rx="3.5"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-4.5-4.5-8.5 8"/>'),
  more: svg('<circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none"/>'),
  fit: svg('<path d="M4 9V5.5A1.5 1.5 0 015.5 4H9M15 4h3.5A1.5 1.5 0 0120 5.5V9M20 15v3.5a1.5 1.5 0 01-1.5 1.5H15M9 20H5.5A1.5 1.5 0 014 18.5V15"/>'),
  hand: svg('<path d="M8 13V5.8a1.6 1.6 0 013.2 0V11M11.2 10.5V4.6a1.6 1.6 0 013.2 0v6M14.4 10.8V6.4a1.6 1.6 0 013.2 0v7.4A6.2 6.2 0 0111.4 20h-.6a6 6 0 01-5-2.7l-2.4-3.6a1.6 1.6 0 012.6-1.8L8 14"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>'),
  settings: svg('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>'),
  heart: svg('<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0112 7a4.3 4.3 0 017.5 2.8C19.5 15.4 12 20 12 20z"/>'),
  speaker: svg('<path d="M4 9.5v5h3.5L13 19V5L7.5 9.5H4z" fill="currentColor"/><path d="M16.5 8.8a4.6 4.6 0 010 6.4M19 6.3a8.2 8.2 0 010 11.4"/>'),
  trash: svg('<path d="M4.5 7h15M10 11v5.5M14 11v5.5M6.5 7l.9 11.2A2 2 0 009.4 20h5.2a2 2 0 002-1.8L17.5 7M9.5 7V4.8h5V7"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  expand: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  palette: svg('<path d="M12 3.5a8.5 8.5 0 000 17c1.2 0 1.8-.8 1.8-1.7 0-1.4-1.2-1.6-1.2-2.8 0-1 .8-1.6 1.8-1.6h2.1a4 4 0 004-4.2C20.5 6.6 16.7 3.5 12 3.5z"/><circle cx="7.8" cy="11" r="1.2" fill="currentColor"/><circle cx="10.5" cy="7.3" r="1.2" fill="currentColor"/><circle cx="15" cy="7.6" r="1.2" fill="currentColor"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  swap: svg('<path d="M7 7h12l-3-3M17 17H5l3 3"/>'),
  zoom: svg('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M8.5 11h5M11 8.5v5"/>'),
  share: svg('<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 12v6.5A1.5 1.5 0 006.5 20h11a1.5 1.5 0 001.5-1.5V12"/>'),
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z" fill="currentColor"/></svg>',
  mirror: svg('<path d="M12 3v18" stroke-dasharray="2.5 2.5"/><path d="M9 7L4 12l5 5V7zM15 7l5 5-5 5V7z" fill="currentColor"/>'),
  sparkle: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill="currentColor"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" fill="currentColor"/>'),
  paper: svg('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>'),
};

// 앱 로고: 색 점 세 개
export const LOGO = `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="2" y="2" width="44" height="44" rx="14" fill="#FFC12E" stroke="#241B3A" stroke-width="3"/><circle cx="17" cy="19" r="6" fill="#FF5A3C" stroke="#241B3A" stroke-width="2.5"/><circle cx="31" cy="19" r="6" fill="#3BA4FF" stroke="#241B3A" stroke-width="2.5"/><circle cx="24" cy="31" r="6" fill="#2DBE7E" stroke="#241B3A" stroke-width="2.5"/></svg>`;

// 메인 탭 아이콘 (색이 있는 작은 그림)
export const MODE_ICON = {
  color: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4a12 12 0 000 24c1.7 0 2.5-1.1 2.5-2.4 0-2-1.7-2.3-1.7-4 0-1.4 1.1-2.3 2.5-2.3h3a5.7 5.7 0 005.7-6C28 8.4 22.6 4 16 4z" fill="#FFF3E0"/><circle cx="10" cy="15" r="2.6" fill="#FF6A4D"/><circle cx="13.5" cy="9.5" r="2.6" fill="#FFC83D"/><circle cx="20" cy="9.5" r="2.6" fill="#5CC8A4"/><circle cx="11.5" cy="21" r="2.6" fill="#58A8F5"/></svg>`,
  letters: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="5" width="26" height="22" rx="6" fill="#EAF3FF"/><text x="10.5" y="21.5" font-size="12" font-weight="800" text-anchor="middle" fill="#2F7BE0" font-family="Apple SD Gothic Neo, Malgun Gothic, sans-serif">가</text><text x="21.5" y="21.5" font-size="12" font-weight="800" text-anchor="middle" fill="#FF6A4D" font-family="ui-rounded, Arial Rounded MT Bold, Arial, sans-serif">A</text></svg>`,
  makeup: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="4" width="24" height="24" rx="8" fill="#FFE6F0"/><rect x="12" y="17" width="9" height="10" rx="1.5" fill="#2A2623"/><rect x="13" y="13.5" width="7" height="4.5" rx="1" fill="#D9B44A"/><path d="M14 13.5V8.5Q16.5 5 19 7V13.5Z" fill="#FF4F79"/></svg>`,
  gallery: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="5" width="24" height="22" rx="5" fill="#FFF6D6"/><path d="M16 9.5l2 4.1 4.5.6-3.3 3.1.8 4.5L16 19.6l-4 2.2.8-4.5-3.3-3.1 4.5-.6z" fill="#FFB800"/></svg>`,
};

function mix(hex, to, k) {
  const a = hexToRgb(hex);
  const b = hexToRgb(to);
  return rgbToHex(...a.map((v, i) => Math.round(v + (b[i] - v) * k)));
}

// 필통에 꽂힌 도구 그림 (오른쪽을 향함). c = 지금 고른 색
export function toolSvg(id, c) {
  const d = mix(c, '#000000', 0.3);
  const l = mix(c, '#FFFFFF', 0.4);
  const edge = 'stroke="rgba(0,0,0,.14)" stroke-width="1"';
  const tip = 'M68 8L89 12.6Q92 14 89 15.4L68 20Z';
  let b = '';
  switch (id) {
    case 'crayon':
      b = `<rect x="4" y="6" width="64" height="16" rx="3" fill="${c}" ${edge}/><rect x="18" y="6" width="34" height="16" fill="#fff" opacity=".3"/><path d="M18 6v16M52 6v16" stroke="${d}" stroke-width="1.4"/><path d="${tip}" fill="${d}"/>`;
      break;
    case 'pencil':
      b = `<rect x="0" y="7" width="8" height="14" rx="3" fill="#F4A6A0"/><rect x="8" y="7" width="5" height="14" fill="#CFC8BE"/><rect x="13" y="7" width="51" height="14" fill="${c}" ${edge}/><rect x="13" y="12.5" width="51" height="3" fill="#fff" opacity=".25"/><path d="M64 7L86 13v2L64 21Z" fill="#EDCB98"/><path d="M80 12.3L93 14L80 15.7Z" fill="${d}"/>`;
      break;
    case 'marker':
      b = `<rect x="4" y="6" width="56" height="16" rx="7" fill="#F7F4EF" ${edge}/><rect x="4" y="6" width="18" height="16" rx="7" fill="${c}"/><rect x="38" y="9.5" width="16" height="9" rx="2.5" fill="${c}" opacity=".85"/><rect x="60" y="8" width="10" height="12" rx="2" fill="#3A3633"/><path d="M70 10L86 11.5Q89 14 86 16.5L70 18Z" fill="${c}"/>`;
      break;
    case 'paint':
      b = `<path d="M2 12.5Q2 10.5 4 10.5L50 11.5V16.5L4 17.5Q2 17.5 2 15.5Z" fill="#C9935E"/><rect x="50" y="9.5" width="14" height="9" rx="2" fill="#CFC8BE"/><path d="M64 9.2Q82 8.5 95 14Q82 19.5 64 18.8Z" fill="${c}" ${edge}/>`;
      break;
    case 'airbrush':
      b = `<rect x="6" y="4" width="50" height="20" rx="7" fill="${c}" ${edge}/><rect x="12" y="7.5" width="38" height="3" rx="1.5" fill="#fff" opacity=".35"/><rect x="56" y="9" width="8" height="10" rx="2" fill="#CFC8BE"/><rect x="64" y="12" width="5" height="4" fill="#8E877F"/>${[[76, 10], [83, 14], [77, 18.5], [90, 11], [89, 18]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="${c}" opacity=".7"/>`).join('')}`;
      break;
    case 'glitter':
      b = `<rect x="4" y="12" width="62" height="4" rx="2" fill="${l}" ${edge}/><path d="M80 3l3 6.6 7.2.8-5.4 4.9 1.5 7.1L80 18.8l-6.3 3.6 1.5-7.1-5.4-4.9 7.2-.8z" fill="${c}" ${edge}/><circle cx="94" cy="5" r="1.6" fill="${c}"/><circle cx="95" cy="22" r="1.3" fill="${c}"/>`;
      break;
    case 'rainbow':
      b = `<defs><linearGradient id="rbGrad" x1="0" x2="1"><stop offset="0" stop-color="#FF5A5A"/><stop offset=".25" stop-color="#FFC83D"/><stop offset=".5" stop-color="#5CC8A4"/><stop offset=".75" stop-color="#58A8F5"/><stop offset="1" stop-color="#9B7BF0"/></linearGradient></defs><rect x="4" y="6" width="64" height="16" rx="3" fill="url(#rbGrad)"/><rect x="18" y="6" width="34" height="16" fill="#fff" opacity=".3"/><path d="${tip}" fill="#9B7BF0"/>`;
      break;
    case 'fill':
      b = `<path d="M20 7h36l-4 17H24Z" fill="#E9E3DA" ${edge}/><ellipse cx="38" cy="7.5" rx="18" ry="3.2" fill="${c}"/><path d="M55 8Q73 9 77 19Q79 25 73 25Q68 25 70 19Q71 14 55 11Z" fill="${c}"/><circle cx="86" cy="22" r="2.6" fill="${c}"/>`;
      break;
    case 'eraser':
      b = `<rect x="18" y="7" width="66" height="14" rx="3.5" fill="#F7B9B4" ${edge}/><rect x="18" y="7" width="38" height="14" rx="2" fill="#5B8DEF"/><rect x="18" y="12" width="38" height="4" fill="#fff" opacity=".5"/>`;
      break;
  }
  return `<svg viewBox="0 0 100 28" aria-hidden="true">${b}</svg>`;
}

// 받침대에 세워 둔 도구 그림 (위를 향함, 28×100). c = 지금 고른 색
export function toolUpright(id, c) {
  const d = mix(c, '#000000', 0.3);
  const l = mix(c, '#FFFFFF', 0.4);
  const edge = 'stroke="rgba(0,0,0,.14)" stroke-width="1"';
  let b = '';
  switch (id) {
    case 'crayon':
      b = `<rect x="4" y="30" width="20" height="68" rx="3" fill="${c}" ${edge}/><rect x="4" y="48" width="20" height="28" fill="#fff" opacity=".3"/><path d="M5 30 L13 6 Q14 3 15 6 L23 30Z" fill="${d}"/>`;
      break;
    case 'pencil':
      b = `<rect x="5" y="30" width="18" height="58" fill="${c}" ${edge}/><rect x="5" y="86" width="18" height="6" fill="#CFC8BE"/><rect x="5" y="92" width="18" height="7" rx="2" fill="#F4A6A0"/><path d="M5 30 L14 6 L23 30Z" fill="#EDCB98"/><path d="M11 14 L14 5 L17 14Z" fill="${d}"/>`;
      break;
    case 'marker':
      b = `<rect x="4" y="34" width="20" height="64" rx="7" fill="#F7F4EF" ${edge}/><rect x="4" y="80" width="20" height="18" rx="7" fill="${c}"/><rect x="7" y="24" width="14" height="12" rx="2" fill="#3A3633"/><path d="M9 24 L11 8 Q14 5 17 8 L19 24Z" fill="${c}"/>`;
      break;
    case 'paint':
      b = `<path d="M11 40 L17 40 L18 98 Q14 100 10 98Z" fill="#C9935E"/><rect x="9" y="28" width="10" height="14" rx="2" fill="#CFC8BE"/><path d="M9 28 Q8 12 14 2 Q20 12 19 28Z" fill="${c}" ${edge}/>`;
      break;
    case 'airbrush':
      b = `<rect x="3" y="36" width="22" height="62" rx="7" fill="${c}" ${edge}/><rect x="7" y="42" width="4" height="40" rx="2" fill="#fff" opacity=".35"/><rect x="9" y="26" width="10" height="12" rx="2" fill="#CFC8BE"/><rect x="12" y="20" width="4" height="7" fill="#8E877F"/><circle cx="8" cy="10" r="2" fill="${c}"/><circle cx="16" cy="5" r="2" fill="${c}"/><circle cx="21" cy="12" r="2" fill="${c}"/>`;
      break;
    case 'glitter':
      b = `<rect x="12" y="30" width="5" height="68" rx="2.5" fill="${l}" ${edge}/><path d="M14.5 4 l3.3 7.5 8 .9 -6 5.3 1.8 8 -7.1 -4.2 -7.1 4.2 1.8 -8 -6 -5.3 8 -.9z" fill="${c}" ${edge}/>`;
      break;
    case 'rainbow':
      b = `<defs><linearGradient id="rbUp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF5A5A"/><stop offset=".3" stop-color="#FFC83D"/><stop offset=".55" stop-color="#5CC8A4"/><stop offset=".8" stop-color="#58A8F5"/><stop offset="1" stop-color="#9B7BF0"/></linearGradient></defs><rect x="4" y="30" width="20" height="68" rx="3" fill="url(#rbUp)"/><path d="M5 30 L13 6 Q14 3 15 6 L23 30Z" fill="#FF5A5A"/>`;
      break;
    case 'fill':
      b = `<path d="M3 46 H25 L22 98 H6Z" fill="#E9E3DA" ${edge}/><ellipse cx="14" cy="46" rx="11" ry="3.5" fill="${c}"/><path d="M9 44 Q6 30 11 22 Q13 32 13 44Z" fill="${c}"/><circle cx="18" cy="30" r="3" fill="${c}"/>`;
      break;
    case 'eraser':
      b = `<rect x="4" y="44" width="20" height="54" rx="4" fill="#5B8DEF"/><rect x="4" y="30" width="20" height="18" rx="4" fill="#F7B9B4"/>`;
      break;
  }
  return `<svg viewBox="0 0 28 100" aria-hidden="true">${b}</svg>`;
}

// 홈 카드 그림
export const ART = {
  letters: `<svg viewBox="0 0 240 150" aria-hidden="true"><line x1="0" y1="75" x2="240" y2="75" stroke="#B9D3EE" stroke-width="2" stroke-dasharray="8 7"/><text x="62" y="118" text-anchor="middle" font-family="Jua, sans-serif" font-size="118" fill="#FFFFFF" stroke="#4E8FD6" stroke-width="3" stroke-dasharray="10 7">가</text><text x="178" y="118" text-anchor="middle" font-family="Jua, sans-serif" font-size="118" fill="#FFFFFF" stroke="#4E8FD6" stroke-width="3" stroke-dasharray="10 7">A</text><path d="M30 70 Q60 40 92 66" fill="none" stroke="#F0573A" stroke-width="9" stroke-linecap="round"/></svg>`,
  makeup: `<svg viewBox="0 0 200 170" aria-hidden="true"><path d="M40 160 Q40 40 100 40 Q160 40 160 160Z" fill="#3B2A22"/><ellipse cx="100" cy="98" rx="46" ry="54" fill="#F8D9C2"/><circle cx="84" cy="96" r="6" fill="#2A1D18"/><circle cx="116" cy="96" r="6" fill="#2A1D18"/><ellipse cx="74" cy="114" rx="10" ry="6" fill="#FF9FB6" opacity=".7"/><ellipse cx="126" cy="114" rx="10" ry="6" fill="#FF9FB6" opacity=".7"/><path d="M90 124 Q100 132 110 124" fill="#E0115F" stroke="#E0115F" stroke-width="4" stroke-linecap="round"/><path d="M66 52 L60 20 L82 38 L100 12 L118 38 L140 20 L134 52Z" fill="#F5C451" stroke="#D99B00" stroke-width="3" stroke-linejoin="round"/><circle cx="100" cy="40" r="5" fill="#F0573A"/></svg>`,
  flower: `<svg viewBox="0 0 120 150" aria-hidden="true"><g stroke="#2A2623" stroke-width="3" stroke-linejoin="round"><circle cx="60" cy="38" r="16" fill="#F9A8C9"/><circle cx="82" cy="54" r="16" fill="#F9A8C9"/><circle cx="74" cy="80" r="16" fill="#F7B267"/><circle cx="46" cy="80" r="16" fill="#F9A8C9"/><circle cx="38" cy="54" r="16" fill="#F7B267"/><circle cx="60" cy="62" r="14" fill="#FFC93C"/><path d="M60 96 V140" fill="none"/><path d="M60 122 Q40 108 30 116 Q42 132 60 126" fill="#7BC67E"/></g></svg>`,
  crayon: `<svg viewBox="0 0 100 28" aria-hidden="true"><rect x="4" y="6" width="64" height="16" rx="3" fill="#F0573A"/><rect x="18" y="6" width="34" height="16" fill="#fff" opacity=".3"/><path d="M68 8L89 12.6Q92 14 89 15.4L68 20Z" fill="#B8381F"/></svg>`,
};

// data-icon="이름" 이 붙은 요소에 아이콘을 넣는다
export function applyIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    const i = ICON[el.dataset.icon];
    if (i) el.insertAdjacentHTML('afterbegin', i);
    el.removeAttribute('data-icon');
  });
}
