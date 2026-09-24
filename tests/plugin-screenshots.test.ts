// @vitest-environment node
import { readdirSync } from "node:fs";
import { expect, test } from "vitest";
import { screenshotPath, verifyPluginCoverage } from "./visual/pluginCoverage";
import {
  states,
  stories,
  verifyBaselines,
  verifyInventory,
} from "./visual/registry";

const entry = { story: "example--ready", name: "example-ready" };
const coverage = [{ plugin: "example", stories: [entry.story] }];

test("every plugin directory has registered screenshots and real PNGs", () => {
  const plugins = readdirSync("src/plugins", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  verifyPluginCoverage(plugins, stories, states);
  verifyBaselines(
    readdirSync("tests/visual/baselines", {
      recursive: true,
      encoding: "utf8",
    }),
  );
});

test("plugin screenshots have owned paths; general UI paths stay unchanged", () => {
  expect(screenshotPath(entry, coverage)).toBe(
    "plugins/example/example-ready.png",
  );
  expect(screenshotPath(entry, [])).toBe("example-ready.png");
});

test("two states of a plugin cannot overwrite the same screenshot", () => {
  const entries = states.map((state) => ({ ...state }));
  const agentStates = entries.filter(
    ({ story }) => story === "agentplugin--at-21",
  );
  expect(agentStates).toHaveLength(2);
  const [first, second] = agentStates;
  if (!first || !second) throw new Error("Agent screenshot fixtures missing");
  second.name = first.name;
  expect(() => verifyInventory(stories, entries)).toThrow(
    `Screenshot filename collision at tests/visual/baselines/plugins/agent/${first.name}.png`,
  );
});

test("a new plugin cannot silently omit screenshots", () => {
  expect(() =>
    verifyPluginCoverage(["example", "new"], [entry.story], [entry], coverage),
  ).toThrow("Plugin requires screenshot coverage: new");
});

test("missing stories, captures and owners fail", () => {
  expect(() =>
    verifyPluginCoverage(["example"], [], [entry], coverage),
  ).toThrow(/Missing screenshot coverage/);
  expect(() =>
    verifyPluginCoverage(["example"], [entry.story], [], coverage),
  ).toThrow(/Missing screenshot coverage/);
  expect(() =>
    verifyPluginCoverage([], [entry.story], [entry], coverage),
  ).toThrow(/Missing plugin/);
  expect(() =>
    verifyPluginCoverage(
      ["example"],
      [],
      [],
      [{ plugin: "example", stories: [] }],
    ),
  ).toThrow(/Missing plugin or screenshot stories/);
});

test("ambiguous and unsafe ownership fails before capture", () => {
  expect(() =>
    verifyPluginCoverage(
      ["example"],
      [entry.story],
      [entry],
      [...coverage, ...coverage],
    ),
  ).toThrow(/duplicate screenshot plugin/);
  expect(() =>
    verifyPluginCoverage(
      ["example", "other"],
      [entry.story],
      [entry],
      [...coverage, { plugin: "other", stories: [entry.story] }],
    ),
  ).toThrow(/multiple plugin owners/);
  expect(() =>
    verifyPluginCoverage(
      ["../outside"],
      [entry.story],
      [entry],
      [{ plugin: "../outside", stories: [entry.story] }],
    ),
  ).toThrow(/Invalid or duplicate/);
});
