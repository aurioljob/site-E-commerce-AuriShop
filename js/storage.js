// js/storage.js
import { supabase } from './supabase.js';

/* ============================================================
   UPLOAD D'UN FICHIER
   ============================================================ */
export async function uploadFile(bucket, file, path = null) {
  // Générer un nom unique
  const ext = file.name.split('.').pop().toLowerCase();
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const fileName = path || `${timestamp}-${random}.${ext}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('Erreur upload:', error);
    throw error;
  }

  // Récupérer l'URL publique
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return {
    path: data.path,
    url: publicUrl
  };
}

/* ============================================================
   SUPPRESSION D'UN FICHIER
   ============================================================ */
export async function deleteFile(bucket, path) {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) {
    console.error('Erreur suppression:', error);
    throw error;
  }
}

/* ============================================================
   EXTRAIRE LE CHEMIN DEPUIS UNE URL PUBLIQUE
   Exemple : https://xxx.supabase.co/storage/v1/object/public/product-images/123.jpg
   Retourne : "123.jpg"
   ============================================================ */
export function extractPathFromUrl(url) {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split('/');
    // .../public/{bucket}/{path...}
    const idx = parts.indexOf('public');
    if (idx === -1) return null;
    // Skip "public" et le bucket
    return parts.slice(idx + 2).join('/');
  } catch {
    return null;
  }
}

/* ============================================================
   VALIDATION D'IMAGE
   ============================================================ */
export function validateImage(file, maxSizeMB = 5) {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!validTypes.includes(file.type)) {
    return { valid: false, error: 'Format non supporté. Utilisez JPG, PNG, WEBP ou GIF.' };
  }
  if (file.size > maxSizeMB * 1024 * 1024) {
    return { valid: false, error: `Fichier trop volumineux. Maximum ${maxSizeMB} MB.` };
  }
  return { valid: true };
}