export const mean = (a: readonly number[]): number => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);

export const median = (a: readonly number[]): number => {
  if (!a.length) return NaN;
  const b = [...a].sort((x, y) => x - y);
  const m = b.length >> 1;
  return b.length % 2 ? b[m]! : (b[m - 1]! + b[m]!) / 2;
};

/** Divario (M − F) ÷ M in percentuale: positivo = le donne sono pagate meno (Dir. 2023/970, art. 3). */
export const gapPct = (female: number, male: number): number | null =>
  Number.isFinite(female) && Number.isFinite(male) && male !== 0 ? ((male - female) / male) * 100 : null;
