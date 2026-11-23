const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

export const MAX_AMOUNT_RUPEES = 1_000_000; // Rs 10,00,000
export const MAX_AMOUNT_PAISA = MAX_AMOUNT_RUPEES * 100;

type ParseAmountResult =
  | { ok: true; paisa: number }
  | { ok: false; error: string };

// Turns user text like "15.50" into integer paisa (1550) without ever
// using floating-point numbers.
export function parseAmountToPaisa(input: unknown): ParseAmountResult {
  if (typeof input !== "string") {
    return { ok: false, error: 'amount must be a string like "15.50"' };
  }

  const trimmedInput = input.trim();

  if (trimmedInput.length === 0) {
    return { ok: false, error: "amount is required" };
  }

  if (!AMOUNT_PATTERN.test(trimmedInput)) {
    return { ok: false, error: 'amount must look like "15" or "15.50"' };
  }

  const [rupeePart, paisaPart = ""] = trimmedInput.split(".");

  const paisa = Number(rupeePart) * 100 + Number(paisaPart.padEnd(2, "0"));

  if (paisa === 0) {
    return { ok: false, error: "amount must be greater than 0" };
  }

  if (paisa > MAX_AMOUNT_PAISA) {
    return { ok: false, error: "amount must be at most Rs 10,00,000" };
  }

  return { ok: true, paisa };
}
