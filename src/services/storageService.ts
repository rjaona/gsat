import { supabase } from './supabase';

// Bucket privé — les URLs sont des Signed URLs (expiration 1h)
const BUCKET = 'preuves';

// Chemin convention : preuves/{orgId}/{campaignId}/{evalId}/{criterionCode}/{filename}

export async function uploadEvidence(path: string, file: File): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Impossible d'uploader le fichier : ${error.message}`);
}

/**
 * Upload avec suivi de progression.
 * Supabase JS v2 supporte onUploadProgress nativement.
 */
export async function uploadEvidenceResumable(
  path: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
      // @ts-expect-error — onUploadProgress supporté par Supabase JS v2 mais pas encore dans les types
      onUploadProgress: (progress: { loaded: number; total: number }) => {
        onProgress?.(Math.round((progress.loaded / progress.total) * 100));
      },
    });
  if (error) throw new Error(`Impossible d'uploader le fichier : ${error.message}`);
}

export async function deleteEvidence(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`Impossible de supprimer le fichier : ${error.message}`);
}

/**
 * Retourne une Signed URL valide 1 heure.
 * Le bucket "preuves" est privé — ne jamais utiliser getPublicUrl.
 */
export async function getEvidenceUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);
  if (error || !data) throw new Error(`Impossible de récupérer l'URL du fichier : ${error?.message}`);
  return data.signedUrl;
}
