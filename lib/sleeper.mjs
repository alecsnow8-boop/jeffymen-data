// One tiny fetch helper. Sleeper's public API needs no key; be polite about it.
export const BASE = "https://api.sleeper.app/v1";
const UA = "jeffymen-data (github.com/alecsnow8-boop/jeffymen-data)";

export async function getJson(path, { retries = 3, fetchImpl = fetch } = {}) {
  let lastError;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetchImpl(`${BASE}${path}`, { headers: { "user-agent": UA } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Sleeper ${path} responded ${res.status}`);
      return await res.json();
    } catch (e) {
      lastError = e;
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  throw lastError;
}

/** Same, but a 404 is an error: a league that exists never lacks its users, rosters, weeks or brackets. */
export async function getJsonRequired(path, opts) {
  const data = await getJson(path, opts);
  if (data === null) throw new Error(`Sleeper ${path} responded 404`);
  return data;
}
