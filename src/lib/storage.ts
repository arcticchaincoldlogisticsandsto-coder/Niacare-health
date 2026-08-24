import { supabase } from './supabaseClient';

export const PERSONAL_FILES_BUCKET = 'personal-files';
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB, matches the bucket's file_size_limit
export const ALLOWED_UPLOAD_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx'];

export const formatFileSize = (bytes: number): string => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
};

const sanitizeFileName = (name: string): string =>
  name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);

const getExtension = (name: string): string => {
  const parts = name.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

export const validateUploadFile = (file: File, isSwahili: boolean): string | null => {
  if (file.size > MAX_UPLOAD_BYTES) {
    return isSwahili
      ? 'Faili ni kubwa mno. Kiwango cha juu ni 25MB.'
      : 'File is too large. Maximum size is 25MB.';
  }
  const ext = getExtension(file.name);
  if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
    return isSwahili
      ? 'Aina ya faili haikubaliki. Tumia PDF, picha (JPG/PNG), au Word.'
      : 'Unsupported file type. Use PDF, an image (JPG/PNG), or Word.';
  }
  return null;
};

/**
 * Uploads a real file's bytes into the patient's private storage folder.
 * Returns the storage object path (not a public URL, since the bucket is
 * private) — that path is what gets saved into personal_files.file_url.
 */
export const uploadPersonalFile = async (
  userId: string,
  file: File
): Promise<{ path?: string; error?: string }> => {
  const path = `${userId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;

  const { error } = await supabase.storage.from(PERSONAL_FILES_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  });

  if (error) return { error: error.message };
  return { path };
};

/**
 * Bucket is private, so downloads/views go through a short-lived signed URL
 * rather than a permanent public link.
 */
export const getPersonalFileSignedUrl = async (
  path: string,
  expiresInSeconds = 120
): Promise<{ url?: string; error?: string }> => {
  const { data, error } = await supabase.storage
    .from(PERSONAL_FILES_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) return { error: error?.message || 'Could not create signed URL' };
  return { url: data.signedUrl };
};

export const deleteStoredFile = async (path: string): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.storage.from(PERSONAL_FILES_BUCKET).remove([path]);
  if (error) return { success: false, error: error.message };
  return { success: true };
};
