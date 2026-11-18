/// <reference types="node" />
// Shared by update-golden.ts and check-golden.ts: when the rules or state versions must change.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const ROOT = join(import.meta.dirname, "..");
export const GOLDEN_DIR = join(ROOT, "tests", "golden");

/**
 * The shape of a saved state: every key path, with array positions collapsed ("ghosts.BLINKY.x",
 * "maze.tiles[]"). Values don't matter, so two states of one build always share a shape; a field
 * added, removed or renamed changes it (a GAME_STATE_VERSION bump).
 */
export function shapeOf(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) {
    return value.length > 0 ? shapeOf(value[0], `${path}[]`) : [`${path}[]`];
  }
  if (value !== null && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .flatMap((key) =>
        shapeOf((value as Record<string, unknown>)[key], path ? `${path}.${key}` : key)
      );
  }
  return [path];
}

export const sameShape = (a: unknown, b: unknown) =>
  shapeOf(a).join("\n") === shapeOf(b).join("\n");

/**
 * Raises `export const NAME = N;` in `file` (relative to the repo root) by one; returns the new
 * value. The constant must appear exactly once in that form.
 */
export function bumpConstant(file: string, name: string): number {
  const path = join(ROOT, file);
  const source = readFileSync(path, "utf8");
  const pattern = new RegExp(`export const ${name} = ([0-9]+);`);
  const match = source.match(pattern);
  if (!match) throw new Error(`${name} not found as "export const ${name} = N;" in ${file}`);
  const next = Number(match[1]) + 1;
  writeFileSync(path, source.replace(pattern, `export const ${name} = ${next};`));
  return next;
}
