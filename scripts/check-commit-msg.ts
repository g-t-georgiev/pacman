/// <reference types="node" />
// The commit-msg hook (.vite-hooks/commit-msg): a commit message must say what kind of change
// it is (Conventional Commits), because releases read the version bump from it.
//   feat: ...  fix: ...  docs(manual): ...  refactor!: ...  (see COMMIT_TYPES)
import { readFileSync } from "node:fs";
import { COMMIT_TYPES, isAutomaticMessage, parseMessage } from "./releaseBump";

const file = process.argv.slice(2).find((a) => a !== "--");
if (!file) {
  console.error("usage: check-commit-msg <message file>");
  process.exit(2);
}
const text = readFileSync(file, "utf8")
  .split("\n")
  .filter((line) => !line.startsWith("#"))
  .join("\n")
  .trim();
const [subject = "", ...rest] = text.split("\n");

if (!isAutomaticMessage(subject) && !parseMessage(subject, rest.join("\n"))) {
  console.error(`The commit message must start with a type, like "feat: ..." or "fix(ghosts): ...".
Types: ${Object.keys(COMMIT_TYPES).join(", ")}. Add ! after the type for a breaking change.
Releases read the version bump from it (see the manual, "Releases").
Got: "${subject}"`);
  process.exit(1);
}
