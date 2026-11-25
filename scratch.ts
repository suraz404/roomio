import { parseAmountToPaisa } from "@/lib/money";
import { splitEqually } from "./src/lib/money";
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
