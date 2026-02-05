export function splitIntoTwo(
  str: string,
  sep: string,
): [string] | [string, string] {
  const slashIdx = str.indexOf(sep);
  return slashIdx == -1
    ? [str]
    : [str.slice(0, slashIdx), str.slice(slashIdx + 1)];
}
