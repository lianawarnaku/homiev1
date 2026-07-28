import { choreCompletionTransition } from "./choreCompletion.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const completion = choreCompletionTransition(false, true, 15);
assert(completion.changed, "an incomplete chore must transition to completed");
assert(completion.pointsDelta === 15, "completion must award the chore points once");

const repeatedCompletion = choreCompletionTransition(true, true, 15);
assert(!repeatedCompletion.changed, "repeating the same completion intent must be idempotent");
assert(repeatedCompletion.pointsDelta === 0, "repeating completion must not award points again");

const undo = choreCompletionTransition(true, false, 15);
assert(undo.changed, "an explicit undo must transition the chore");
assert(undo.pointsDelta === -15, "an explicit undo must reverse the original points");
