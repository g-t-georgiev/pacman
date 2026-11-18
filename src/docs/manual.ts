import { Marked, type Tokens } from "marked";
import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";
import javascript from "highlight.js/lib/languages/javascript";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import yaml from "highlight.js/lib/languages/yaml";
import { docsHash } from "./route";

hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("yaml", yaml);

/**
 * The manual (plan DOC1): one Markdown file per chapter in `docs/manual/`, bundled as text so it
 * works offline and in the build. Files are named `NN-slug.md`; NN orders the chapters and the
 * slug names them in links (`#docs/<slug>` or `#docs/<slug>/<section>`). The same files read well
 * on GitHub: chapters link to each other as `./NN-slug.md#section`, and the page rewrites those.
 */
const files = import.meta.glob<string>("../../docs/manual/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

export interface ManualSection {
  /** Heading anchor (GitHub style), "" for the text before the first section heading. */
  anchor: string;
  title: string;
  depth: number;
  /** Plain text of the section, for search. */
  text: string;
}

export interface ManualChapter {
  slug: string;
  /** The file name, e.g. `03-architecture.md`. */
  file: string;
  title: string;
  markdown: string;
  sections: ManualSection[];
}

/** File name to chapter slug: `03-architecture.md` → `architecture`. */
export function slugOfFile(file: string): string {
  return file.replace(/^.*\//, "").replace(/\.md$/, "").replace(/^\d+-/, "");
}

/** GitHub's heading anchors: lowercase, punctuation dropped, spaces to hyphens. */
export function headingAnchor(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

/** Markdown inline syntax removed, for titles and search text. */
function plain(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*/g, ""))
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>|#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Splits a chapter into its sections (## and ###), with unique anchors as GitHub makes them. */
function sectionsOf(markdown: string): ManualSection[] {
  const sections: ManualSection[] = [];
  const used = new Map<string, number>();
  let current: ManualSection = { anchor: "", title: "", depth: 1, text: "" };
  let body: string[] = [];
  let inFence = false;
  const close = () => {
    current.text = plain(body.join("\n"));
    sections.push(current);
    body = [];
  };
  for (const line of markdown.split("\n")) {
    if (line.startsWith("```")) inFence = !inFence;
    const m = !inFence && /^(#{1,4})\s+(.*)$/.exec(line);
    if (m) {
      const title = plain(m[2]);
      let anchor = headingAnchor(title);
      const n = used.get(anchor) ?? 0;
      used.set(anchor, n + 1);
      if (n > 0) anchor += `-${n}`;
      if (m[1].length === 1) {
        current.title = title;
        current.anchor = "";
        continue;
      }
      close();
      current = { anchor, title, depth: m[1].length, text: "" };
    } else {
      body.push(line);
    }
  }
  close();
  return sections;
}

/** A chapter from its file name and text (also used by the manual's tests, reading from disk). */
export function parseChapter(path: string, markdown: string): ManualChapter {
  const sections = sectionsOf(markdown);
  const file = path.replace(/^.*\//, "");
  return {
    slug: slugOfFile(file),
    file,
    title: sections[0]?.title || slugOfFile(file),
    markdown,
    sections,
  };
}

export const CHAPTERS: ManualChapter[] = Object.keys(files)
  .sort()
  .map((path) => parseChapter(path, files[path]));

export function chapterBySlug(slug: string): ManualChapter | undefined {
  return CHAPTERS.find((c) => c.slug === slug);
}

/** The element id of a section anchor on the page (prefixed: no clash with the app's ids). */
export const anchorId = (anchor: string) => `docs-${anchor}`;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Renders a chapter to HTML: headings get anchors, links between chapters become docs links,
 * links to source files show the path (the page has no file browser), code is highlighted.
 */
export function renderChapter(chapter: ManualChapter): string {
  const used = new Map<string, number>();
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth, text }: Tokens.Heading) {
        const html = this.parser.parseInline(tokens);
        // From the Markdown text, as the section index does (the HTML has escaped quotes)
        let anchor = headingAnchor(plain(text));
        const n = used.get(anchor) ?? 0;
        used.set(anchor, n + 1);
        if (n > 0) anchor += `-${n}`;
        if (depth === 1) return `<h1>${html}</h1>\n`;
        const href = docsHash({ chapter: chapter.slug, anchor });
        return `<h${depth} id="${anchorId(anchor)}"><a class="docs-anchor" href="${href}" aria-hidden="true">#</a>${html}</h${depth}>\n`;
      },
      link({ href, title, tokens }: Tokens.Link) {
        const text = this.parser.parseInline(tokens);
        const t = title ? ` title="${escapeHtml(title)}"` : "";
        if (/^https?:\/\//.test(href)) {
          return `<a href="${escapeHtml(href)}"${t} target="_blank" rel="noopener noreferrer">${text}</a>`;
        }
        // Same chapter (#section), another chapter (./NN-slug.md#section)
        const m = /^(?:\.\/)?(?:([\w-]+)\.md)?(?:#(.*))?$/.exec(href);
        if (m && (m[1] || m[2])) {
          const target = m[1] ? slugOfFile(m[1]) : chapter.slug;
          if (chapterBySlug(target)) {
            return `<a href="${docsHash({ chapter: target, anchor: m[2] ?? null })}"${t}>${text}</a>`;
          }
        }
        // A file in the repository (../../src/game/GameEngine.ts): shown with its path
        const path = href.replace(/^(\.\.\/)+/, "").replace(/#L(\d+)$/, ":$1");
        return `<span class="docs-src" title="${escapeHtml(path)}">${text}</span>`;
      },
      code({ text, lang }: Tokens.Code) {
        // The first word names the language ("js run" marks a recipe the tests run)
        const first = lang?.split(/\s/)[0];
        const language = first && hljs.getLanguage(first) ? first : null;
        const html = language ? hljs.highlight(text, { language }).value : escapeHtml(text);
        return `<pre><code class="hljs${language ? ` language-${language}` : ""}">${html}</code></pre>\n`;
      },
    },
  });
  return marked.parse(chapter.markdown, { async: false });
}

export interface SearchHit {
  chapter: ManualChapter;
  section: ManualSection;
  snippet: string;
}

/** Sections whose title or text has every word of the query (titles first). */
export function searchManual(query: string, limit = 30): SearchHit[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const hits: Array<SearchHit & { score: number }> = [];
  for (const chapter of CHAPTERS) {
    for (const section of chapter.sections) {
      const title = section.title.toLowerCase();
      const text = section.text.toLowerCase();
      if (!words.every((w) => title.includes(w) || text.includes(w))) continue;
      const score = words.filter((w) => title.includes(w)).length;
      const at = Math.max(0, text.indexOf(words[0]));
      const start = Math.max(0, at - 50);
      const snippet =
        (start > 0 ? "…" : "") +
        section.text.slice(start, start + 140) +
        (start + 140 < section.text.length ? "…" : "");
      hits.push({ chapter, section, snippet, score });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}
