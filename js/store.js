// 모든 데이터는 iPad 안의 IndexedDB에 저장된다 (서버 없음)
//  pictures : 그림 정보 + 작은 미리보기
//  files    : `${id}:line` 도안, `${id}:sample` 샘플, `${id}:paint` 색칠한 층
//  gallery  : 완성 저장한 작품
//  kv       : 설정
const DB_NAME = 'coloring-pad';
let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('pictures')) d.createObjectStore('pictures', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('files')) d.createObjectStore('files');
        if (!d.objectStoreNames.contains('gallery')) d.createObjectStore('gallery', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  return dbPromise;
}

const wrap = (r) =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

async function os(name, mode) {
  const d = await openDb();
  return d.transaction(name, mode).objectStore(name);
}

export const db = {
  get: async (s, k) => wrap((await os(s, 'readonly')).get(k)),
  all: async (s) => wrap((await os(s, 'readonly')).getAll()),
  put: async (s, v, k) => {
    const store = await os(s, 'readwrite');
    return wrap(k === undefined ? store.put(v) : store.put(v, k));
  },
  del: async (s, k) => wrap((await os(s, 'readwrite')).delete(k)),
};

const fileKey = (id, kind) => `${id}:${kind}`;
export const getFile = (id, kind) => db.get('files', fileKey(id, kind));
export const putFile = (id, kind, blob) => db.put('files', blob, fileKey(id, kind));
export const delFile = (id, kind) => db.del('files', fileKey(id, kind));

export async function deletePicture(id) {
  await db.del('pictures', id);
  await Promise.all(['line', 'sample', 'paint'].map((k) => delFile(id, k)));
}

export async function getSetting(k, def) {
  const v = await db.get('kv', k);
  return v === undefined ? def : v;
}
export const setSetting = (k, v) => db.put('kv', v, k);
