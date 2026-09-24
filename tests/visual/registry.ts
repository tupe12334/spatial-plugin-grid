import { screenshotPath } from "./pluginCoverage";

export const stories = [
  ...["21", "22", "23", "31", "32", "33"].map(
    (anchor) => `agentplugin--at-${anchor}`,
  ),
  ...[
    "empty",
    "non-agent-plugins",
    "drag-and-drop",
    "drag-and-drop-rtl",
    "light",
    "narrow-rtl",
    "all-cells",
    "invalid-dynamic-placement",
  ].map((name) => `pluginplacement--${name}`),
  "workspace--reference-workspace",
  "workspace--all-sizes-and-groups",
  "workspace--light",
  "workspace--dark",
  "workspace--empty-stage",
  "workspace--populated-stage",
  "workspace--custom-plugin",
  "workspace--reduced-motion",
  "workspace--narrow",
  "workspace--rtl",
  "workspace--theme-updates",
  "workspace--cleanup",
  "workspace--plugin-failure",
  "mainstage--locked",
  "workspace--pinnable-stage",
  "mainstage--populated",
  "mainstage--empty",
  "mainstage--host-render-props",
  "mainstage--appending-transcript",
  "mainstage--resizing-transcript",
  "actionblock--cards",
  "layouttakeover--systems-picker",
  "layouttakeover--systems-picker-preserve-focus",
];
export const states = [
  ...["compact", "expanded"].map((size) => ({
    story: "pluginplacement--drag-and-drop",
    name: `drop-source-overlap-${size}`,
    action: `drag-overlap-${size}`,
  })),
  {
    story: "pluginplacement--drag-and-drop",
    name: "drop-footprint-compact",
    action: "drag-compact",
  },
  {
    story: "pluginplacement--drag-and-drop",
    name: "drop-footprint-expanded",
    action: "drag-expanded",
  },
  ...["21", "22", "23", "31", "32", "33"].map((anchor) => ({
    story: `agentplugin--at-${anchor}`,
    name: `agentplugin-at${anchor}-expanded`,
    action: "expand",
  })),
  {
    story: "pluginplacement--non-agent-plugins",
    name: "non-agent-chart-detail",
    action: "chart",
  },
  {
    story: "pluginplacement--non-agent-plugins",
    name: "non-agent-inspector-detail",
    action: "inspector",
  },
  {
    story: "workspace--pinnable-stage",
    name: "workspace-pinned-overlap",
    action: "pin-overlap",
  },
  {
    story: "workspace--pinnable-stage",
    name: "workspace-pinned",
    action: "pin",
  },
  ...stories.map((story) => ({ story, name: story, action: "default" })),
  ...["11", "14", "21", "24", "31", "34"].flatMap((home) =>
    (home.startsWith("3") ? ["1x2"] : ["1x2", "2x1", "2x2"]).map((size) => ({
      story: "workspace--all-sizes-and-groups",
      name: `plugin-${home}-${size}`,
      action: `${home}/${size}`,
    })),
  ),
  ...[
    "workspace--reference-workspace",
    "mainstage--populated",
    "mainstage--empty",
    "mainstage--host-render-props",
    "workspace--reduced-motion",
  ].map((story) => ({ story, name: `${story}-expanded`, action: "expand" })),
  {
    story: "workspace--theme-updates",
    name: "theme-updated-light",
    action: "theme",
  },
  {
    story: "workspace--custom-plugin",
    name: "counter-clicked",
    action: "counter",
  },
  {
    story: "mainstage--appending-transcript",
    name: "transcript-appended",
    action: "append",
  },
];
export function verifyInventory(ids: string[], entries = states) {
  const defaults = entries
    .filter((entry) => entry.action === "default")
    .map((entry) => entry.story)
    .sort();
  if (JSON.stringify([...ids].sort()) !== JSON.stringify(defaults))
    throw new Error("Story inventory differs from built Storybook index");
  const paths = new Map<string, string>();
  for (const entry of entries) {
    const path = `tests/visual/baselines/${screenshotPath({ ...entry, name: entry.name.toLowerCase() })}`;
    const previous = paths.get(path);
    if (previous)
      throw new Error(
        `Screenshot filename collision at ${path}: ${previous} and ${entry.story}`,
      );
    paths.set(path, entry.story);
  }
  if (
    entries.some(
      (entry) => !ids.includes(entry.story) || !/^[a-z0-9-]+$/.test(entry.name),
    )
  )
    throw new Error("Invalid screenshot registry");
}

export function verifyBaselines(files: string[]) {
  const expected = states.map((entry) => screenshotPath(entry)).sort();
  const actual = files.filter((name) => name.endsWith(".png")).sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual))
    throw new Error(
      `Missing or extra PNG baselines; use explicit update and review/commit. Missing: ${expected.filter((name) => !actual.includes(name)).join(", ") || "none"}; extra: ${actual.filter((name) => !expected.includes(name)).join(", ") || "none"}`,
    );
}
