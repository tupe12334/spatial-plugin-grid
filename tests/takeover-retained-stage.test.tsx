import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { ActionBlock, AgentWorkspace } from "../src";

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Choose</button>
      <AgentWorkspace
        plugins={[]}
        mainStage={{ composer: <textarea aria-label="Draft" /> }}
        takeover={{
          open,
          onOpenChange: setOpen,
          regions: [
            {
              id: "results",
              title: "Results",
              rect: { row: 1, column: 1, rows: 2, columns: 4 },
              render: ({ close }) => <button onClick={close}>Return</button>,
            },
          ],
        }}
      />
    </>
  );
}

it("compacts a pinned expanded stage only for presentation and restores the identical draft node and state", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Expand ↗" }));
  fireEvent.click(screen.getByRole("button", { name: /Lock expanded/ }));
  const draft = screen.getByRole("textbox", { name: "Draft" });
  fireEvent.change(draft, { target: { value: "keep this draft" } });
  const panel = draft.closest<HTMLElement>("[data-plugin-id]");
  expect(panel?.dataset.state).toBe("expanded");
  expect(panel?.dataset.pinned).toBe("true");
  const trigger = screen.getByRole("button", { name: "Choose" });
  trigger.focus();
  fireEvent.click(trigger);
  expect(panel?.inert).toBe(false);
  expect(panel?.dataset.state).toBe("collapsed");
  expect(screen.getByRole("textbox", { name: "Draft" })).toBe(draft);
  fireEvent.keyDown(draft, { key: "Escape" });
  expect(screen.queryByRole("button", { name: "Return" })).toBeNull();
  expect(panel?.dataset.state).toBe("expanded");
  expect(panel?.dataset.pinned).toBe("true");
  expect(screen.getByRole("textbox", { name: "Draft" })).toBe(draft);
  expect(draft.getAttribute("aria-label")).toBe("Draft");
  expect(document.activeElement).toBe(trigger);
});

it("plain navigation actions do not announce toggle state", () => {
  render(<ActionBlock label="Next" onActivate={() => {}} />);
  expect(
    screen.getByRole("button", { name: "Next" }).hasAttribute("aria-pressed"),
  ).toBe(false);
});
