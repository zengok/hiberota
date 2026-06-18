import net from "node:net";

const PRIVATE_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
const METADATA_IPV4 = new Set(["169.254.169.254"]);

function ipv4Parts(hostname) {
  if (net.isIP(hostname) !== 4) return null;
  const parts = hostname.split(".").map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? parts : null;
}

function isPrivateIPv4(hostname) {
  const parts = ipv4Parts(hostname);
  if (!parts) return false;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function normalizedIPv6(hostname) {
  return hostname.replace(/^\[|\]$/g, "").toLocaleLowerCase("en-US");
}

function isPrivateIPv6(hostname) {
  const value = normalizedIPv6(hostname);
  if (net.isIP(value) !== 6) return false;
  return (
    value === "::" ||
    value === "::1" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    value.startsWith("fe8") ||
    value.startsWith("fe9") ||
    value.startsWith("fea") ||
    value.startsWith("feb") ||
    value.includes(":ffff:127.") ||
    value.includes(":ffff:10.") ||
    value.includes(":ffff:192.168.") ||
    value.includes(":ffff:169.254.")
  );
}

export function validateUrlSafety(value, { allowedProtocols = ["http:", "https:"] } = {}) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return { safe: false, reason: "invalid_url" };
  }

  if (!allowedProtocols.includes(url.protocol)) return { safe: false, reason: "unsupported_protocol" };

  const hostname = decodeURIComponent(url.hostname || "").toLocaleLowerCase("en-US");
  if (!hostname) return { safe: false, reason: "missing_hostname" };
  if (PRIVATE_HOSTS.has(hostname)) return { safe: false, reason: "private_host" };
  if (METADATA_IPV4.has(hostname)) return { safe: false, reason: "metadata_endpoint" };
  if (isPrivateIPv4(hostname)) return { safe: false, reason: "private_ipv4" };
  if (isPrivateIPv6(hostname)) return { safe: false, reason: "private_ipv6" };

  return { safe: true, url };
}

export function isSafeUrl(value, options = {}) {
  return validateUrlSafety(value, options).safe;
}
