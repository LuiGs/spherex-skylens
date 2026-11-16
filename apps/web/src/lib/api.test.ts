import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, fetchObservations, wakeApi } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchObservations', () => {
  it('returns the observations response', async () => {
    const payload = { ra: 1, dec: 2, size_deg: 0.1, count: 0, observations: [] };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchObservations({ ra: 1, dec: 2, size: 0.1 }, new AbortController().signal)).resolves.toEqual(
      payload,
    );
    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/observations?');
  });

  it('maps 502 to busy and 404 to http', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 502 }))
      .mockResolvedValueOnce(new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchObservations({ ra: 1, dec: 2, size: 1 }, new AbortController().signal)).rejects.toMatchObject({
      kind: 'busy',
      status: 502,
    });
    await expect(fetchObservations({ ra: 1, dec: 2, size: 1 }, new AbortController().signal)).rejects.toMatchObject({
      kind: 'http',
      status: 404,
    });
  });

  it('maps fetch failures to network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    await expect(fetchObservations({ ra: 1, dec: 2, size: 1 }, new AbortController().signal)).rejects.toBeInstanceOf(
      ApiError,
    );
    await expect(fetchObservations({ ra: 1, dec: 2, size: 1 }, new AbortController().signal)).rejects.toMatchObject({
      kind: 'network',
    });
  });

  it('propagates abort errors without wrapping them', async () => {
    const abort = new DOMException('aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort));

    await expect(fetchObservations({ ra: 1, dec: 2, size: 1 }, new AbortController().signal)).rejects.toBe(abort);
    await expect(fetchObservations({ ra: 1, dec: 2, size: 1 }, new AbortController().signal)).rejects.not.toBeInstanceOf(
      ApiError,
    );
  });
});

describe('wakeApi', () => {
  it('pings the health endpoint without caching and swallows failures', async () => {
    const calls: string[] = [];
    const failing = ((url: string) => {
      calls.push(url);
      return Promise.reject(new Error('offline'));
    }) as unknown as typeof fetch;
    expect(() => wakeApi(failing)).not.toThrow();
    await Promise.resolve();
    expect(calls[0]).toMatch(/\/health$/);
  });
});
