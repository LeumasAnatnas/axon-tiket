// Offline cache + sync queue using IndexedDB
const DB_NAME = "axon-tiket-offline";
const DB_VER = 2;
const CACHE = "cache";
const QUEUE = "queue";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(CACHE)) db.createObjectStore(CACHE);
      if (!db.objectStoreNames.contains(QUEUE)) db.createObjectStore(QUEUE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// === Cache (key-value) ===
async function cacheGet(key) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(CACHE, "readonly");
      const req = tx.objectStore(CACHE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function cacheSet(key, value) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(CACHE, "readwrite");
      tx.objectStore(CACHE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

async function cacheClear() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(CACHE, "readwrite");
      tx.objectStore(CACHE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

// === Queue (checklist sync) ===
async function queueAdd(entry) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(QUEUE, "readwrite");
      tx.objectStore(QUEUE).put({ ...entry, id: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

async function queueGetAll() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(QUEUE, "readonly");
      const req = tx.objectStore(QUEUE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch { return []; }
}

async function queueRemove(id) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(QUEUE, "readwrite");
      tx.objectStore(QUEUE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

async function queueCount() {
  const all = await queueGetAll();
  return all.length;
}

// === Helpers ===
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Erro ao ler arquivo"));
    r.readAsDataURL(file);
  });
}

function base64ToBlob(dataUrl) {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)[1];
  const bin = atob(data);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export { cacheGet, cacheSet, cacheClear, queueAdd, queueGetAll, queueRemove, queueCount, fileToBase64, base64ToBlob };
