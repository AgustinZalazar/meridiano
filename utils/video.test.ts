import { getVideoMime } from './video';

describe('getVideoMime', () => {
  test('mp4 → video/mp4', () => {
    expect(getVideoMime('mp4')).toBe('video/mp4');
  });

  test('mov → video/quicktime (not video/mov)', () => {
    expect(getVideoMime('mov')).toBe('video/quicktime');
  });

  test('avi → video/x-msvideo (not video/avi)', () => {
    expect(getVideoMime('avi')).toBe('video/x-msvideo');
  });

  test('mkv → video/x-matroska', () => {
    expect(getVideoMime('mkv')).toBe('video/x-matroska');
  });

  test('3gp → video/3gpp', () => {
    expect(getVideoMime('3gp')).toBe('video/3gpp');
  });

  test('webm → video/webm', () => {
    expect(getVideoMime('webm')).toBe('video/webm');
  });

  test('uppercase extension is handled', () => {
    expect(getVideoMime('MP4')).toBe('video/mp4');
    expect(getVideoMime('MOV')).toBe('video/quicktime');
  });

  test('unknown extension falls back to video/mp4', () => {
    expect(getVideoMime('xyz')).toBe('video/mp4');
    expect(getVideoMime('')).toBe('video/mp4');
  });
});
