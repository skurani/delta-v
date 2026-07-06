export const usd = (x: number, digits = 0) =>
  x.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

export const usd2 = (x: number) => usd(x, 2);

export const pct = (x: number, digits = 1) => (x * 100).toFixed(digits) + "%";

export const shortDay = (iso: string) => iso.slice(5); // "2026-06-30" → "06-30"
