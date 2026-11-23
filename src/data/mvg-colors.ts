import type { TransitMode } from '../types';

export interface LineVisual {
  color: string;
  textColor: string;
}

/** Official MVG / MVV corporate colors for Munich U-Bahn, S-Bahn, and Tram lines. */
export const MVG_LINE_COLORS: Record<string, LineVisual> = {
  // U-Bahn
  U1: { color: '#52822f', textColor: '#ffffff' },
  U2: { color: '#c20831', textColor: '#ffffff' },
  U3: { color: '#ec6726', textColor: '#ffffff' },
  U4: { color: '#00a984', textColor: '#ffffff' },
  U5: { color: '#bc7a00', textColor: '#ffffff' },
  U6: { color: '#0065ae', textColor: '#ffffff' },
  U7: { color: '#52822f', textColor: '#ffffff' },
  U8: { color: '#c20831', textColor: '#ffffff' },

  // S-Bahn
  S1: { color: '#16bae7', textColor: '#09090b' },
  S2: { color: '#76b82a', textColor: '#09090b' },
  S3: { color: '#951b81', textColor: '#ffffff' },
  S4: { color: '#e30613', textColor: '#ffffff' },
  S5: { color: '#005e86', textColor: '#ffffff' },
  S6: { color: '#00975f', textColor: '#ffffff' },
  S7: { color: '#943126', textColor: '#ffffff' },
  S8: { color: '#18181b', textColor: '#f5b800' },
  S20: { color: '#f05a73', textColor: '#ffffff' },

  // Tram — MVG red with slight differentiation or uniform MVG Tram red
  '12': { color: '#96368b', textColor: '#ffffff' },
  '16': { color: '#0065ae', textColor: '#ffffff' },
  '17': { color: '#8c5634', textColor: '#ffffff' },
  '18': { color: '#76b82a', textColor: '#09090b' },
  '19': { color: '#e30613', textColor: '#ffffff' },
  '20': { color: '#16bae7', textColor: '#09090b' },
  '21': { color: '#bc7a00', textColor: '#ffffff' },
  '23': { color: '#b4c425', textColor: '#09090b' },
  '25': { color: '#f194b4', textColor: '#09090b' },
  '27': { color: '#ec6726', textColor: '#ffffff' },
  '28': { color: '#f5b800', textColor: '#09090b' },
  '29': { color: '#e30613', textColor: '#ffffff' },
};

export function getLineVisual(lineId: string, mode: TransitMode): LineVisual {
  const exact = MVG_LINE_COLORS[lineId];
  if (exact) return exact;
  if (mode === 'tram') return { color: '#e30613', textColor: '#ffffff' };
  if (mode === 'sbahn') return { color: '#00975f', textColor: '#ffffff' };
  return { color: '#0065ae', textColor: '#ffffff' };
}

export function sortLineIds(ids: string[]): string[] {
  const modeRank = (id: string) => {
    if (id.startsWith('U')) return 0;
    if (id.startsWith('S')) return 1;
    return 2;
  };
  const numPart = (id: string) => parseInt(id.replace(/\D+/g, ''), 10) || 999;
  return [...ids].sort((a, b) => {
    const r = modeRank(a) - modeRank(b);
    if (r !== 0) return r;
    const n = numPart(a) - numPart(b);
    if (n !== 0) return n;
    return a.localeCompare(b);
  });
}
