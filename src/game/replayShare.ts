import type { Replay } from "./replay";

/**
 * Shareable replay links (plan T12): the replay as JSON, deflate-compressed and base64url-encoded
 * into the URL fragment (`#replay=...`). The fragment never reaches a server.
 */
export const REPLAY_HASH_KEY = "replay";

async function pipe(
  bytes: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream
): Promise<Uint8Array<ArrayBuffer>> {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** A replay as a compact URL-safe string. */
export async function encodeReplay(replay: Replay): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(replay));
  return toBase64Url(await pipe(json, new CompressionStream("deflate-raw")));
}

/** The replay in a string made by encodeReplay. Throws if it is not one. */
export async function decodeReplay(code: string): Promise<Replay> {
  const json = await pipe(fromBase64Url(code), new DecompressionStream("deflate-raw"));
  const replay = JSON.parse(new TextDecoder().decode(json)) as Replay;
  if (replay.format !== "pacman-replay" || replay.version !== 1) {
    throw new Error("Not a pacman-replay v1 link");
  }
  return replay;
}

/** A link to this page that opens the replay. */
export async function replayLink(replay: Replay, base: string): Promise<string> {
  return `${base.split("#")[0]}#${REPLAY_HASH_KEY}=${await encodeReplay(replay)}`;
}

/** The replay code in a URL fragment (`#replay=...`), or null. */
export function replayCodeFromHash(hash: string): string | null {
  const match = new RegExp(`^#?${REPLAY_HASH_KEY}=([A-Za-z0-9_-]+)$`).exec(hash);
  return match ? match[1] : null;
}
