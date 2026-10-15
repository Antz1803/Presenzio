import { get, push, ref, set, update } from "firebase/database";
import { db } from "./Firebase";

const MATERIALS_PATH = (uid) => `accounts/${uid}/materials`;
const FOLDERS_PATH = (uid) => `accounts/${uid}/materialFolders`;
// File contents live in their own node so listing materials stays light.
const DATA_PATH = (uid) => `accounts/${uid}/materialData`;

function requireDatabase(uid) {
  if (!uid) throw new Error("No signed-in instructor was found.");
  if (!db) throw new Error("Firebase Realtime Database is not configured.");
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

/**
 * Lists material metadata. Older records stored the file contents inline
 * (`dataUrl`); those are moved to the separate data node the first time they
 * are loaded, so later listings no longer download every file.
 */
export async function listMaterials(uid) {
  requireDatabase(uid);
  const snapshot = await get(ref(db, MATERIALS_PATH(uid)));
  const values = snapshot.val() || {};

  const result = [];
  for (const [id, material] of Object.entries(values)) {
    const { dataUrl, ...meta } = material;
    if (dataUrl) {
      try {
        await update(ref(db), {
          [`${MATERIALS_PATH(uid)}/${id}/dataUrl`]: null,
          [`${DATA_PATH(uid)}/${id}`]: { dataUrl },
        });
      } catch {
        // Migration is best-effort; the record is still listed.
      }
    }
    result.push({ id, ...meta });
  }
  return result.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}

export async function getMaterialDataUrl(uid, materialId) {
  requireDatabase(uid);
  const snapshot = await get(ref(db, `${DATA_PATH(uid)}/${materialId}/dataUrl`));
  if (snapshot.exists()) return snapshot.val();
  // Fallback for a record that has not been migrated yet.
  const legacy = await get(ref(db, `${MATERIALS_PATH(uid)}/${materialId}/dataUrl`));
  if (legacy.exists()) return legacy.val();
  throw new Error("The file contents could not be found.");
}

export async function listMaterialFolders(uid) {
  requireDatabase(uid);
  const snapshot = await get(ref(db, FOLDERS_PATH(uid)));
  const values = snapshot.val() || {};
  return Object.entries(values).map(([id, folder]) => ({ id, ...folder }));
}

function validateFolderName(name) {
  const folderName = String(name || "").trim();
  if (!folderName) throw new Error("Enter a folder name.");
  if (folderName.length > 80) throw new Error("Folder names must be 80 characters or fewer.");
  if (/[/\\]/.test(folderName)) throw new Error("Folder names cannot contain slashes.");
  return folderName;
}

function hasDuplicate(folders, name, parentId, ignoreId = null) {
  return folders.some(
    (folder) =>
      folder.id !== ignoreId &&
      (folder.parentId || null) === (parentId || null) &&
      String(folder.name).toLowerCase() === name.toLowerCase(),
  );
}

export async function createMaterialFolder(uid, name, parentId = null) {
  requireDatabase(uid);
  const folderName = validateFolderName(name);
  const folders = await listMaterialFolders(uid);
  if (hasDuplicate(folders, folderName, parentId)) {
    throw new Error("A folder with that name already exists here.");
  }
  const folderRef = push(ref(db, FOLDERS_PATH(uid)));
  await set(folderRef, { name: folderName, parentId: parentId || null, createdAt: Date.now() });
}

export async function renameMaterialFolder(uid, folderId, name) {
  requireDatabase(uid);
  const folderName = validateFolderName(name);
  const folders = await listMaterialFolders(uid);
  const folder = folders.find((item) => item.id === folderId);
  if (!folder) throw new Error("The folder no longer exists.");
  if (hasDuplicate(folders, folderName, folder.parentId, folderId)) {
    throw new Error("A folder with that name already exists here.");
  }
  await update(ref(db, `${FOLDERS_PATH(uid)}/${folderId}`), { name: folderName });
}

/** Deletes a folder, every folder inside it, and every file inside any of them. */
export async function deleteMaterialFolder(uid, folderId) {
  requireDatabase(uid);
  const [folders, materials] = await Promise.all([listMaterialFolders(uid), listMaterials(uid)]);

  const folderIds = new Set([folderId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const folder of folders) {
      if (folder.parentId && folderIds.has(folder.parentId) && !folderIds.has(folder.id)) {
        folderIds.add(folder.id);
        grew = true;
      }
    }
  }

  const updates = {};
  folderIds.forEach((id) => {
    updates[`${FOLDERS_PATH(uid)}/${id}`] = null;
  });
  materials
    .filter((material) => material.folderId && folderIds.has(material.folderId))
    .forEach((material) => {
      updates[`${MATERIALS_PATH(uid)}/${material.id}`] = null;
      updates[`${DATA_PATH(uid)}/${material.id}`] = null;
    });
  await update(ref(db), updates);
}

export async function uploadMaterial(uid, file, category = "Other", folderId = null) {
  requireDatabase(uid);
  if (!file) throw new Error("Choose a file to upload.");
  if (file.size > 7 * 1024 * 1024) throw new Error(`${file.name} is over the 7 MB limit.`);

  const contentType = file.type || "application/octet-stream";
  const base64 = arrayBufferToBase64(await file.arrayBuffer());
  const fileRef = push(ref(db, MATERIALS_PATH(uid)));
  const id = fileRef.key;

  await update(ref(db), {
    [`${DATA_PATH(uid)}/${id}`]: { dataUrl: `data:${contentType};base64,${base64}` },
    [`${MATERIALS_PATH(uid)}/${id}`]: {
      name: file.name,
      category,
      folderId: folderId || null,
      size: file.size,
      contentType,
      updatedAt: Date.now(),
    },
  });
}

export async function renameMaterial(uid, materialId, name) {
  requireDatabase(uid);
  const fileName = String(name || "").trim();
  if (!fileName) throw new Error("Enter a file name.");
  if (fileName.length > 150) throw new Error("File names must be 150 characters or fewer.");
  await update(ref(db, `${MATERIALS_PATH(uid)}/${materialId}`), { name: fileName });
}

export async function moveMaterial(uid, materialId, folderId = null) {
  requireDatabase(uid);
  await update(ref(db, `${MATERIALS_PATH(uid)}/${materialId}`), { folderId: folderId || null });
}

export async function deleteMaterial(uid, materialId) {
  requireDatabase(uid);
  if (!materialId) throw new Error("The selected material is invalid.");
  await update(ref(db), {
    [`${MATERIALS_PATH(uid)}/${materialId}`]: null,
    [`${DATA_PATH(uid)}/${materialId}`]: null,
  });
}