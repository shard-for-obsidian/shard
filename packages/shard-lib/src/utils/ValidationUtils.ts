/**
 * Splits a string into two parts on the first occurrence of a separator.
 * Returns a tuple of one or two strings.
 */
export function splitIntoTwo(
  str: string,
  sep: string,
): [string] | [string, string] {
  const slashIdx = str.indexOf(sep);
  return slashIdx == -1
    ? [str]
    : [str.slice(0, slashIdx), str.slice(slashIdx + 1)];
}

/**
 * Returns true if the host is localhost or a loopback address.
 */
export function isLocalhost(host: string): boolean {
  const lead = host.split(":")[0];
  if (lead === "localhost" || lead === "127.0.0.1" || host.includes("::1")) {
    return true;
  } else {
    return false;
  }
}
