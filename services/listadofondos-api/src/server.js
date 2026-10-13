import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { createDataService } from "./dataService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../../..");
const CONFIG_PATH = process.env.CONFIG_PATH
  ? path.resolve(process.env.CONFIG_PATH)
  : path.resolve(ROOT_DIR, "apps/listadofondos/config/fondos.yaml");
const CACHE_DIR = process.env.CACHE_DIR
  ? path.resolve(process.env.CACHE_DIR)
  : path.resolve(__dirname, "../cache");
const CACHE_FILE = path.join(CACHE_DIR, "data.json");

const dataService = createDataService({ configPath: CONFIG_PATH, cacheFile: CACHE_FILE, fetchHtml });
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

// SSRF Protection: Whitelist of allowed domains
const ALLOWED_DOMAINS = [
  'morningstar.com',
  'lt.morningstar.com',
  'www.morningstar.com'
];

// SSRF Protection: Validate URL before fetching
function validateUrl(urlString) {
  let parsed;

  try {
    parsed = new URL(urlString);
  } catch (err) {
    throw new Error('Invalid URL format');
  }

  // Only allow HTTP and HTTPS protocols
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Protocol not allowed: ${parsed.protocol}`);
  }

  // Check if domain is in whitelist
  const hostname = parsed.hostname.toLowerCase();
  const isAllowed = ALLOWED_DOMAINS.some(domain =>
    hostname === domain || hostname.endsWith(`.${domain}`)
  );

  if (!isAllowed) {
    throw new Error(`Domain not allowed: ${hostname}`);
  }

  // Prevent access to private IP ranges
  const privateIpPatterns = [
    /^127\./,           // Loopback
    /^10\./,            // Private class A
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // Private class B
    /^192\.168\./,      // Private class C
    /^169\.254\./,      // Link-local
    /^::1$/,            // IPv6 loopback
    /^fc00:/,           // IPv6 private
    /^fe80:/,           // IPv6 link-local
    /^localhost$/i,     // localhost
  ];

  for (const pattern of privateIpPatterns) {
    if (pattern.test(hostname)) {
      throw new Error(`Access to private IP/hostname not allowed: ${hostname}`);
    }
  }

  return parsed.href;
}

async function fetchHtml(url) {
  // Validate URL for SSRF protection
  const validatedUrl = validateUrl(url);

  const response = await fetch(validatedUrl, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Request failed ${response.status}`);
  return await response.text();
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    // Updating states and errors must never be reused by browser/proxy caches.
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // Max requests per window
const RATE_LIMIT_MAX_BODY_SIZE = 1024 * 10; // 10KB max body size

// Rate limiting storage: Map of IP -> { count, windowStart }
const rateLimitStore = new Map();

function getClientIp(req) {
  // Check X-Forwarded-For header (set by proxy)
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  // Check X-Real-IP header
  const realIp = req.headers["x-real-ip"];
  if (realIp) {
    return realIp;
  }
  // Fallback to remote address
  return req.socket.remoteAddress;
}

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  const timeSinceWindowStart = now - record.windowStart;

  if (timeSinceWindowStart > RATE_LIMIT_WINDOW_MS) {
    // New window
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    const resetIn = RATE_LIMIT_WINDOW_MS - timeSinceWindowStart;
    return { allowed: false, remaining: 0, resetIn };
  }

  record.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - record.count };
}

export function createApiServer(service = dataService) {
  const server = http.createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      // Apply rate limiting
      const clientIp = getClientIp(req);
      const rateLimit = checkRateLimit(clientIp);

      // Add rate limit headers
      res.setHeader("X-RateLimit-Limit", RATE_LIMIT_MAX_REQUESTS);
      res.setHeader("X-RateLimit-Remaining", rateLimit.remaining);

      if (!rateLimit.allowed) {
        res.setHeader("X-RateLimit-Reset", Math.ceil(rateLimit.resetIn / 1000));
        res.writeHead(429, {
          "Content-Type": "application/json; charset=utf-8",
          "Retry-After": Math.ceil(rateLimit.resetIn / 1000),
        });
        res.end(JSON.stringify({
          message: "Too many requests, please try again later",
          retryAfter: Math.ceil(rateLimit.resetIn / 1000),
        }));
        return;
      }

      if (req.method === "GET" && req.url === "/listadofondos/api/data") {
        const data = await service.getData();
        sendJson(res, 200, data);
        return;
      }
      if (req.method === "POST" && req.url === "/listadofondos/api/refresh") {
        // Validate request body size
        let bodySize = 0;
        await new Promise((resolve, reject) => {
          req.on("data", (chunk) => {
            bodySize += chunk.length;
            if (bodySize > RATE_LIMIT_MAX_BODY_SIZE) {
              reject(new Error("Request body too large"));
            }
          });
          req.on("end", resolve);
          req.on("error", reject);
        });
        const data = await service.startRefresh();
        sendJson(res, 200, data);
        return;
      }
      if (req.method === "GET" && req.url === "/listadofondos/api/health") {
        sendJson(res, 200, { status: "ok" });
        return;
      }
      sendJson(res, 404, { message: "Not found" });
    } catch (err) {
      console.error(err);
      if (err.message === "Request body too large") {
        res.writeHead(413, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ message: "Request body too large" }));
        return;
      }
      sendJson(res, 500, { message: "Internal server error" });
    }
  });

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of rateLimitStore) {
      if (now - record.windowStart > RATE_LIMIT_WINDOW_MS * 2) rateLimitStore.delete(ip);
    }
  }, 5 * 60 * 1000);
  cleanup.unref();
  server.on("close", () => clearInterval(cleanup));
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createApiServer();
  const port = Number(process.env.PORT || 3000);
  server.listen(port, () => {
    console.log(`listadofondos api listening on port ${port}`);
  });

}
