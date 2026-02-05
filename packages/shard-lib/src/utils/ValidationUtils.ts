/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
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
