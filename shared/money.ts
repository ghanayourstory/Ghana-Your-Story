// All money is stored as integer minor units: pesewas for cedis (GHS), cents
// for dollars (USD). Never use floats for balances.

export type Currency = "GHS" | "USD";

export const cedis = (amount: number): number => Math.round(amount * 100);

export function formatMoney(minor: number, currency: Currency = "GHS", opts: { compact?: boolean } = {}): string {
  const sign = minor < 0 ? "−" : "";
  const major = Math.abs(minor) / 100;
  const symbol = currency === "GHS" ? "GH₵" : "$";
  if (opts.compact && major >= 1000) {
    const units: [number, string][] = [[1e9, "B"], [1e6, "M"], [1e3, "k"]];
    for (const [size, suffix] of units) {
      if (major >= size) {
        const v = major / size;
        return `${sign}${symbol}${v >= 100 ? v.toFixed(0) : v.toFixed(1)}${suffix}`;
      }
    }
  }
  return `${sign}${symbol}${major.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function isMinorAmount(n: unknown): n is number {
  return typeof n === "number" && Number.isSafeInteger(n);
}
