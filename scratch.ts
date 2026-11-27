import { parseAmountToPaisa } from "@/lib/money";
import { splitEqually } from "./src/lib/money";
import { parseSpentOn } from "./src/lib/expense";
const cases: unknown[] = [
  "15",
  "15.5",
  "15.50",
  "0.50",
  "0.05",
  "  15.50  ",
  "0",
  "-100",
  "1000000",
  "1000000.01",
  "",
  "abc",
  "15.505",
  "-5",
  15.5,
];

for (const c of cases) {
  console.log(JSON.stringify(c), "→", parseAmountToPaisa(c));
}

console.log(splitEqually(10, ["sita", "ram", "hari", "anil"])); // Kasrat 1
console.log(splitEqually(9, ["sita", "ram", "hari"])); // Kasrat 2
console.log(splitEqually(2, ["sita", "ram", "hari"])); // Kasrat 3
console.log(splitEqually(10000, ["sita", "ram", "hari"])); // Pizza
console.log(splitEqually(10000, ["ram", "ram"])); // Duplicate

import { parseExpenseTitle } from "./src/lib/expense";

for (const c of [
  "Groceries",
  "  Pizza  ",
  "",
  "   ",
  "a".repeat(101),
  "a".repeat(100),
  123,
  null,
]) {
  console.log(JSON.stringify(c)?.slice(0, 20), "→", parseExpenseTitle(c));
}

const now = new Date("2026-11-26T05:00:00Z");
const cases1 = [
  "2026-11-24",
  "2026-11-4",
  "2026-02-30",
  "2026-02-29",
  "2028-02-29",
  "24/11/2026",
  "2026-11-24T10:00:00Z",
  "1999-12-31",
  "2000-01-01",
  "2026-11-27",
  "2026-11-28",
  "2026-13-45",
  "9999-99-99",
  20261124,
];

for (const c of cases1)
  console.log(JSON.stringify(c), "→", parseSpentOn(c, now));
