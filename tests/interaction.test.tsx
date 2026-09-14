import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  const stage = (transcript = entries) => (
    <MainStage
      expanded={true}
      onExpandedChange={onExpandedChange}
      transcript={transcript}
    />
  );
  const view = render(stage());
  return {
    onExpandedChange,
    history: screen.getByRole("log"),
    rerender: () => view.rerender(stage([...entries])),
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
it.each(["scrollend", "timeout", "append", "rerender"])(
  "%s clears earlier downward intent before a programmatic bottom scroll",
  (completion) => {
    vi.useFakeTimers();
    try {
      const { history, onExpandedChange, append, rerender } =
        renderTranscript();
      history.scrollTop = 400;
      fireEvent.wheel(history, { deltaY: 100 });
      history.scrollTop = 500;
      fireEvent.scroll(history);
      if (completion === "scrollend")
        fireEvent(history, new Event("scrollend"));
      if (completion === "timeout") vi.advanceTimersByTime(200);
      if (completion === "append") append();
      if (completion === "rerender") rerender();
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
