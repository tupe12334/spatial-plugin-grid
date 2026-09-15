import { startTransition, Suspense, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MainStage, SpatialPluginGrid, type PluginDefinition } from "../src";
const disconnect = vi.fn(),
  remove = vi.fn();
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {
        disconnect();
      }
    },
  );
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: remove,
  }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
const plugins: PluginDefinition[] = [
  {
    id: "a",
    title: "A",
    home: "11",
    allowedSizes: ["1x1", "2x1"],
    render: ({ expanded }) => <button>{expanded ? "Large" : "Small"}</button>,
  },
  {
    id: "b",
    title: "B",
    home: "12",
    allowedSizes: ["1x1", "2x2"],
    render: () => <button>Other</button>,
  },
];
it("expands without renumbering, makes covered panel inert and recovers focus", () => {
  const callback = vi.fn();
  render(<SpatialPluginGrid plugins={plugins} onPluginSizeChange={callback} />);
  screen.getByText("Other").focus();
  fireEvent.change(screen.getByLabelText("A size"), {
    target: { value: "2x1" },
  });
  expect(screen.getByRole("region", { name: "B" }).inert).toBe(true);
  expect(document.activeElement).toBe(screen.getByLabelText("A size"));
  expect(screen.getByRole("region", { name: "A" }).dataset.home).toBe("11");
  expect(callback).toHaveBeenCalledWith("a", "2x1");
  fireEvent.keyDown(screen.getByLabelText("A size"), { key: "Escape" });
  expect(screen.getByRole("region", { name: "B" }).inert).toBe(false);
});
it("isolates render errors and reports to host", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const onError = vi.fn();
  render(
    <SpatialPluginGrid
      plugins={[
        {
          ...plugins[0]!,
          render: () => {
            throw new Error("failure");
          },
        },
        plugins[1]!,
      ]}
      onPluginError={onError}
    />,
  );
  expect(screen.getByRole("alert").textContent).toContain("could not render");
  expect(screen.getByText("Other")).toBeTruthy();
  expect(onError).toHaveBeenCalled();
  consoleError.mockRestore();
});
it("cleans observers and media listeners on unmount", () => {
  const view = render(<SpatialPluginGrid plugins={plugins} />);
  view.unmount();
  expect(disconnect).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalledTimes(1);
});
it("empty transcript supports keyboard, wheel and thresholded touch collapse", () => {
  render(<SpatialPluginGrid plugins={plugins} />);
  const history = screen.getByRole("log");
  fireEvent.keyDown(history, { key: "ArrowUp" });
  expect(
    screen
      .getByRole("button", { name: /Collapse/ })
      .getAttribute("aria-expanded"),
  ).toBe("true");
  fireEvent.keyDown(history, { key: "ArrowDown" });
  expect(screen.getByRole("button", { name: /Expand/ })).toBeTruthy();
  fireEvent.wheel(history, { deltaY: -100 });
  expect(screen.getByRole("button", { name: /Collapse/ })).toBeTruthy();
  fireEvent.wheel(history, { deltaY: 100 });
  expect(screen.getByRole("button", { name: /Expand/ })).toBeTruthy();
  fireEvent.touchStart(history, { touches: [{ clientY: 200 }] });
  fireEvent.touchMove(history, { touches: [{ clientY: 210 }] });
  expect(screen.getByRole("button", { name: /Expand/ })).toBeTruthy();
  fireEvent.touchMove(history, { touches: [{ clientY: 250 }] });
  expect(screen.getByRole("button", { name: /Collapse/ })).toBeTruthy();
  fireEvent.touchMove(history, { touches: [{ clientY: 100 }] });
  expect(screen.getByRole("button", { name: /Expand/ })).toBeTruthy();
});

// jsdom has no layout: supply overflow geometry before the mount effects run.
function renderTranscript() {
  let height = 1000;
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(
    () => height,
  );
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(200);
  const entries = Array.from({ length: 20 }, (_, index) => ({
    id: String(index),
    author: "Reader",
    content: `Message ${index}`,
  }));
  const onExpandedChange = vi.fn();
  const stage = (
    transcript = entries,
    title = "Main stage",
    expanded = true,
  ) => (
    <MainStage
      expanded={expanded}
      title={title}
      onExpandedChange={onExpandedChange}
      transcript={transcript}
    />
  );
  const view = render(stage());
  return {
    onExpandedChange,
    history: screen.getByRole("log"),
    rerender: () => view.rerender(stage(entries)),
    recreate: () =>
      view.rerender(stage(entries.map((entry) => ({ ...entry })))),
    retitle: () => view.rerender(stage(entries, "Updated title")),
    collapse: () => view.rerender(stage(entries, undefined, false)),
    replace: () =>
      view.rerender(
        stage(entries.map((entry) => ({ ...entry, content: "Updated" }))),
      ),
    replaceIds: () =>
      view.rerender(
        stage(entries.map((entry) => ({ ...entry, id: `new-${entry.id}` }))),
      ),
    append: () => {
      height += 100;
      entries.push({
        id: String(entries.length),
        author: "Reader",
        content: "Appended message",
      });
      view.rerender(stage([...entries]));
    },
  };
}
it("initial populated transcript starts at the latest message", () => {
  const { history } = renderTranscript();
  expect(history.scrollTop).toBe(800);
});
it("styles replacement entries without scroll or resize when reduced motion is disabled", () => {
  const { history, replaceIds } = renderTranscript();
  const original = history.querySelector<HTMLElement>(".spg-message")!;
  const { transform, opacity } = original.style;
  expect(transform).toContain("translateZ(-170px) rotateX(12deg)");
  expect(Number(opacity)).toBeCloseTo(0.28);

  replaceIds();

  expect(history.scrollTop).toBe(800);
  const replacements = history.querySelectorAll<HTMLElement>(".spg-message");
  expect(replacements).toHaveLength(20);
  expect(replacements[0]).not.toBe(original);
  for (const entry of replacements) {
    expect(entry.style.transform).toBe(transform);
    expect(entry.style.opacity).toBe(opacity);
  }
  expect(disconnect).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});
it.each(["wheel", "Home", "PageUp", "ArrowUp", "touch", "Shift+Space"])(
  "%s intent relinquishes following before native scroll and resize events",
  (input) => {
    const { history, append } = renderTranscript();
    if (input === "wheel") fireEvent.wheel(history, { deltaY: -150 });
    else if (input === "touch") {
      fireEvent.touchStart(history, { touches: [{ clientY: 200 }] });
      fireEvent.touchMove(history, { touches: [{ clientY: 250 }] });
    } else if (input === "Shift+Space")
      fireEvent.keyDown(history, { key: " ", shiftKey: true });
    else fireEvent.keyDown(history, { key: input });
    // A queued scroll at the old bottom must not override explicit intent.
    fireEvent.scroll(history);
    append();
    expect(history.scrollTop).toBe(800);
    fireEvent.wheel(history, { deltaY: 150 });
    history.scrollTop = 900;
    fireEvent.scroll(history);
    append();
    expect(history.scrollTop).toBe(1000);
  },
);
it("appended messages follow a reader near the bottom", () => {
  const { history, append, rerender } = renderTranscript();
  history.scrollTop = 770;
  fireEvent.scroll(history);
  rerender();
  expect(history.scrollTop).toBe(770);
  append();
  expect(history.scrollTop).toBe(900);
});
it("reading older messages retains position on rerender and append", () => {
  const { history, append, rerender } = renderTranscript();
  history.scrollTop = 120;
  fireEvent.scroll(history);
  rerender();
  expect(history.scrollTop).toBe(120);
  append();
  expect(history.scrollTop).toBe(120);
  history.scrollTop = 900;
  fireEvent.scroll(history);
  append();
  expect(history.scrollTop).toBe(1000);
});

it.each(["wheel", "ArrowDown", "PageDown", "End", " ", "touch"])(
  "%s stays expanded midstream and near bottom, then collapses on its scroll",
  (input) => {
    const { history, onExpandedChange } = renderTranscript();
    history.scrollTop = 400;
    const gesture = () => {
      if (input === "wheel") fireEvent.wheel(history, { deltaY: 100 });
      else if (input === "touch") {
        fireEvent.touchStart(history, { touches: [{ clientY: 200 }] });
        fireEvent.touchMove(history, { touches: [{ clientY: 180 }] });
      } else fireEvent.keyDown(history, { key: input });
    };
    gesture();
    expect(onExpandedChange).not.toHaveBeenCalled();
    history.scrollTop = 770;
    fireEvent.scroll(history);
    expect(onExpandedChange).not.toHaveBeenCalled();
    gesture();
    expect(onExpandedChange).not.toHaveBeenCalled();
    history.scrollTop = 799;
    fireEvent.scroll(history);
    expect(onExpandedChange).toHaveBeenCalledExactlyOnceWith(false);
  },
);
it("End collapses when native scrollend precedes React's final bottom scroll", () => {
  const { history, onExpandedChange } = renderTranscript();
  history.scrollTop = 770;
  fireEvent.keyDown(history, { key: "End" });
  history.scrollTop = 797;
  fireEvent.scroll(history);
  expect(onExpandedChange).not.toHaveBeenCalled();
  history.scrollTop = 800;
  fireEvent(history, new Event("scrollend"));
  fireEvent.scroll(history);
  expect(onExpandedChange).toHaveBeenCalledExactlyOnceWith(false);
});

it.each([
  "no intent",
  "expired",
  "height changed",
  "content height changed",
  "upward progress",
  "pointer",
  "touch cancel",
  "append",
  "replace",
  "collapse",
  "finished without progress",
  "finished with progress",
])(
  "scrollend rejects %s before a later programmatic bottom scroll",
  (reason) => {
    vi.useFakeTimers();
    try {
      const view = renderTranscript();
      const { history, onExpandedChange } = view;
      history.scrollTop = 770;
      if (reason !== "no intent") fireEvent.keyDown(history, { key: "End" });
      history.scrollTop = 797;
      fireEvent.scroll(history);
      if (reason === "expired") vi.advanceTimersByTime(180);
      if (reason === "height changed")
        vi.spyOn(history, "clientHeight", "get").mockReturnValue(210);
      if (reason === "content height changed")
        vi.spyOn(history, "scrollHeight", "get").mockReturnValue(1010);
      if (reason === "pointer") fireEvent.pointerDown(history);
      if (reason === "touch cancel") fireEvent.touchCancel(history);
      if (reason === "append" || reason === "replace" || reason === "collapse")
        view[reason]();
      if (reason === "finished with progress") history.scrollTop = 798;
      if (reason.startsWith("finished"))
        fireEvent(history, new Event("scrollend"));
      history.scrollTop =
        reason === "upward progress"
          ? 790
          : history.scrollHeight - history.clientHeight;
      fireEvent(history, new Event("scrollend"));
      expect(onExpandedChange).not.toHaveBeenCalled();
      history.scrollTop = history.scrollHeight - history.clientHeight;
      fireEvent.scroll(history);
      fireEvent(history, new Event("scrollend"));
      expect(onExpandedChange).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  },
);

it("scrollend honors the refreshed 180ms intent deadline", () => {
  vi.useFakeTimers();
  try {
    const { history, onExpandedChange } = renderTranscript();
    history.scrollTop = 770;
    fireEvent.keyDown(history, { key: "End" });
    vi.advanceTimersByTime(179);
    history.scrollTop = 797;
    fireEvent.scroll(history);
    vi.advanceTimersByTime(179);
    history.scrollTop = 800;
    fireEvent(history, new Event("scrollend"));
    fireEvent.scroll(history);
    expect(onExpandedChange).toHaveBeenCalledExactlyOnceWith(false);
  } finally {
    vi.useRealTimers();
  }
});

it.each(["scrollend", "timeout", "append", "replace", "collapse"])(
  "%s clears earlier downward intent before a programmatic bottom scroll",
  (completion) => {
    vi.useFakeTimers();
    try {
      const { history, onExpandedChange, append, replace, collapse } =
        renderTranscript();
      history.scrollTop = 400;
      fireEvent.wheel(history, { deltaY: 100 });
      history.scrollTop = 500;
      fireEvent.scroll(history);
      if (completion === "scrollend")
        fireEvent(history, new Event("scrollend"));
      if (completion === "timeout") vi.advanceTimersByTime(200);
      if (completion === "append") append();
      if (completion === "replace") replace();
      if (completion === "collapse") collapse();
      history.scrollTop = history.scrollHeight - history.clientHeight;
      fireEvent.scroll(history);
      expect(onExpandedChange).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  },
);
it("custom transcripts collapse at their native scroll bottom", () => {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(1000);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(200);
  const change = vi.fn();
  render(
    <MainStage
      expanded
      onExpandedChange={change}
      transcript={() => <p>Custom content</p>}
    />,
  );
  const history = screen.getByRole("log");
  history.scrollTop = 770;
  fireEvent.wheel(history, { deltaY: 50 });
  expect(change).not.toHaveBeenCalled();
  history.scrollTop = 800;
  fireEvent.scroll(history);
  expect(change).toHaveBeenCalledExactlyOnceWith(false);
});

it("resize invalidates downward intent before its queued bottom scroll", () => {
  let resize = () => {};
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  const { history, onExpandedChange } = renderTranscript();
  history.scrollTop = 770;
  fireEvent.wheel(history, { deltaY: 10 });
  resize();
  history.scrollTop = 800;
  fireEvent.scroll(history);
  expect(onExpandedChange).not.toHaveBeenCalled();
});

for (const targetName of ["header", ".spg-composer"]) {
  it.each(["wheel", "touch"])(
    `%s over ${targetName} cannot authorize an immediate programmatic transcript collapse`,
    (input) => {
      const { history, onExpandedChange } = renderTranscript();
      const target = history.parentElement!.querySelector(targetName)!;
      history.scrollTop = 770;
      if (input === "wheel") fireEvent.wheel(target, { deltaY: 10 });
      else {
        fireEvent.touchStart(target, { touches: [{ clientY: 200 }] });
        fireEvent.touchMove(target, { touches: [{ clientY: 180 }] });
      }
      history.scrollTop = 800;
      fireEvent.scroll(history);
      expect(onExpandedChange).not.toHaveBeenCalled();
      // An outside downward action while already at bottom still collapses.
      fireEvent.wheel(target, { deltaY: 10 });
      expect(onExpandedChange).toHaveBeenCalledExactlyOnceWith(false);
    },
  );
}
for (const update of ["rerender", "retitle", "recreate"] as const) {
  it.each(["End", "PageDown"])(
    `%s keeps native scroll intent across ${update}`,
    (key) => {
      const view = renderTranscript();
      view.history.scrollTop = 770;
      fireEvent.keyDown(view.history, { key });
      view.history.scrollTop = 780;
      fireEvent.scroll(view.history);
      view[update]();
      expect(view.onExpandedChange).not.toHaveBeenCalled();
      view.history.scrollTop = 800;
      fireEvent.scroll(view.history);
      expect(view.onExpandedChange).toHaveBeenCalledExactlyOnceWith(false);
    },
  );
}

it.each([false, true])(
  "End across a recreated render function (content changed: %s)",
  (changed) => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(
      1000,
    );
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(200);
    const change = vi.fn();
    const stage = (text: string) => (
      <MainStage
        expanded
        onExpandedChange={change}
        transcript={() => <p>{text}</p>}
      />
    );
    const view = render(stage("Same content"));
    const history = screen.getByRole("log");
    history.scrollTop = 770;
    fireEvent.keyDown(history, { key: "End" });
    history.scrollTop = 780;
    fireEvent.scroll(history);
    view.rerender(stage(changed ? "Changed content" : "Same content"));
    expect(change).not.toHaveBeenCalled();
    history.scrollTop = 800;
    fireEvent.scroll(history);
    if (changed) expect(change).not.toHaveBeenCalled();
    else expect(change).toHaveBeenCalledExactlyOnceWith(false);
  },
);

it.each([
  "wheel",
  "touch",
  "ArrowDown",
  "PageDown",
  "End",
  " ",
  "Escape",
  "Collapse",
  "context",
])(
  "locked standalone rejects %s collapse and unlock leaves expanded",
  (input) => {
    const change = vi.fn();
    render(
      <MainStage
        expanded
        onExpandedChange={change}
        composer={({ setExpanded }) => (
          <button onClick={() => setExpanded(false)}>Host collapse</button>
        )}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Lock expanded stage" }),
    );
    const history = screen.getByRole("log");
    if (input === "wheel") fireEvent.wheel(history, { deltaY: 100 });
    else if (input === "touch") {
      fireEvent.touchStart(history, { touches: [{ clientY: 200 }] });
      fireEvent.touchMove(history, { touches: [{ clientY: 100 }] });
    } else if (input === "Collapse")
      fireEvent.click(screen.getByRole("button", { name: /Collapse/ }));
    else if (input === "context")
      fireEvent.click(screen.getByText("Host collapse"));
    else fireEvent.keyDown(history, { key: input });
    expect(change).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole("button", { name: /Collapse/ })
        .getAttribute("aria-disabled"),
    ).toBe("true");
    fireEvent.click(
      screen.getByRole("button", { name: "Unlock expanded stage" }),
    );
    expect(change).not.toHaveBeenCalled();
    fireEvent.wheel(history, { deltaY: 100 });
    expect(change).toHaveBeenCalledExactlyOnceWith(false);
  },
);
it.each(["before lock", "while locked"])(
  "lock transitions clear intent started %s",
  (when) => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(
      1000,
    );
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(200);
    const change = vi.fn();
    render(<MainStage expanded onExpandedChange={change} />);
    const history = screen.getByRole("log");
    history.scrollTop = 770;
    if (when === "before lock") fireEvent.keyDown(history, { key: "End" });
    fireEvent.click(
      screen.getByRole("button", { name: "Lock expanded stage" }),
    );
    if (when === "while locked") fireEvent.keyDown(history, { key: "End" });
    fireEvent.click(
      screen.getByRole("button", { name: "Unlock expanded stage" }),
    );
    history.scrollTop = 800;
    fireEvent.scroll(history);
    expect(change).not.toHaveBeenCalled();
    fireEvent.keyDown(history, { key: "End" });
    expect(change).toHaveBeenCalledExactlyOnceWith(false);
  },
);
it("pinned grid covers occupied homes and later overlapping expansions without losing focus", () => {
  const expanded = vi.fn(),
    locked = vi.fn();
  render(
    <SpatialPluginGrid
      plugins={[
        ...plugins,
        ...(["22", "23"] as const).map((home) => ({
          id: home,
          title: home,
          home,
          allowedSizes: ["1x1"] as const,
          render: () => <button>Occupied {home}</button>,
        })),
      ]}
      onStageExpandedChange={expanded}
      onStageLockedChange={locked}
    />,
  );
  screen.getByText("Occupied 22").focus();
  fireEvent.click(screen.getByRole("button", { name: "Lock expanded stage" }));
  const stage = screen.getByRole("log").closest<HTMLElement>(".spg-stage")!;
  expect(stage.dataset.expanded).toBe("true");
  for (const home of ["22", "23"])
    expect(screen.getByRole("region", { name: home }).inert).toBe(true);
  expect(stage.contains(document.activeElement)).toBe(true);
  fireEvent.change(screen.getByLabelText("B size"), {
    target: { value: "2x2" },
  });
  const neighbor = screen.getByRole("region", { name: "B" });
  expect(stage.inert).toBe(false);
  expect(neighbor.inert).toBe(true);
  expect(Number(stage.style.zIndex)).toBeGreaterThan(
    Number(neighbor.style.zIndex),
  );
  expect(locked).toHaveBeenCalledExactlyOnceWith(true);
  expect(expanded).toHaveBeenCalledExactlyOnceWith(true);
  fireEvent.click(
    screen.getByRole("button", { name: "Unlock expanded stage" }),
  );
  expect(stage.dataset.expanded).toBe("true");
  expect(stage.inert).toBe(true);
  expect(neighbor.inert).toBe(false);
  expect(document.activeElement).toBe(screen.getByLabelText("B size"));
});

it("controlled lock props imply expanded and context reports guarded controls", () => {
  const expanded = vi.fn(),
    locked = vi.fn();
  const stage = (value: boolean) => (
    <MainStage
      expanded={false}
      locked={value}
      onLockedChange={locked}
      onExpandedChange={expanded}
      transcript={(context) => (
        <button onClick={() => context.setExpanded(false)}>
          Transcript collapse {String(context.locked)}{" "}
          {String(context.expanded)}
        </button>
      )}
      composer={(context) => (
        <button onClick={() => context.setLocked(!context.locked)}>
          Host lock
        </button>
      )}
    />
  );
  const view = render(stage(true));
  fireEvent.click(screen.getByText("Transcript collapse true true"));
  fireEvent.click(screen.getByText("Host lock"));
  expect(locked).toHaveBeenCalledExactlyOnceWith(false);
  expect(expanded).not.toHaveBeenCalled();
  expect(
    screen
      .getByRole("button", { name: "Unlock expanded stage" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  view.rerender(stage(false));
  fireEvent.click(screen.getByText("Host lock"));
  expect(expanded).toHaveBeenCalledExactlyOnceWith(true);
  expect(locked).toHaveBeenLastCalledWith(true);
});
it("unlock then explicit collapse restores occupied panels after animation", () => {
  vi.useFakeTimers();
  try {
    render(
      <SpatialPluginGrid
        plugins={[
          {
            id: "22",
            title: "Occupied",
            home: "22",
            allowedSizes: ["1x1"],
            render: () => <button>Occupant</button>,
          },
        ]}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Lock expanded stage" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Unlock expanded stage" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Collapse/ }));
    const panel = screen.getByRole("region", { name: "Occupied" });
    expect(panel.inert).toBe(true);
    fireEvent.transitionEnd(screen.getByRole("log").closest(".spg-stage")!, {
      propertyName: "height",
    });
    // jsdom does not supply TransitionEvent.propertyName; exercise timer fallback.
    act(() => vi.advanceTimersByTime(500));
    expect(panel.inert).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});

it.each(
  (["controlled", "uncontrolled", "grid"] as const).flatMap((mode) =>
    [false, true].map((reverse) => ({ mode, reverse })),
  ),
)(
  "$mode keeps committed lock guards during a suspended unlock (reversals: $reverse)",
  async ({ mode, reverse }) => {
    const change = vi.fn();
    const lockChanges = vi.fn();
    const suspended = vi.fn();
    let ready = false;
    let release = () => {};
    const blocker = new Promise<void>((resolve) => {
      release = resolve;
    });
    function Sibling({ pause }: { pause: boolean }) {
      if (pause && !ready) {
        suspended();
        throw blocker;
      }
      return null;
    }
    function Host() {
      const [locked, setLocked] = useState(false);
      const [pause, setPause] = useState(false);
      const composer = (context: import("../src").StageRenderContext) => (
        <button
          onClick={() => {
            startTransition(() => {
              context.setLocked(false);
              context.setExpanded(false);
              if (reverse) {
                context.setLocked(true);
                context.setExpanded(false);
                context.setLocked(false);
                context.setExpanded(false);
              }
              setPause(true);
            });
          }}
        >
          Transition unlock
        </button>
      );
      return (
        <Suspense fallback={<p>Waiting</p>}>
          {mode === "grid" ? (
            <SpatialPluginGrid
              plugins={[]}
              mainStage={{ composer }}
              onStageExpandedChange={change}
              onStageLockedChange={lockChanges}
            />
          ) : (
            <MainStage
              expanded
              {...(mode === "controlled" ? { locked } : {})}
              onLockedChange={(value) => {
                lockChanges(value);
                setLocked(value);
              }}
              onExpandedChange={change}
              composer={composer}
            />
          )}
          <Sibling pause={pause} />
        </Suspense>
      );
    }
    render(<Host />);
    fireEvent.click(
      screen.getByRole("button", { name: "Lock expanded stage" }),
    );
    change.mockClear();
    lockChanges.mockClear();
    await act(async () => {
      fireEvent.click(screen.getByText("Transition unlock"));
    });
    expect(lockChanges.mock.calls).toEqual(
      reverse ? [[false], [true], [false]] : [[false]],
    );
    expect(suspended).toHaveBeenCalled();
    expect(screen.queryByText("Waiting")).toBeNull();
    expect(
      screen
        .getByRole("button", { name: "Unlock expanded stage" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /Collapse/ }));
    fireEvent.keyDown(screen.getByRole("log"), { key: "Escape" });
    expect(change).not.toHaveBeenCalled();
    await act(async () => {
      ready = true;
      release();
      await blocker;
    });
    expect(
      screen
        .getByRole("button", { name: "Lock expanded stage" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
    expect(
      screen
        .getByRole("button", { name: /Collapse/ })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /Collapse/ }));
    expect(change).toHaveBeenCalledExactlyOnceWith(false);
  },
);

describe.each(["controlled", "uncontrolled", "grid"] as const)(
  "%s batched lock requests",
  (mode) => {
    it.each(
      [false, true].flatMap((initial) =>
        [false, true].map((collapse) => ({ initial, collapse })),
      ),
    )(
      "reverses from committed $initial (interleaved collapse: $collapse)",
      ({ initial, collapse }) => {
        const changes = vi.fn();
        const locks = vi.fn();
        function Host() {
          const [locked, setLocked] = useState(false);
          const [expanded, setExpanded] = useState(true);
          const composer = (context: import("../src").StageRenderContext) => (
            <button
              onClick={() => {
                context.setLocked(!initial);
                context.setLocked(!initial);
                if (collapse) context.setExpanded(false);
                context.setLocked(initial);
                context.setLocked(initial);
                if (collapse) context.setExpanded(false);
              }}
            >
              Reverse locks
            </button>
          );
          return mode === "grid" ? (
            <SpatialPluginGrid
              plugins={[]}
              mainStage={{ composer }}
              onStageLockedChange={locks}
              onStageExpandedChange={changes}
            />
          ) : (
            <MainStage
              expanded={expanded}
              composer={composer}
              {...(mode === "controlled" ? { locked } : {})}
              onLockedChange={(value) => {
                locks(value);
                setLocked(value);
              }}
              onExpandedChange={(value) => {
                changes(value);
                setExpanded(value);
              }}
            />
          );
        }
        render(<Host />);
        if (mode === "grid")
          fireEvent.click(screen.getByRole("button", { name: /Expand/ }));
        if (initial)
          fireEvent.click(
            screen.getByRole("button", { name: "Lock expanded stage" }),
          );
        changes.mockClear();
        locks.mockClear();
        fireEvent.click(screen.getByText("Reverse locks"));
        expect(locks.mock.calls).toEqual([[!initial], [initial]]);
        expect(changes.mock.calls).toEqual(
          !initial && collapse ? [[false]] : [],
        );
        expect(
          screen
            .getByRole("button", {
              name: initial ? "Unlock expanded stage" : "Lock expanded stage",
            })
            .getAttribute("aria-pressed"),
        ).toBe(String(initial));
        const remainsExpanded = initial || !collapse;
        expect(
          screen
            .getByRole("button", {
              name: remainsExpanded ? /Collapse/ : /Expand/,
            })
            .getAttribute("aria-expanded"),
        ).toBe(String(remainsExpanded));
      },
    );
  },
);

it("controlled standalone guards batched collapse and stays expanded on unlock", () => {
  const change = vi.fn();
  function Host() {
    const [expanded, setExpanded] = useState(false);
    const [locked, setLocked] = useState(false);
    return (
      <MainStage
        expanded={expanded}
        locked={locked}
        onExpandedChange={(value) => {
          change(value);
          setExpanded(value);
        }}
        onLockedChange={setLocked}
        composer={(context) => (
          <button
            onClick={() => {
              context.setLocked(true);
              context.setExpanded(false);
            }}
          >
            Batch standalone lock and collapse
          </button>
        )}
      />
    );
  }
  render(<Host />);
  fireEvent.click(screen.getByText("Batch standalone lock and collapse"));
  expect(change).toHaveBeenCalledExactlyOnceWith(true);
  fireEvent.click(
    screen.getByRole("button", { name: "Unlock expanded stage" }),
  );
  expect(
    screen
      .getByRole("button", { name: /Collapse/ })
      .getAttribute("aria-expanded"),
  ).toBe("true");
  expect(change).toHaveBeenCalledExactlyOnceWith(true);
  fireEvent.click(screen.getByRole("button", { name: /Collapse/ }));
  expect(change.mock.calls).toEqual([[true], [false]]);
});

it.each([false, true])(
  "declined controlled lock allows later collapse (rerender: %s)",
  async (rerender) => {
    const change = vi.fn();
    const stage = (
      <MainStage
        expanded
        locked={false}
        onExpandedChange={change}
        composer={({ setLocked, setExpanded }) => (
          <button
            onClick={() => {
              setLocked(true);
              setExpanded(false);
            }}
          >
            Declined batch lock and collapse
          </button>
        )}
      />
    );
    const view = render(stage);
    fireEvent.click(screen.getByText("Declined batch lock and collapse"));
    expect(change).not.toHaveBeenCalled();
    if (rerender) {
      view.rerender(
        <MainStage expanded locked={false} onExpandedChange={change} />,
      );
    } else {
      await act(async () => {
        await Promise.resolve();
      });
    }
    expect(
      screen
        .getByRole("button", { name: "Lock expanded stage" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: /Collapse/ }));
    expect(change).toHaveBeenCalledExactlyOnceWith(false);
  },
);

it("grid guards batched and retained render-context collapse requests", () => {
  const expanded = vi.fn(),
    locked = vi.fn();
  let staleCollapse: (() => void) | undefined;
  render(
    <SpatialPluginGrid
      plugins={[]}
      onStageExpandedChange={expanded}
      onStageLockedChange={locked}
      mainStage={{
        composer: ({ setLocked, setExpanded }) => {
          staleCollapse ??= () => setExpanded(false);
          return (
            <button
              onClick={() => {
                setLocked(true);
                setExpanded(false);
              }}
            >
              Batch lock and collapse
            </button>
          );
        },
      }}
    />,
  );
  fireEvent.click(screen.getByText("Batch lock and collapse"));
  act(() => staleCollapse!());
  expect(
    screen.getByRole("log").closest<HTMLElement>(".spg-stage")!.dataset
      .expanded,
  ).toBe("true");
  expect(expanded).toHaveBeenCalledExactlyOnceWith(true);
  expect(locked).toHaveBeenCalledExactlyOnceWith(true);
});
