import React from "react";

interface DocsErrorBoundaryProps {
  children: React.ReactNode;
  /** Load the manual again (a fresh request for its code). */
  onRetry: () => void;
  /** Back to the game, which waited behind the manual. */
  onClose: () => void;
  /** How many tries failed before this one (after one, a full reload is offered too). */
  attempt: number;
}

interface DocsErrorBoundaryState {
  failed: boolean;
}

/**
 * The manual is loaded the first time it is opened. If that fails (the server is down, the
 * connection dropped, or a new version was deployed while the page was open), this shows what
 * happened instead of a blank page, and the game behind it stays exactly as it was.
 */
export class DocsErrorBoundary extends React.Component<
  DocsErrorBoundaryProps,
  DocsErrorBoundaryState
> {
  public state: DocsErrorBoundaryState = { failed: false };

  public static getDerivedStateFromError(): DocsErrorBoundaryState {
    return { failed: true };
  }

  public componentDidCatch(error: unknown): void {
    console.warn("Could not open the manual:", error);
  }

  public render(): React.ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <DocsLoadError
        onRetry={this.props.onRetry}
        onClose={this.props.onClose}
        offerReload={this.props.attempt > 0}
      />
    );
  }
}

/** The page shown instead of the manual when it couldn't be loaded. */
const DocsLoadError: React.FC<{
  onRetry: () => void;
  onClose: () => void;
  offerReload: boolean;
}> = ({ onRetry, onClose, offerReload }) => {
  // Escape goes back to the game, as in the manual
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-neutral-950 text-white flex items-center justify-center p-6"
      role="alertdialog"
      aria-labelledby="docs-error-title"
      aria-describedby="docs-error-text"
    >
      <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col gap-4 text-center">
        <h2 id="docs-error-title" className="text-lg font-bold text-yellow-300">
          📖 Couldn&apos;t open the manual
        </h2>
        <p id="docs-error-text" className="text-sm text-neutral-300 leading-relaxed">
          The manual is loaded the first time you open it, and that didn&apos;t work: the connection
          or the server may be down. Your game is waiting where you left it.
          {offerReload &&
            " If it keeps failing, reloading the page fetches everything again (the game starts over)."}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={onRetry}
            className="px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-sm cursor-pointer"
            autoFocus
          >
            Try again
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-sm cursor-pointer"
          >
            ◀ Back to the game
          </button>
          {offerReload && (
            <button
              onClick={() => location.reload()}
              className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-sm cursor-pointer"
            >
              Reload the page
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
