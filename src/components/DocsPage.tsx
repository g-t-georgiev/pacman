import React, { useEffect, useMemo, useRef, useState } from "react";
import "../styles/docs.css";
import { CHAPTERS, anchorId, chapterBySlug, renderChapter, searchManual } from "../docs/manual";
import { type DocsRoute, docsHash, openDocs } from "../docs/route";

interface DocsPageProps {
  route: DocsRoute;
  /** Back to the game, which was held exactly where it was. */
  onClose: () => void;
}

/**
 * The manual (plan DOC1): a full page over the game, which is held while it is open (the `docs`
 * pause reason). A chapter list, search, section anchors and deep links (`#docs/replays`).
 * Loaded on demand (the cabinet imports it lazily): the game's bundle doesn't carry the manual.
 */
const DocsPage: React.FC<DocsPageProps> = ({ route, onClose }) => {
  const chapter = chapterBySlug(route.chapter) ?? CHAPTERS[0];
  const html = useMemo(() => (chapter ? renderChapter(chapter) : ""), [chapter]);
  const [query, setQuery] = useState("");
  const hits = useMemo(() => searchManual(query), [query]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLElement>(null);

  /** The chapter's sections listed in the chapter list (## headings). */
  const sectionAnchors = useMemo(
    () => chapter?.sections.filter((s) => s.depth === 2).map((s) => s.anchor) ?? [],
    [chapter]
  );
  /** The section being read: highlighted in the chapter list, and followed while scrolling. */
  const [active, setActive] = useState<string | null>(route.anchor);
  /** The section last opened by a link: at the bottom of the page it stays the active one. */
  const openedRef = useRef<string | null>(route.anchor);

  // A new chapter or section: scroll to it
  useEffect(() => {
    openedRef.current = route.anchor;
    const box = scrollRef.current;
    if (!box) return;
    if (route.anchor) {
      const el = document.getElementById(anchorId(route.anchor));
      if (el) {
        el.scrollIntoView({ block: "start" });
        return;
      }
    }
    box.scrollTop = 0;
  }, [route.chapter, route.anchor, html]);

  // Scroll spy: the active section is the last one whose heading has reached the top of the
  // page (the first one before that). At the very bottom, short last sections can't reach the
  // top: there the section opened by a link stays active if its heading is in view, else the last.
  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const boxTop = box.getBoundingClientRect().top;
      const line = boxTop + 120; // headings land 80 px below the top (scroll-margin-top)
      const top = (a: string) => document.getElementById(anchorId(a))?.getBoundingClientRect().top;
      let current: string | null = sectionAnchors[0] ?? null;
      for (const a of sectionAnchors) {
        const t = top(a);
        if (t === undefined || t > line) break;
        current = a;
      }
      const atBottom =
        box.scrollTop > 0 && box.scrollTop + box.clientHeight >= box.scrollHeight - 2;
      // Scrolled away from the opened section: from now on, plain scrolling decides
      if (!atBottom && current !== openedRef.current) openedRef.current = null;
      if (atBottom) {
        const opened = openedRef.current;
        const openedTop = opened && sectionAnchors.includes(opened) ? top(opened) : undefined;
        current =
          openedTop !== undefined && openedTop >= boxTop
            ? opened
            : (sectionAnchors[sectionAnchors.length - 1] ?? current);
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    box.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      box.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [sectionAnchors, html, route.anchor]);

  // Keep the active section visible in a long chapter list
  useEffect(() => {
    navRef.current
      ?.querySelector('[aria-current="location"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  // The page scrolls, not the game behind it
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, []);

  // Escape: clears the search first, then goes back to the game; "/" focuses the search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (query) setQuery("");
        else onClose();
        e.preventDefault();
      } else if (e.key === "/" && document.activeElement !== searchRef.current) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [query, onClose]);

  const go = (r: DocsRoute) => {
    setQuery("");
    openDocs(r);
  };

  if (!chapter) {
    return (
      <div className="fixed inset-0 z-[60] bg-neutral-950 text-white p-6">
        <p>The manual has no chapters in this build.</p>
        <button onClick={onClose}>Back to the game</button>
      </div>
    );
  }

  const sections = chapter.sections.filter((s) => s.depth === 2);

  return (
    <div
      className="fixed inset-0 z-[60] bg-neutral-950 text-white flex flex-col"
      role="dialog"
      aria-label="Manual"
    >
      {/* Top bar: title, search, back */}
      <header className="flex flex-wrap items-center gap-2 px-3 sm:px-5 py-2.5 border-b border-neutral-800 bg-neutral-900">
        <span className="font-bold tracking-wider text-sm text-yellow-300">📖 MANUAL</span>
        <div className="relative flex-1 min-w-[10rem] max-w-md order-3 sm:order-none w-full sm:w-auto">
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the manual  ( / )"
            aria-label="Search the manual"
            className="w-full px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-700 focus:border-cyan-400 outline-none text-sm"
          />
          {query && (
            <div
              className="absolute left-0 right-0 top-full mt-1 max-h-[60vh] overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-900 shadow-2xl z-10"
              role="listbox"
              aria-label="Search results"
            >
              {hits.length === 0 && (
                <p className="px-3 py-2 text-sm text-neutral-400">Nothing found.</p>
              )}
              {hits.map((h) => (
                <button
                  key={`${h.chapter.slug}/${h.section.anchor}`}
                  role="option"
                  aria-selected={false}
                  onClick={() => go({ chapter: h.chapter.slug, anchor: h.section.anchor || null })}
                  className="docs-hit block w-full text-left px-3 py-2 hover:bg-neutral-800 border-b border-neutral-800 last:border-0"
                >
                  <span className="block text-xs text-cyan-300">
                    {h.chapter.title}
                    {h.section.title && h.section.depth > 1 ? ` › ${h.section.title}` : ""}
                  </span>
                  <span className="block text-xs text-neutral-400">{h.snippet}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="ml-auto px-3 py-1.5 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-sm cursor-pointer"
        >
          ◀ Back to the game
        </button>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Chapter list (wide screens) */}
        <nav
          ref={navRef}
          className="hidden md:block w-64 shrink-0 overflow-y-auto border-r border-neutral-800 py-3 text-sm"
          aria-label="Chapters"
        >
          {CHAPTERS.map((c) => {
            const current = c.slug === chapter.slug;
            return (
              <div key={c.slug}>
                <a
                  href={docsHash({ chapter: c.slug, anchor: null })}
                  onClick={() => setQuery("")}
                  aria-current={current ? "page" : undefined}
                  className={`block px-4 py-1.5 ${
                    current
                      ? "text-yellow-300 font-bold bg-neutral-900"
                      : "text-neutral-300 hover:text-white"
                  }`}
                >
                  {c.title}
                </a>
                {current &&
                  sections.map((s) => (
                    <a
                      key={s.anchor}
                      href={docsHash({ chapter: c.slug, anchor: s.anchor })}
                      aria-current={active === s.anchor ? "location" : undefined}
                      className={`block pl-7 pr-3 py-1 text-xs ${
                        active === s.anchor
                          ? "text-cyan-300"
                          : "text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      {s.title}
                    </a>
                  ))}
              </div>
            );
          })}
        </nav>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {/* Chapter picker (narrow screens) */}
          <div className="md:hidden px-4 pt-3">
            <select
              value={chapter.slug}
              onChange={(e) => go({ chapter: e.target.value, anchor: null })}
              aria-label="Chapter"
              className="w-full px-2 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-sm"
            >
              {CHAPTERS.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          <article
            className="docs-article px-4 sm:px-8 py-6"
            // The manual is our own Markdown, bundled with the game
            dangerouslySetInnerHTML={{ __html: html }}
          />
          <ChapterFooter slug={chapter.slug} />
        </div>
      </div>
    </div>
  );
};

/** Previous / next chapter. */
const ChapterFooter: React.FC<{ slug: string }> = ({ slug }) => {
  const i = CHAPTERS.findIndex((c) => c.slug === slug);
  const prev = CHAPTERS[i - 1];
  const next = CHAPTERS[i + 1];
  return (
    <div className="flex justify-between gap-4 max-w-[46rem] px-4 sm:px-8 pb-10 text-sm">
      {prev ? (
        <a href={docsHash({ chapter: prev.slug, anchor: null })} className="text-cyan-300">
          ◀ {prev.title}
        </a>
      ) : (
        <span />
      )}
      {next && (
        <a href={docsHash({ chapter: next.slug, anchor: null })} className="text-cyan-300">
          {next.title} ▶
        </a>
      )}
    </div>
  );
};

export default DocsPage;
