import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import {
  SpatialPluginGrid,
  defaultGrid,
  definePlugin,
  defineWorkspace,
  useLayoutTakeover,
} from "../src";

beforeEach(() => vi.stubGlobal("matchMedia", () => ({ matches: true })));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>Count {count}</button>;
}

const status = definePlugin({
  id: "status",
  title: "Status",
  layout: {
    anchor: "top-left",
    states: { ready: { rows: 1, columns: 1 } },
    transitions: { ready: [] },
  },
  render: () => <Counter />,
});

const retained = definePlugin({
  id: "agent",
  title: "Agent",
  layout: {
    anchor: "top-left",
    states: { ready: { rows: 1, columns: 1 } },
    transitions: { ready: [] },
  },
  render: () => <button>Send</button>,
});

function Harness({
  initialOpen = false,
  onOpenChange,
}: {
  initialOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(initialOpen);
  const workspace = defineWorkspace(defaultGrid)
    .place(status, { anchor: { row: 2, column: 2 }, initialState: "ready" })
    .place(retained, { anchor: { row: 3, column: 1 }, initialState: "ready" });
  const overlay = useLayoutTakeover({
    open,
    onOpenChange: (next) => {
      setOpen(next);
      onOpenChange?.(next);
    },
    regions: [
      {
        id: "picker-results",
        title: "Systems",
        rect: { row: 1, column: 1, rows: 1, columns: 4 },
        render: ({ close }) => <button onClick={close}>Close picker</button>,
      },
    ],
  });
  return (
    <>
      <button onClick={() => setOpen(true)} data-testid="trigger">
        Open picker
      </button>
      <SpatialPluginGrid workspace={workspace} overlay={overlay} />
    </>
  );
}

it("does not add any overlay plugin while closed", () => {
  render(<Harness />);
  expect(screen.queryByRole("region", { name: "Systems" })).toBeNull();
  expect(screen.getByRole("region", { name: "Status" })).toBeTruthy();
  expect(screen.getByRole("region", { name: "Agent" })).toBeTruthy();
});

it("covers only its own region: the intersecting plugin goes inert, the retained plugin outside the region stays interactive", () => {
  render(<Harness />);
  fireEvent.click(screen.getByText("Count 0"));
  screen.getByTestId("trigger").focus();
  fireEvent.click(screen.getByTestId("trigger"));

  expect(screen.getByRole("region", { name: "Systems" })).toBeTruthy();
  // Status sits at row 2, col 2: inside the picker's row-1 region? No —
  // region is row 1 only, so status (row 2) is untouched.
  expect(screen.getByRole("region", { name: "Status" }).inert).toBe(false);
  expect(screen.getByRole("region", { name: "Agent" }).inert).toBe(false);
  screen.getByRole("button", { name: "Send" }).focus();
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Send" }),
  );

  fireEvent.click(screen.getByText("Close picker"));
  expect(screen.queryByRole("region", { name: "Systems" })).toBeNull();
  // Mounted base plugin state survived the takeover.
  expect(screen.getByText("Count 1")).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByTestId("trigger"));
});

it("covers an intersecting plugin and hides it accessibly", () => {
  function Overlapping() {
    const [open, setOpen] = useState(true);
    const workspace = defineWorkspace(defaultGrid).place(status, {
      anchor: { row: 1, column: 1 },
      initialState: "ready",
    });
    const overlay = useLayoutTakeover({
      open,
      onOpenChange: setOpen,
      regions: [
        {
          id: "picker-results",
          title: "Systems",
          rect: { row: 1, column: 1, rows: 1, columns: 4 },
          render: () => <button>Card</button>,
        },
      ],
    });
    return <SpatialPluginGrid workspace={workspace} overlay={overlay} />;
  }
  render(<Overlapping />);
  expect(screen.getByRole("region", { name: "Status" }).inert).toBe(true);
});

it("closes on Escape and restores focus to the trigger", () => {
  const onOpenChange = vi.fn();
  render(<Harness initialOpen onOpenChange={onOpenChange} />);
  fireEvent.keyDown(screen.getByText("Close picker"), { key: "Escape" });
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

const movedWorkspace = defineWorkspace(defaultGrid).place(status, {
  anchor: { row: 1, column: 1 },
  initialState: "ready",
});

it("retains a moved base placement across takeover open and dismissal", () => {
  function Movable() {
    const [open, setOpen] = useState(false);
    const overlay = useLayoutTakeover({
      open,
      onOpenChange: setOpen,
      regions: [
        {
          id: "temporary",
          title: "Temporary",
          rect: { row: 1, column: 1, rows: 2, columns: 4 },
          render: ({ close }) => <button onClick={close}>Done</button>,
        },
      ],
    });
    return (
      <>
        <button onClick={() => setOpen(true)}>Show</button>
        <SpatialPluginGrid
          workspace={movedWorkspace}
          overlay={overlay}
          dragAndDrop
        />
      </>
    );
  }
  render(<Movable />);
  const handle = screen.getByRole("button", { name: "Move Status" });
  fireEvent.keyDown(handle, { key: "Enter" });
  fireEvent.keyDown(handle, { key: "ArrowRight" });
  fireEvent.keyDown(handle, { key: "Enter" });
  const panel = screen.getByRole("region", { name: "Status" });
  const movedHome = panel.dataset.home;
  expect(movedHome).not.toBe("11");
  fireEvent.click(screen.getByRole("button", { name: "Show" }));
  expect(panel.dataset.home).toBe(movedHome);
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.getByRole("region", { name: "Status" })).toBe(panel);
  expect(panel.dataset.home).toBe(movedHome);
});

it("defaults to focusing the first overlay action on open", () => {
  render(<Harness />);
  fireEvent.click(screen.getByTestId("trigger"));
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Close picker" }),
  );
});

function PreserveHarness({ open }: { open: boolean }) {
  const [isOpen, setIsOpen] = useState(open);
  useEffect(() => setIsOpen(open), [open]);
  const workspace = defineWorkspace(defaultGrid)
    .place(status, { anchor: { row: 2, column: 2 }, initialState: "ready" })
    .place(retained, { anchor: { row: 3, column: 1 }, initialState: "ready" });
  const overlay = useLayoutTakeover({
    open: isOpen,
    onOpenChange: setIsOpen,
    focus: "preserve",
    regions: [
      {
        id: "picker-results",
        title: "Systems",
        rect: { row: 1, column: 1, rows: 1, columns: 4 },
        render: ({ close }) => <button onClick={close}>Close picker</button>,
      },
    ],
  });
  return (
    <SpatialPluginGrid
      workspace={workspace}
      overlay={overlay}
      overlayFocus="preserve"
    />
  );
}

it("preserve mode leaves focus on retained active content when the takeover opens", () => {
  const { rerender } = render(<PreserveHarness open={false} />);
  screen.getByRole("button", { name: "Send" }).focus();
  rerender(<PreserveHarness open />);
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Send" }),
  );
});

it("preserve mode still rescues focus that the takeover newly covers", () => {
  function CoveredPreserveHarness({ open }: { open: boolean }) {
    const [isOpen, setIsOpen] = useState(open);
    useEffect(() => setIsOpen(open), [open]);
    const workspace = defineWorkspace(defaultGrid).place(status, {
      anchor: { row: 1, column: 1 },
      initialState: "ready",
    });
    const overlay = useLayoutTakeover({
      open: isOpen,
      onOpenChange: setIsOpen,
      focus: "preserve",
      regions: [
        {
          id: "picker-results",
          title: "Systems",
          rect: { row: 1, column: 1, rows: 1, columns: 4 },
          render: () => <button>Card</button>,
        },
      ],
    });
    return (
      <SpatialPluginGrid
        workspace={workspace}
        overlay={overlay}
        overlayFocus="preserve"
      />
    );
  }
  const { rerender } = render(<CoveredPreserveHarness open={false} />);
  screen.getByText("Count 0").focus();
  rerender(<CoveredPreserveHarness open />);
  expect(screen.getByRole("region", { name: "Status" }).inert).toBe(true);
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Card" }),
  );
});

it("preserve mode still restores the opener on close", () => {
  function ClickToOpenPreserveHarness() {
    const [open, setOpen] = useState(false);
    const overlay = useLayoutTakeover({
      open,
      onOpenChange: setOpen,
      focus: "preserve",
      regions: [
        {
          id: "picker-results",
          title: "Systems",
          rect: { row: 1, column: 1, rows: 1, columns: 4 },
          render: ({ close }) => <button onClick={close}>Close picker</button>,
        },
      ],
    });
    return (
      <>
        <button onClick={() => setOpen(true)} data-testid="trigger">
          Open picker
        </button>
        <SpatialPluginGrid overlay={overlay} overlayFocus="preserve" />
      </>
    );
  }
  render(<ClickToOpenPreserveHarness />);
  const trigger = screen.getByTestId("trigger");
  trigger.focus();
  fireEvent.click(trigger);
  fireEvent.click(screen.getByText("Close picker"));
  expect(document.activeElement).toBe(trigger);
});

it("rejects a region id that collides with an existing plugin", () => {
  function Colliding() {
    const workspace = defineWorkspace(defaultGrid).place(status, {
      anchor: { row: 2, column: 2 },
      initialState: "ready",
    });
    const overlay = useLayoutTakeover({
      open: true,
      onOpenChange: () => {},
      regions: [
        {
          id: "status",
          title: "Systems",
          rect: { row: 1, column: 1, rows: 1, columns: 1 },
          render: () => null,
        },
      ],
    });
    return <SpatialPluginGrid workspace={workspace} overlay={overlay} />;
  }
  expect(() => render(<Colliding />)).toThrow("Duplicate plugin id: status");
});

it("rejects duplicate region ids within one takeover", () => {
  function Colliding() {
    const overlay = useLayoutTakeover({
      open: true,
      onOpenChange: () => {},
      regions: [
        {
          id: "same",
          title: "A",
          rect: { row: 1, column: 1, rows: 1, columns: 1 },
          render: () => null,
        },
        {
          id: "same",
          title: "B",
          rect: { row: 2, column: 2, rows: 1, columns: 1 },
          render: () => null,
        },
      ],
    });
    return <SpatialPluginGrid overlay={overlay} />;
  }
  expect(() => render(<Colliding />)).toThrow(
    "Duplicate takeover region id: same",
  );
});
