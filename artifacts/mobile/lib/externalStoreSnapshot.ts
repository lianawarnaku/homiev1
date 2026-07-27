export type ExternalStoreSnapshot<T> = {
  loaded: boolean;
  preferences: T;
};

/**
 * Keeps useSyncExternalStore snapshots referentially stable between actual
 * store updates. React treats a new snapshot reference as a changed store.
 */
export function createExternalStoreSnapshotCache<T>(defaultValue: T) {
  const snapshots = new Map<string, ExternalStoreSnapshot<T>>();
  const anonymousSnapshot: ExternalStoreSnapshot<T> = {
    loaded: true,
    preferences: defaultValue,
  };

  return {
    get(key: string | null) {
      if (!key) return anonymousSnapshot;
      const current = snapshots.get(key);
      if (current) return current;
      const unloaded = { loaded: false, preferences: defaultValue };
      snapshots.set(key, unloaded);
      return unloaded;
    },
    publish(key: string, loaded: boolean, value: T) {
      const current = snapshots.get(key);
      if (
        current &&
        current.loaded === loaded &&
        Object.is(current.preferences, value)
      ) {
        return current;
      }
      const next = { loaded, preferences: value };
      snapshots.set(key, next);
      return next;
    },
    remove(key: string) {
      snapshots.delete(key);
    },
  };
}
