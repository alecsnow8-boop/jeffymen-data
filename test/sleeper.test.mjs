import test from "node:test";
import assert from "node:assert/strict";
import { getJson, getJsonRequired } from "../lib/sleeper.mjs";

const fake = (status, body = null) => () =>
  Promise.resolve(new Response(body === null ? "" : JSON.stringify(body), { status }));

test("getJson returns null on a 404 and the body otherwise", async () => {
  assert.equal(await getJson("/x", { fetchImpl: fake(404), retries: 1 }), null);
  assert.deepEqual(await getJson("/x", { fetchImpl: fake(200, [1]), retries: 1 }), [1]);
});

test("getJsonRequired refuses a 404: a complete league never lacks its sub-resources", async () => {
  await assert.rejects(getJsonRequired("/league/L/users", { fetchImpl: fake(404), retries: 1 }), /404/);
  assert.deepEqual(await getJsonRequired("/league/L/users", { fetchImpl: fake(200, []), retries: 1 }), []);
});
