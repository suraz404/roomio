import { parseAmountToPaisa } from "@/lib/money";
const cases: unknown[] = [
  "15",
  "15.5",
  "15.50",
  "0.50",
  "0.05",
  "  15.50  ",
  "0",
  "0.00",
  "10000000",
  "10000000.01",
  "",
  "abc",
  "15.505",
  15.5,
];

for (const c of cases) {
  console.log(JSON.stringify(c), "→", parseAmountToPaisa(c));
}
