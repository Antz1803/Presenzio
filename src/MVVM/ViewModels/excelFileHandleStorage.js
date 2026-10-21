const DATABASE_NAME = "presenzio-excel-handles";
const DATABASE_VERSION = 1;
const HANDLES = "handles";

let databasePromise;

function openDatabase() {
  if (databasePromise) return databasePromise;
  if (typeof indexedDB === "undefined") return Promise.resolve(null);

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(HANDLES)) {
        request.result.createObjectStore(HANDLES, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch(() => null);

  return databasePromise;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function readExcelHandle(key) {
  const database = await openDatabase();
  if (!database) return null;
  try {
    const transaction = database.transaction(HANDLES, "readonly");
    return (await requestResult(transaction.objectStore(HANDLES).get(key)))?.handle ?? null;
  } catch {
    return null;
  }
}

export async function writeExcelHandle(key, handle) {
  const database = await openDatabase();
  if (!database || !handle) return;
  try {
    const transaction = database.transaction(HANDLES, "readwrite");
    transaction.objectStore(HANDLES).put({ key, handle });
    await transactionComplete(transaction);
  } catch {
    // Some browsers do not allow File System Access handles in IndexedDB.
  }
}

export async function requestExcelWritePermission(handle) {
  if (!handle) return false;
  if (typeof handle.queryPermission !== "function") return true;
  try {
    let permission = await handle.queryPermission({ mode: "readwrite" });
    if (permission !== "granted" && typeof handle.requestPermission === "function") {
      permission = await handle.requestPermission({ mode: "readwrite" });
    }
    return permission === "granted";
  } catch {
    return false;
  }
}
