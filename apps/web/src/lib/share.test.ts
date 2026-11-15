import { describe, expect, it, vi } from 'vitest';
import { shareLink } from './share';

const url = 'https://skylens.example/?ra=1&dec=2';

describe('shareLink', () => {
  it('uses the share sheet when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    expect(await shareLink(url, 'SkyLens', { share })).toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'SkyLens', url });
  });

  it('falls back to the clipboard when sharing is unsupported or fails', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await shareLink(url, 'SkyLens', { clipboard: { writeText } })).toBe('copied');
    const share = vi.fn().mockRejectedValue(new Error('boom'));
    expect(await shareLink(url, 'SkyLens', { share, clipboard: { writeText } })).toBe('copied');
    expect(writeText).toHaveBeenCalledTimes(2);
  });

  it('reports a cancelled share sheet or missing clipboard', async () => {
    const abort = Object.assign(new Error('cancel'), { name: 'AbortError' });
    expect(await shareLink(url, 'SkyLens', { share: vi.fn().mockRejectedValue(abort) })).toBe('failed');
    expect(await shareLink(url, 'SkyLens', {})).toBe('failed');
  });
});
