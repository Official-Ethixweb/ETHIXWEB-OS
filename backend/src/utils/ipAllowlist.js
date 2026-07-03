function normalizeIp(ip) {
  return typeof ip === 'string' && ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

function ipToLong(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  return parts.reduce((acc, octet) => {
    const n = Number(octet);
    if (!Number.isInteger(n) || n < 0 || n > 255) throw new Error('invalid octet');
    return (acc << 8) + n;
  }, 0) >>> 0;
}

function matchesEntry(ip, entry) {
  if (!entry.includes('/')) return ip === entry;
  const [range, bitsStr] = entry.split('/');
  const bits = Number(bitsStr);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  try {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (ipToLong(ip) & mask) === (ipToLong(range) & mask);
  } catch {
    return false;
  }
}

// IPv4-only exact/CIDR matcher — sufficient for the common case of allowlisting
// an office/VPN egress IP or range. Returns true if `allowlist` is empty
// (feature disabled) or `ip` matches any entry.
function isIpAllowed(ip, allowlist) {
  if (!allowlist || allowlist.length === 0) return true;
  const normalized = normalizeIp(ip);
  return allowlist.some((entry) => {
    try {
      return matchesEntry(normalized, entry);
    } catch {
      return false;
    }
  });
}

module.exports = { isIpAllowed, normalizeIp };
