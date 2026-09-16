// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest";
const { guard, spawnSync } = vi.hoisted(() => ({
  guard: vi.fn(),
  spawnSync: vi.fn(),
}));
vi.mock("../scripts/input-guard.mjs", () => ({
  guard,
  head: () => "checkout-head",
}));
vi.mock("node:child_process", () => ({ spawnSync }));
const runner = "../scripts/validate.mjs";
const { validate } = await import(runner);

afterEach(() => vi.restoreAllMocks());
beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  guard.mockReset();
  spawnSync.mockReset().mockImplementation((_command, args) => ({
    status: 0,
    stdout: args[0] === "--version" ? "9.15.9\n" : "",
  }));
});
test("manual validation guards the same HEAD before and after all gates without reading stdin", () => {
  validate();
  expect(guard.mock.calls).toEqual([["checkout-head"], ["checkout-head"]]);
  expect(guard.mock.invocationCallOrder[0]).toBeLessThan(
    spawnSync.mock.invocationCallOrder[0]!,
  );
  expect(guard.mock.invocationCallOrder[1]).toBeGreaterThan(
    spawnSync.mock.invocationCallOrder.at(-1)!,
  );
  expect(spawnSync.mock.calls.map(([, args]) => args[0])).toEqual([
    "--version",
    "lint",
    "typecheck",
    "test:types",
    "test",
    "build",
    "test:pack",
    "build-storybook",
    "test:browsers",
  ]);
});
test("dirty inputs stop validation before any gate executes", () => {
  guard.mockImplementationOnce(() => {
    throw new Error("dirty inputs");
  });
  expect(() => validate()).toThrow("dirty inputs");
  expect(spawnSync).not.toHaveBeenCalled();
});
test("failed gates still run the final input guard", () => {
  spawnSync.mockImplementation((_command, args) => ({
    status: args[0] === "test" ? 1 : 0,
    stdout: "9.15.9\n",
  }));
  expect(() => validate("pushed-head")).toThrow("test failed");
  expect(guard.mock.calls).toEqual([["pushed-head"], ["pushed-head"]]);
  expect(spawnSync.mock.calls.some(([, args]) => args[0] === "build")).toBe(
    false,
  );
});
test("post-suite dirtiness fails an otherwise successful validation", () => {
  guard
    .mockImplementationOnce(() => {})
    .mockImplementationOnce(() => {
      throw new Error("inputs changed during suite");
    });
  expect(() => validate()).toThrow("inputs changed during suite");
});
