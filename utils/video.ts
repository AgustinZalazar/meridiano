const MIME_MAP: Record<string, string> = {
  mp4:  'video/mp4',
  mov:  'video/quicktime',
  avi:  'video/x-msvideo',
  mkv:  'video/x-matroska',
  '3gp': 'video/3gpp',
  webm: 'video/webm',
};

export function getVideoMime(ext: string): string {
  return MIME_MAP[ext.toLowerCase()] ?? 'video/mp4';
}
