interface Ipv4Cidr {
  network: number;
  mask: number;
}

function parseIpv4(address: string): number | undefined {
  const octets = address.split(".");
  if (
    octets.length !== 4 ||
    octets.some((octet) => !/^(0|[1-9]\d{0,2})$/.test(octet) || Number(octet) > 255)
  ) {
    return undefined;
  }

  const [a, b, c, d] = octets.map(Number);
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

function parseExactOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid CORS origin: ${value}`);
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(`Invalid CORS origin: ${value}`);
  }

  return url.origin;
}

function parseCidr(value: string): Ipv4Cidr {
  const [address, prefixText, extra] = value.split("/");
  const ip = parseIpv4(address);
  const prefix = Number(prefixText);
  if (
    extra !== undefined ||
    ip === undefined ||
    !/^(0|[1-9]\d?)$/.test(prefixText ?? "") ||
    prefix > 32
  ) {
    throw new Error(`Invalid CORS IPv4 CIDR: ${value}`);
  }

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return { network: ip & mask, mask };
}

function parseList<T>(value: string | undefined, parseEntry: (entry: string) => T): T[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(parseEntry);
}

export function createCorsOriginValidator(
  configuredOrigins: string | undefined,
  configuredCidrs: string | undefined,
): (origin: string | undefined) => boolean {
  const exactOrigins = new Set(
    parseList(configuredOrigins, parseExactOrigin),
  );
  const cidrs = parseList(configuredCidrs, parseCidr);

  return (origin) => {
    if (!origin) return true;

    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      return false;
    }

    if (
      url.origin !== origin ||
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      return false;
    }

    if (exactOrigins.has(url.origin)) return true;
    if (url.protocol !== "http:" || url.port !== "") return false;

    const ip = parseIpv4(url.hostname);
    return ip !== undefined && cidrs.some(({ network, mask }) => (ip & mask) === network);
  };
}
