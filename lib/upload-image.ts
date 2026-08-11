import { supabase } from './supabase';

function decodeBase64(base64: string): ArrayBuffer {
  const chars = atob(base64);
  const bytes = new Uint8Array(chars.length);
  for (let i = 0; i < chars.length; i++) bytes[i] = chars.charCodeAt(i);
  return bytes.buffer;
}

const ALLOWED_IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'];

export async function uploadProjectImage(
  userId: string,
  localUri: string,
  base64: string,
): Promise<string | null> {
  const ext = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  if (!ALLOWED_IMAGE_EXTS.includes(ext)) {
    console.error('[uploadProjectImage] tipo de archivo no permitido:', ext);
    return null;
  }
  const filename = `${userId}/${Date.now()}.${ext}`;
  const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;

  const { error } = await supabase.storage
    .from('project-images')
    .upload(filename, decodeBase64(base64), { contentType, upsert: true });

  if (error) {
    console.error('[uploadProjectImage]', error.message);
    return null;
  }

  const { data } = supabase.storage.from('project-images').getPublicUrl(filename);
  return data.publicUrl;
}
