import {
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
export interface StageRenderContext {
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
}
export interface TranscriptEntry {
  id: string;
  author: string;
  content: ReactNode;
}
export interface MainStageProps {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  title?: string;
  transcript?:
    | readonly TranscriptEntry[]
    | ((context: StageRenderContext) => ReactNode);
  composer?: ReactNode | ((context: StageRenderContext) => ReactNode);
}
export function MainStage({
  expanded,
  onExpandedChange,
  title = "Main stage",
  transcript = [],
  composer,
}: MainStageProps) {
  const history = useRef<HTMLDivElement>(null),
    touchY = useRef<number | null>(null);
  const previousEntries = useRef<string[] | null>(null);
  const nearBottom = useRef(true);
  const navigatingOlder = useRef(false);
  const resizeScrollTop = useRef<number | null>(null);
  const historyHeight = useRef<number | null>(null);
  const downward = useRef<{
    top: number;
    height: number;
    content: number;
  } | null>(null);
  const intentTimer = useRef<ReturnType<typeof setTimeout>>();
  const clearDownward = () => {
    downward.current = null;
    clearTimeout(intentTimer.current);
  };
  const expireDownward = () => {
    clearTimeout(intentTimer.current);
    // Bound inputs that never scroll and support browsers without scrollend.
    // Native smooth keyboard scrolling refreshes this deadline.
    intentTimer.current = setTimeout(clearDownward, 180);
  };
  const down = (target: EventTarget) => {
    const element = history.current;
    clearDownward();
    navigatingOlder.current = false;
    if (!element) return;
    if (element.scrollHeight - element.clientHeight - element.scrollTop <= 1) {
      onExpandedChange(false);
    } else if (target instanceof Node && element.contains(target)) {
      downward.current = {
        top: element.scrollTop,
        height: element.clientHeight,
        content: element.scrollHeight,
      };
      expireDownward();
    }
  };
  useEffect(() => {
    const element = history.current;
    element?.addEventListener("scrollend", clearDownward);
    return () => {
      clearDownward();
      element?.removeEventListener("scrollend", clearDownward);
    };
  }, []);
  const contentObserver = useRef<MutationObserver | null>(null);
  const refreshPresentation = useRef<(() => void) | null>(null);
  const contentChanged = useRef(false);
  useLayoutEffect(() => {
    const element = history.current;
    if (!element) return;
    const observer = new MutationObserver(() => {
      clearDownward();
      refreshPresentation.current?.();
    });
    contentObserver.current = observer;
    // Observe rendered content, not prop identity or our scroll-driven styles.
    observer.observe(element, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    return () => {
      observer.disconnect();
      contentObserver.current = null;
    };
  }, []);
  useLayoutEffect(() => {
    // Invalidate synchronously before append-following can queue a scroll.
    if (contentObserver.current?.takeRecords().length) {
      clearDownward();
      contentChanged.current = true;
    }
  });
  useLayoutEffect(() => {
    clearDownward();
  }, [expanded]);
  const id = useId();
  useLayoutEffect(() => {
    const element = history.current;
    if (!element || typeof transcript === "function") return;
    historyHeight.current = element.clientHeight;
    const ids = transcript.map((entry) => entry.id);
    const previous = previousEntries.current;
    const appended =
      previous !== null &&
      ids.length > previous.length &&
      previous.every((id, index) => ids[index] === id);
    if (previous === null || (appended && nearBottom.current)) {
      element.scrollTop = Math.max(
        0,
        element.scrollHeight - element.clientHeight,
      );
    }
    previousEntries.current = ids;
  });
  useLayoutEffect(() => {
    if (contentChanged.current) {
      // Apply depth after append-following has settled the scroll position.
      refreshPresentation.current?.();
      contentChanged.current = false;
    }
  });
  const customTranscript = typeof transcript === "function";
  useEffect(() => {
    const element = history.current;
    if (!element) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      for (const child of element.querySelectorAll<HTMLElement>(
        ".spg-message",
      )) {
        const center =
          child.offsetTop + child.offsetHeight / 2 - element.scrollTop;
        const depth = Math.max(
          0,
          Math.min(
            1,
            (element.clientHeight - center) / Math.max(1, element.clientHeight),
          ),
        );
        child.style.transform = media.matches
          ? "none"
          : `translateZ(${-depth * 170}px) rotateX(${depth * 12}deg)`;
        child.style.opacity = media.matches ? "1" : String(1 - depth * 0.72);
      }
    };
    refreshPresentation.current = update;
    const observer = new ResizeObserver(() => {
      clearDownward();
      const heightChange =
        element.clientHeight - (historyHeight.current ?? element.clientHeight);
      historyHeight.current = element.clientHeight;
      if (!customTranscript && navigatingOlder.current && heightChange > 0) {
        // Growing the viewport would otherwise consume the first upward
        // scroll's gap. Keep that navigation while the stage expands.
        element.scrollTop = Math.max(0, element.scrollTop - heightChange);
      } else if (!customTranscript && nearBottom.current) {
        element.scrollTop = Math.max(
          0,
          element.scrollHeight - element.clientHeight,
        );
      }
      // Resize can clamp scrollTop or queue a scroll event. Neither changes
      // the reader's intent, even if the next animation frame has resized again.
      resizeScrollTop.current = element.scrollTop;
      update();
    });
    observer.observe(element);
    element.addEventListener("scroll", update, { passive: true });
    media.addEventListener("change", update);
    update();
    return () => {
      refreshPresentation.current = null;
      observer.disconnect();
      element.removeEventListener("scroll", update);
      media.removeEventListener("change", update);
    };
  }, [customTranscript]);
  const setExpanded = (value: boolean) => {
    clearDownward();
    navigatingOlder.current = false;
    onExpandedChange(value);
  };
  const context = { expanded, setExpanded };
  return (
    <section
      className="spg-stage-content"
      aria-label={title}
      onWheel={(event) => {
        if (!event.ctrlKey && event.deltaY !== 0) {
          if (event.deltaY > 0) down(event.target);
          else {
            clearDownward();
            onExpandedChange(true);
          }
        }
      }}
      onTouchStart={(event) => {
        touchY.current = event.touches[0]?.clientY ?? null;
      }}
      onTouchMove={(event) => {
        const y = event.touches[0]?.clientY;
        if (
          touchY.current !== null &&
          y !== undefined &&
          Math.abs(y - touchY.current) > 12
        ) {
          if (y < touchY.current) down(event.target);
          else {
            clearDownward();
            onExpandedChange(true);
          }
          touchY.current = y;
        }
      }}
      onTouchEnd={() => {
        touchY.current = null;
      }}
      onTouchCancel={() => {
        clearDownward();
        touchY.current = null;
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setExpanded(false);
          event.stopPropagation();
        }
      }}
    >
      <header className="spg-stage-header">
        <span className="spg-stage-title">
          <span aria-hidden="true">✦</span>
          {title}
        </span>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Collapse ↙" : "Expand ↗"}
        </button>
      </header>
      <div
        className="spg-history"
        id={id}
        ref={history}
        role="log"
        aria-label="Conversation transcript"
        tabIndex={0}
        onWheel={(event) => {
          // Record navigation intent before the bubbling expansion handler
          // changes height; resize-generated scroll events cannot supply it.
          if (!event.ctrlKey && event.deltaY < 0) {
            navigatingOlder.current = true;
            nearBottom.current = false;
          }
        }}
        onTouchMove={(event) => {
          const y = event.touches[0]?.clientY;
          if (
            touchY.current !== null &&
            y !== undefined &&
            y > touchY.current
          ) {
            navigatingOlder.current = true;
            nearBottom.current = false;
          }
        }}
        onPointerDown={() => {
          clearDownward();
          navigatingOlder.current = false;
        }}
        onScroll={(event) => {
          const element = event.currentTarget;
          const intent = downward.current;
          if (intent) {
            if (
              element.clientHeight !== intent.height ||
              element.scrollHeight !== intent.content ||
              element.scrollTop < intent.top
            )
              clearDownward();
            else if (element.scrollTop > intent.top) {
              intent.top = element.scrollTop;
              if (
                element.scrollHeight -
                  element.clientHeight -
                  element.scrollTop <=
                1
              ) {
                clearDownward();
                onExpandedChange(false);
              } else expireDownward();
            }
          }
          if (
            element.clientHeight !== historyHeight.current ||
            element.scrollTop === resizeScrollTop.current
          )
            return;
          resizeScrollTop.current = null;
          nearBottom.current =
            !navigatingOlder.current &&
            element.scrollHeight - element.clientHeight - element.scrollTop <=
              48;
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (
            ["ArrowUp", "PageUp", "Home"].includes(event.key) ||
            (event.key === " " && event.shiftKey)
          ) {
            clearDownward();
            navigatingOlder.current = true;
            nearBottom.current = false;
            onExpandedChange(true);
          }
          if (
            ["ArrowDown", "PageDown", "End"].includes(event.key) ||
            (event.key === " " && !event.shiftKey)
          )
            down(event.target);
        }}
      >
        {typeof transcript === "function"
          ? transcript(context)
          : transcript.map((entry) => (
              <article className="spg-message" key={entry.id}>
                <div className="spg-author">{entry.author}</div>
                <div>{entry.content}</div>
              </article>
            ))}
      </div>
      <div className="spg-composer">
        {typeof composer === "function" ? composer(context) : composer}
      </div>
    </section>
  );
}
