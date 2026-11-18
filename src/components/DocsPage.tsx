import React, { useEffect, useMemo, useRef, useState } from "react";
import "../styles/docs.css";
import {
  CHAPTERS,
  type ManualChapter,
  anchorId,
  chapterBySlug,
  renderChapter,
  searchManual,
} from "../docs/manual";
import { type DocsRoute, docsHash } from "../docs/route";
import { APP_VERSION_LABEL, VERSIONS } from "../version";

interface DocsPageProps {
  route: DocsRoute;
  /** Back to the game, which was held exactly where it was. */
  onClose: () => void;
}

/**
 * The manual (plan DOC1): a full page over the game, which is held while it is open (the `docs`
 * pause reason). A chapter list (a side panel on wide screens, a slide-in drawer behind ☰ on
 * narrow ones) that follows the section being read, search, section anchors and deep links
 * (`#docs/replays`). Loaded on demand (the cabinet imports it lazily): the game's bundle doesn't
 * carry the manual.
 */
const DocsPage: React.FC<DocsPageProps> = ({ route, onClose }) => {
  const chapter = chapterBySlug(route.chapter) ?? CHAPTERS[0];
  const html = useMemo(() => (chapter ? renderChapter(chapter) : ""), [chapter]);
  const [query, setQuery] = useState("");
  const hits = useMemo(() => searchManual(query), [query]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const sideNavRef = useRef<HTMLElement>(null);
  const drawerNavRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  /** The chapter drawer (narrow screens) is open. */
  const [drawer, setDrawer] = useState(false);

  /** The chapter's sections listed in the chapter list (## headings). */
  const sectionAnchors = useMemo(
    () => chapter?.sections.filter((s) => s.depth === 2).map((s) => s.anchor) ?? [],
    [chapter]
  );
  /** The section being read: highlighted in the chapter list, and followed while scrolling. */
  const [active, setActive] = useState<string | null>(route.anchor);
  /** The section last opened by a link: at the bottom of the page it stays the active one. */
  const openedRef = useRef<string | null>(route.anchor);

  /** Shows a route's section (or the chapter's top) in the content. */
  const scrollTo = (anchor: string | null) => {
    const box = scrollRef.current;
    if (!box) return;
    const el = anchor ? document.getElementById(anchorId(anchor)) : null;
    if (el) el.scrollIntoView({ block: "start" });
    else box.scrollTop = 0;
  };

  // A new chapter or section: scroll to it
  useEffect(() => {
    openedRef.current = route.anchor;
    scrollTo(route.anchor);
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

  // Keep the active section visible in the side panel's list
  useEffect(() => {
    sideNavRef.current
      ?.querySelector('[aria-current="location"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  // Opening the drawer shows where you are: the active section (or the chapter) in view, focused
  useEffect(() => {
    if (!drawer) return;
    const nav = drawerNavRef.current;
    const here =
      nav?.querySelector<HTMLElement>('[aria-current="location"]') ??
      nav?.querySelector<HTMLElement>('[aria-current="page"]');
    here?.scrollIntoView({ block: "center" });
    here?.focus({ preventScroll: true });
  }, [drawer]);

  // The page scrolls, not the game behind it
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, []);

  /** Said to screen readers after a copy ("Copied", or why not). */
  const [copyStatus, setCopyStatus] = useState("");

  /** A code block's copy button (the chapter's HTML has them; one listener serves them all). */
  const onArticleClick = (e: React.MouseEvent) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>(".docs-copy");
    if (!button) return;
    const code = button.parentElement?.querySelector("pre code")?.textContent ?? "";
    void copyText(code).then((ok) => {
      button.classList.toggle("copied", ok);
      button.setAttribute("aria-label", ok ? "Copied" : "Copy code");
      button.title = ok ? "Copied" : "Couldn't copy: select the code instead";
      setCopyStatus(ok ? "Copied to the clipboard" : "Couldn't copy");
      window.setTimeout(() => {
        button.classList.remove("copied");
        button.setAttribute("aria-label", "Copy code");
        button.title = "Copy";
        setCopyStatus("");
      }, 1500);
    });
  };

  /** Closes the drawer, giving the keyboard back to the ☰ button. */
  const closeDrawer = () => {
    setDrawer(false);
    menuButtonRef.current?.focus({ preventScroll: true });
  };

  // Escape: closes the drawer, else clears the search, else goes back to the game;
  // "/" focuses the search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (drawer) closeDrawer();
        else if (query) setQuery("");
        else onClose();
        e.preventDefault();
      } else if (e.key === "/" && document.activeElement !== searchRef.current) {
        e.preventDefault();
        setDrawer(false);
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [query, onClose, drawer]);

  /**
   * Goes to a chapter or section from a link: marks it at once, closes the drawer and the search,
   * and shows it. Picking the section the URL already names scrolls to it again (no hash change).
   */
  const go = (r: DocsRoute) => {
    setQuery("");
    setDrawer(false);
    if (r.chapter === chapter?.slug) setActive(r.anchor ?? sectionAnchors[0] ?? null);
    openedRef.current = r.anchor;
    const target = docsHash(r);
    if (location.hash === target) scrollTo(r.anchor);
    else location.hash = target;
  };

  if (!chapter) {
    return (
      <div className="fixed inset-0 z-[60] bg-neutral-950 text-white p-6">
        <p>The manual has no chapters in this build.</p>
        <button onClick={onClose}>Back to the game</button>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-neutral-950 text-white flex flex-col"
      role="dialog"
      aria-label="Manual"
    >
      {/* Top bar: chapters (narrow screens), title, search, back */}
      <header className="flex flex-wrap items-center gap-2 px-3 sm:px-5 py-2.5 border-b border-neutral-800 bg-neutral-900">
        <button
          ref={menuButtonRef}
          onClick={() => setDrawer((open) => !open)}
          aria-label="Chapters"
          aria-expanded={drawer}
          aria-controls="docs-drawer"
          className="md:hidden -ml-1 w-9 h-9 flex items-center justify-center rounded-lg text-xl text-neutral-200 hover:bg-neutral-800 cursor-pointer"
        >
          ☰
        </button>
        <span className="font-bold tracking-wider text-sm text-yellow-300">📖 MANUAL</span>
        <span
          className="text-xs text-neutral-500"
          title={`This manual describes the game ${APP_VERSION_LABEL} (rules version ${VERSIONS.rules})`}
        >
          {APP_VERSION_LABEL}
        </span>
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

      <div className="relative flex flex-1 min-h-0">
        {/* Chapter list: a side panel on wide screens */}
        <nav
          ref={sideNavRef}
          className="hidden md:block w-64 shrink-0 overflow-y-auto border-r border-neutral-800 py-3 text-sm"
          aria-label="Chapters"
        >
          <ChapterList chapter={chapter} active={active} onGo={go} />
        </nav>

        {/* ...and a drawer that slides in on narrow screens */}
        <div
          className={`md:hidden absolute inset-0 z-20 bg-black/60 transition-opacity duration-200 ${
            drawer ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          onClick={closeDrawer}
          aria-hidden="true"
        />
        <nav
          ref={drawerNavRef}
          id="docs-drawer"
          aria-label="Chapters"
          inert={!drawer}
          className={`md:hidden absolute inset-y-0 left-0 z-30 w-72 max-w-[85vw] overflow-y-auto overscroll-contain bg-neutral-900 border-r border-neutral-800 py-3 text-sm shadow-2xl duration-200 ease-out ${
            // Visible at once when opening (so it can take focus), hidden once it has slid out
            drawer
              ? "translate-x-0 visible transition-transform"
              : "-translate-x-full invisible transition-[transform,visibility]"
          }`}
        >
          <ChapterList chapter={chapter} active={active} onGo={go} />
        </nav>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <span role="status" className="sr-only">
            {copyStatus}
          </span>
          <article
            onClick={onArticleClick}
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

/**
 * Copies text to the clipboard. The Clipboard API needs a secure page (https or localhost); on
 * plain http (the game opened on the LAN) the older copy command still works.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      area.remove();
    }
  }
}

/** Every chapter; under the current one, its sections, the one being read marked. */
const ChapterList: React.FC<{
  chapter: ManualChapter;
  active: string | null;
  onGo: (route: DocsRoute) => void;
}> = ({ chapter, active, onGo }) => {
  const sections = chapter.sections.filter((s) => s.depth === 2);
  /** A real link (copyable, opens in a new tab), handled here on a plain click. */
  const link = (route: DocsRoute) => ({
    href: docsHash(route),
    onClick: (e: React.MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      onGo(route);
    },
  });
  return (
    <>
      {CHAPTERS.map((c) => {
        const current = c.slug === chapter.slug;
        return (
          <div key={c.slug}>
            <a
              {...link({ chapter: c.slug, anchor: null })}
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
                  {...link({ chapter: c.slug, anchor: s.anchor })}
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
    </>
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
