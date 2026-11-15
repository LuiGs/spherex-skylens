export type ShareOutcome = 'shared' | 'copied' | 'failed';

interface ShareCapable {
  share?: (data: { title: string; url: string }) => Promise<void>;
  canShare?: (data: { title: string; url: string }) => boolean;
  clipboard?: { writeText: (text: string) => Promise<void> };
}

/** Opens the system share sheet when there is one (phones), otherwise copies the link. */
export async function shareLink(url: string, title: string, nav: ShareCapable = navigator): Promise<ShareOutcome> {
  const data = { title, url };
  if (nav.share && (!nav.canShare || nav.canShare(data))) {
    try {
      await nav.share(data);
      return 'shared';
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') return 'failed';
    }
  }
  try {
    await nav.clipboard?.writeText(url);
    return nav.clipboard ? 'copied' : 'failed';
  } catch {
    return 'failed';
  }
}
