const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// True if the value looks like a UUID. Check this before using an id from a
// URL in a query: Postgres throws (500) on a malformed uuid.
export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}
