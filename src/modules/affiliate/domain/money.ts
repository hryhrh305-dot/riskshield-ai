import type { Money } from "./types";

export const usd = (amountMinor: bigint): Money => Object.freeze({ amountMinor, currency: "USD" });

export function addMoney(left: Money, right: Money): Money {
  if (left.currency !== right.currency) throw new Error("AFFILIATE_CURRENCY_MISMATCH");
  return usd(left.amountMinor + right.amountMinor);
}

export function multiplyRatioHalfUp(value: Money, numerator: bigint, denominator: bigint): Money {
  if (denominator <= 0n || numerator < 0n || value.amountMinor < 0n) throw new Error("AFFILIATE_INVALID_MONEY_RATIO");
  const scaled = value.amountMinor * numerator;
  return usd((scaled + denominator / 2n) / denominator);
}

export function parseUsdDecimal(input: string): Money {
  if (!/^\d+(?:\.\d{1,2})?$/.test(input)) throw new Error("AFFILIATE_INVALID_USD");
  const [whole, fraction = ""] = input.split(".");
  return usd(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0")));
}

export const serializeMoney = (money: Money) => ({ amountMinor: money.amountMinor.toString(), currency: money.currency });
