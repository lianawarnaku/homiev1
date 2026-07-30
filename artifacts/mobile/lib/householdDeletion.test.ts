import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const context = readFileSync(
  resolve(process.cwd(), "context/AppContext.tsx"),
  "utf8",
);
const settings = readFileSync(
  resolve(process.cwd(), "app/settings.tsx"),
  "utf8",
);
const actionMenu = readFileSync(
  resolve(process.cwd(), "components/ActionMenuModal.tsx"),
  "utf8",
);
const migration = readFileSync(
  resolve(
    process.cwd(),
    "../../supabase/migrations/202607300005_sole_owner_household_delete.sql",
  ),
  "utf8",
);

assert(
  context.includes('supabase.rpc("delete_household"') &&
    !context.includes('.from("households")\n      .delete({ count: "exact" })'),
  "household deletion must use the transactional owner-authorized RPC",
);
assert(
  migration.includes("role = 'owner'") &&
    migration.includes("status = 'active'") &&
    migration.indexOf("status = 'active'") <
      migration.indexOf("delete from public.households"),
  "the RPC must authorize the active owner before deleting the household",
);
assert(
  migration.includes("if not found then") &&
    migration.includes("grant execute on function public.delete_household(uuid) to authenticated"),
  "the RPC must reject missing households and expose only authenticated execution",
);
assert(
  context.includes("AsyncStorage.removeItem(activeSweetKey(userId))") &&
    context.includes("sweetStateKey(userId, deletedHouseholdId)") &&
    context.includes("privateBorrowStateKey(userId, deletedHouseholdId)") &&
    context.includes("delete sweetDataCacheRef.current[deletedHouseholdId]"),
  "sole-household deletion must clear active and household-scoped caches",
);
assert(
  context.includes("remainingMemberships[0]") &&
    context.includes("switchSweet(remainingMemberships[0].sweetId)") &&
    context.includes("setMemberships([])"),
  "post-delete state must select another household or clear memberships",
);
assert(
  settings.includes("<ActionMenuModal") &&
    settings.includes("performDeleteHousehold") &&
    settings.includes("Delete permanently") &&
    !settings.includes('"Delete household?",'),
  "Settings must use the shared app-styled confirmation with a guarded async action",
);
assert(
  actionMenu.includes("await confirming.onPress()") &&
    actionMenu.includes("setActionError(") &&
    actionMenu.includes("disabled={running}"),
  "the shared destructive confirmation must stay guarded and show errors for failed async actions",
);
