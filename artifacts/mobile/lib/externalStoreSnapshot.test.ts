import { createExternalStoreSnapshotCache } from "./externalStoreSnapshot.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const defaults = { enabled: false };
const cache = createExternalStoreSnapshotCache(defaults);

assert(
  cache.get(null) === cache.get(null),
  "anonymous snapshots must remain stable",
);
assert(
  cache.get("user") === cache.get("user"),
  "unloaded user snapshots must remain stable",
);

const loaded = cache.publish("user", true, defaults);
assert(cache.get("user") === loaded, "published snapshots must be readable");
assert(
  cache.publish("user", true, defaults) === loaded,
  "equivalent publishes must preserve the snapshot reference",
);

const updatedPreferences = { enabled: true };
const updated = cache.publish("user", true, updatedPreferences);
assert(updated !== loaded, "real updates must produce a new snapshot");
assert(cache.get("user") === updated, "updated snapshots must be readable");

cache.remove("user");
assert(cache.get("user").loaded === false, "removed users must become unloaded");
