/**
 * Requêtes HTTPS vers Google (contourne fetch + erreurs certificat Windows en local).
 * En production, laisser GOOGLE_OAUTH_RELAX_TLS vide.
 */
const https = require("https");

function useRelaxedTls() {
  return (
    process.env.GOOGLE_OAUTH_RELAX_TLS === "1" ||
    (process.env.NODE_ENV !== "production" &&
      process.env.GOOGLE_OAUTH_RELAX_TLS !== "0")
  );
}

function httpsRequest(url, { method = "GET", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body != null ? String(body) : null;
    const opts = {
      hostname: u.hostname,
      port: u.port || 443,
      path: `${u.pathname}${u.search}`,
      method,
      headers: { ...headers },
      agent: useRelaxedTls()
        ? new https.Agent({ rejectUnauthorized: false, keepAlive: true })
        : undefined,
    };

    if (payload) {
      opts.headers["Content-Length"] = Buffer.byteLength(payload);
    }

    const req = https.request(opts, (res) => {
      let raw = "";
      res.on("data", (chunk) => {
        raw += chunk;
      });
      res.on("end", () => {
        let data = {};
        if (raw) {
          try {
            data = JSON.parse(raw);
          } catch {
            data = { raw };
          }
        }
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          data,
        });
      });
    });

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function googleHttpsPostForm(url, params) {
  const body = new URLSearchParams(params).toString();
  return httpsRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

async function googleHttpsGetJson(url) {
  return httpsRequest(url, { method: "GET" });
}

module.exports = { googleHttpsPostForm, googleHttpsGetJson, useRelaxedTls };
