require("dotenv").config();
const pool = require("../config/db");
pool.query("SHOW CREATE TABLE pharmacies").then(([r]) => {
  console.log(r[0]["Create Table"]);
  process.exit(0);
});
