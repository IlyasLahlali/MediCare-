const mysql = require("mysql2/promise");
require("dotenv").config();

function trimEnv(value) {
  return typeof value === "string" ? value.trim() : value;
}

function parseDatabaseUrl(rawUrl) {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    const database = url.pathname.replace(/^\//, "") || "railway";
    const isInternal = url.hostname.includes(".railway.internal");
    return {
      host: url.hostname,
      port: Number(url.port) || 3306,
      user: decodeURIComponent(url.username || "root"),
      password: decodeURIComponent(url.password || ""),
      database,
      useSsl: !isInternal,
    };
  } catch {
    return null;
  }
}

function readDbConfig() {
  const urlConfig =
    parseDatabaseUrl(trimEnv(process.env.DATABASE_URL)) ||
    parseDatabaseUrl(trimEnv(process.env.MYSQL_PUBLIC_URL)) ||
    parseDatabaseUrl(trimEnv(process.env.MYSQL_URL));

  if (urlConfig) return urlConfig;

  const host = trimEnv(process.env.DB_HOST || process.env.MYSQLHOST || "localhost");
  const user = trimEnv(process.env.DB_USER || process.env.MYSQLUSER || "root");
  const password = trimEnv(process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || "");
  const database = trimEnv(process.env.DB_NAME || process.env.MYSQLDATABASE || "railway");
  const port = Number(trimEnv(process.env.DB_PORT || process.env.MYSQLPORT || 3306));

  const isPublicProxy =
    host.includes(".proxy.rlwy.net") || host.endsWith(".rlwy.net");
  const isInternal = host.includes(".railway.internal");
  let useSsl = false;
  if (isPublicProxy) useSsl = true;
  else if (process.env.DB_SSL === "true") useSsl = true;
  else if (!isInternal && process.env.DB_SSL !== "false") useSsl = false;

  return { host, user, password, database, port, useSsl };
}

const cfg = readDbConfig();

if (process.env.NODE_ENV === "production") {
  const hasUrl =
    trimEnv(process.env.DATABASE_URL) ||
    trimEnv(process.env.MYSQL_URL) ||
    trimEnv(process.env.MYSQL_PUBLIC_URL);
  const hasHost = trimEnv(process.env.DB_HOST) || trimEnv(process.env.MYSQLHOST);
  if (!hasUrl && !hasHost) {
    console.error(
      "RAILWAY — Variables manquantes sur le service MediCare- : ajoutez DATABASE_URL (référence MYSQL_URL du service MySQL) ou DB_HOST + DB_USER + DB_PASSWORD + DB_NAME=railway + DB_SSL=true"
    );
    process.exit(1);
  }
  if (cfg.host === "localhost" || cfg.host === "127.0.0.1") {
    console.error(
      "RAILWAY — Connexion interdite vers localhost en production. Utilisez DATABASE_URL depuis le service MySQL Railway."
    );
    process.exit(1);
  }
}

const pool = mysql.createPool({
  host: cfg.host,
  user: cfg.user,
  password: cfg.password,
  database: cfg.database,
  port: cfg.port,
  waitForConnections: true,
  connectionLimit: 10,
  connectTimeout: 15000,
  ssl: cfg.useSsl ? { rejectUnauthorized: false } : undefined,
});

pool
  .query("SELECT 1")
  .then(() => console.log("Connecté à MySQL ✔", cfg.database))
  .catch((err) => {
    console.error("Erreur connexion DB :", err.message);
    console.error("DB cible :", cfg.host, cfg.port, cfg.database, "ssl=", cfg.useSsl);
  });

module.exports = pool;
