import { describe, expect, it } from "vitest";
import {
  MAX_AMOUNT_RUPEES,
  parseAmountToPaisa,
  splitEqually,
} from "@/lib/money";

describe("parseAmountToPaisa", () => {
  it.each([
    ["15", 1500],
    ["15.5", 1550],
    ["15.50", 1550],
    ["0.50", 50],
    ["0.05", 5],
    ["  15.50  ", 1550],
    ["007", 700],
    [String(MAX_AMOUNT_RUPEES), MAX_AMOUNT_RUPEES * 100],
  ])("accepts %j as %i paisa", (input, paisa) => {
    expect(parseAmountToPaisa(input)).toEqual({ ok: true, paisa });
  });

  it.each([
    ["", "amount is required"],
    ["   ", "amount is required"],
    ["abc", 'amount must look like "15" or "15.50"'],
    ["15.", 'amount must look like "15" or "15.50"'],
    [".50", 'amount must look like "15" or "15.50"'],
    ["15.505", 'amount must look like "15" or "15.50"'],
    ["-5", 'amount must look like "15" or "15.50"'],
    ["1,500", 'amount must look like "15" or "15.50"'],
    ["15.5.5", 'amount must look like "15" or "15.50"'],
    ["1e3", 'amount must look like "15" or "15.50"'],
    ["0", "amount must be greater than 0"],
    ["0.00", "amount must be greater than 0"],
    [`${MAX_AMOUNT_RUPEES}.01`, "amount must be at most Rs 10,00,000"],
    [15.5, 'amount must be a string like "15.50"'],
    [null, 'amount must be a string like "15.50"'],
    [undefined, 'amount must be a string like "15.50"'],
  ])("rejects %j", (input, error) => {
    expect(parseAmountToPaisa(input)).toEqual({ ok: false, error });
  });
});
// Random whole number from min to max (both included).
function randomInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

describe("splitEqually", () => {
  it("splits Rs 100 among 3 with the extra paisa going to the first in order", () => {
    expect(splitEqually(10000, ["sita", "ram", "hari"])).toEqual({
      ok: true,
      shares: [
        { userId: "hari", paisa: 3334 },
        { userId: "ram", paisa: 3333 },
        { userId: "sita", paisa: 3333 },
      ],
    });
  });

  it("spreads a larger remainder one paisa each (Rs 100 among 7)", () => {
    const result = splitEqually(10000, ["a", "b", "c", "d", "e", "f", "g"]);

    expect(result).toEqual({
      ok: true,
      shares: [
        { userId: "a", paisa: 1429 },
        { userId: "b", paisa: 1429 },
        { userId: "c", paisa: 1429 },
        { userId: "d", paisa: 1429 },
        { userId: "e", paisa: 1428 },
        { userId: "f", paisa: 1428 },
        { userId: "g", paisa: 1428 },
      ],
    });
  });

  it("does not reorder the caller's array", () => {
    const ids = ["sita", "ram", "hari"];

    splitEqually(10000, ids);

    expect(ids).toEqual(["sita", "ram", "hari"]);
  });

  it.each([
    [10000, [], "at least one participant is required"],
    [10000, ["ram", "ram"], "participants must not repeat"],
    [2, ["a", "b", "c"], "amount is too small to split"],
    [10.5, ["ram"], "amount must be a positive whole number of paisa"],
    [0, ["ram"], "amount must be a positive whole number of paisa"],
    [-100, ["ram"], "amount must be a positive whole number of paisa"],
  ])("rejects %j paisa for %j", (amount, ids, error) => {
    expect(splitEqually(amount, ids)).toEqual({ ok: false, error });
  });

  it("keeps the 5 rules for 1000 random splits", () => {
    for (let run = 0; run < 1000; run++) {
      const count = randomInt(1, 10);
      const ids = Array.from({ length: count }, (_, i) => `user-${i}`);
      const amount = randomInt(count, MAX_AMOUNT_RUPEES * 100);

      const result = splitEqually(amount, ids);
      if (!result.ok) {
        throw new Error(`split failed for ${amount} paisa / ${count} people`);
      }

      const paisas = result.shares.map((s) => s.paisa);

      // Niyam 1: jamma = amount
      expect(paisas.reduce((a, b) => a + b, 0)).toBe(amount);

      // Niyam 2: farak ≤ 1
      expect(Math.max(...paisas) - Math.min(...paisas)).toBeLessThanOrEqual(1);

      // Niyam 3: sankhya
      expect(result.shares).toHaveLength(count);

      // Niyam 4: sabai > 0
      expect(Math.min(...paisas)).toBeGreaterThan(0);

      // Niyam 5: ulto kram ma diye pani usai result
      expect(splitEqually(amount, [...ids].reverse())).toEqual(result);
    }
  });
});
