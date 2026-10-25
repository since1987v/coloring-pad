// 글자 따라쓰기에서 받은 별(글자마다 최고 기록)
import { getSetting, setSetting } from './store.js';

let stars = null;

export async function loadStars() {
  if (!stars) stars = await getSetting('traceStars', {});
  return stars;
}

export const starsOf = (key) => (stars && stars[key]) || 0;

export function saveStars(key, n) {
  if (n <= starsOf(key)) return;
  stars[key] = n;
  setSetting('traceStars', stars);
}
