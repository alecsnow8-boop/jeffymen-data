// Which players the site will ever need names for, and the smallest record that names them.
export function collectPlayerIds(archives, extra = []) {
  const ids = new Set();
  for (const a of archives ?? []) {
    for (const r of a?.rosters ?? []) for (const id of r.players ?? []) ids.add(String(id));
    for (const rows of Object.values(a?.weeks ?? {})) {
      for (const row of rows) {
        for (const id of row.starters ?? []) ids.add(String(id));
        for (const id of Object.keys(row.playersPoints ?? {})) ids.add(String(id));
      }
    }
    for (const p of a?.draft?.picks ?? []) ids.add(String(p.playerId));
  }
  for (const list of extra) for (const id of list ?? []) ids.add(String(id));
  return [...ids].filter((id) => id && id !== "0").sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
}

export function slimPlayers(all, ids) {
  const out = {};
  for (const id of ids) {
    const p = all?.[id];
    if (!p || typeof p !== "object") continue;
    const name =
      (typeof p.full_name === "string" && p.full_name) ||
      [p.first_name, p.last_name].filter((x) => typeof x === "string" && x).join(" ") ||
      id;
    out[id] = { n: name, pos: typeof p.position === "string" ? p.position : "?", t: typeof p.team === "string" ? p.team : null };
  }
  return out;
}
