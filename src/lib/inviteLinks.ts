/**
 * Deep link parsing for Dormie invite URLs.
 *
 * Supports:
 * - dormie://trip-invite/ABCDEF  (custom scheme, for share sheet)
 *
 * Future:
 * - https://dormie.app/trip-invite/ABCDEF  (universal link, requires applinks: config)
 */

export type ParsedInvite = { type: 'trip-invite'; code: string };

/** Parse a URL into an invite action, or null if not an invite link. */
export function parseInviteUrl(url: string): ParsedInvite | null {
  // dormie://trip-invite/ABCDEF
  const customScheme = url.match(/dormie:\/\/trip-invite\/([A-Z0-9]{6})/i);
  if (customScheme) {
    return { type: 'trip-invite', code: customScheme[1].toUpperCase() };
  }

  // https://dormie.app/trip-invite/ABCDEF (future universal link)
  const universalLink = url.match(/dormie\.app\/trip-invite\/([A-Z0-9]{6})/i);
  if (universalLink) {
    return { type: 'trip-invite', code: universalLink[1].toUpperCase() };
  }

  return null;
}

/** Build a shareable invite URL from a code. */
export function getInviteUrl(code: string): string {
  return `dormie://trip-invite/${code}`;
}
