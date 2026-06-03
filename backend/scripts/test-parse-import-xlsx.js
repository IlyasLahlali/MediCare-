const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([
  ["nom", "prix"],
  ["Doliprane 1000mg", 25],
  ["Test Med", 12.5],
]);
XLSX.utils.book_append_sheet(wb, ws, "Stock");
const tmp = path.join(__dirname, "_test-import.xlsx");
XLSX.writeFile(wb, tmp);

const buf = fs.readFileSync(tmp);
const wb2 = XLSX.read(buf, { type: "buffer" });
const rows = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], { header: 1, defval: "", raw: false });
console.log("rows", JSON.stringify(rows));
fs.unlinkSync(tmp);
