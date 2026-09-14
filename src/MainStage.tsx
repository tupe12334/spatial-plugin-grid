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
  const id = useId();
  useLayoutEffect(() => {
    const element = history.current;
    if (!element || typeof transcript === "function") return;
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
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener("scroll", update, { passive: true });
    media.addEventListener("change", update);
    update();
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
      media.removeEventListener("change", update);
    };
  }, [transcript]);
  const context = { expanded, setExpanded: onExpandedChange };
  return (
    <section
      className="spg-stage-content"
      aria-label={title}
      onWheel={(event) => {
        if (!event.ctrlKey && event.deltaY !== 0)
          onExpandedChange(event.deltaY < 0);
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
          onExpandedChange(y > touchY.current);
          touchY.current = y;
        }
      }}
      onTouchEnd={() => {
        touchY.current = null;
      }}
      onTouchCancel={() => {
        touchY.current = null;
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onExpandedChange(false);
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
          onClick={() => onExpandedChange(!expanded)}
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
        onScroll={(event) => {
          const element = event.currentTarget;
          nearBottom.current =
            element.scrollHeight - element.clientHeight - element.scrollTop <=
            48;
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (["ArrowUp", "PageUp", "Home"].includes(event.key))
            onExpandedChange(true);
          if (["ArrowDown", "PageDown", "End"].includes(event.key))
            onExpandedChange(false);
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
