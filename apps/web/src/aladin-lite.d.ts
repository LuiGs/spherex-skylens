declare module 'aladin-lite' {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  export interface GraphicOverlayOptions {
    name?: string;
    color?: string;
    lineWidth?: number;
    fill?: boolean;
  }

  export interface GraphicOverlay {
    add(shape: unknown): void;
  }

  interface AladinLiteApi {
    init: Promise<void>;
    HiPS: (url: string, options: Record<string, unknown>) => unknown;
    aladin: (element: HTMLElement, options: Record<string, unknown>) => any;
    catalogFromVizieR: (...args: any[]) => any;
    catalogFromURL: (
      url: string,
      options: Record<string, unknown>,
      onSuccess?: (catalog: any) => void,
      onError?: (error: unknown) => void,
      useProxy?: boolean,
    ) => any;
    graphicOverlay: (options: GraphicOverlayOptions) => GraphicOverlay;
    catalog: (options: Record<string, unknown>) => any;
    source: (ra: number, dec: number, data?: Record<string, unknown>) => any;
    circle: (ra: number, dec: number, radiusDeg: number, options?: GraphicOverlayOptions) => unknown;
    polyline: (vertices: Array<[number, number]>, options?: GraphicOverlayOptions) => unknown;
  }

  const A: AladinLiteApi;
  export default A;
}
