import { expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { SpatialPluginGrid, useLayoutTakeover } from "../src";

it.each([
  { row: 0, column: 1, rows: 1, columns: 1 },
  { row: 1, column: 1, rows: 4, columns: 1 },
  { row: 1, column: 1.5, rows: 1, columns: 1 },
])("rejects invalid overlay geometry %j", (rect) => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const overlay = useLayoutTakeover({
      open: true,
      onOpenChange() {},
      regions: [{ id: "overlay", title: "Overlay", rect, render: () => null }],
    });
    expect(() => render(<SpatialPluginGrid overlay={overlay} />)).toThrow();
  } finally {
    error.mockRestore();
  }
});
