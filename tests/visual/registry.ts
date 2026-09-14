export const stories = [
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
  "mainstage--populated",
  "mainstage--empty",
  "mainstage--host-render-props",
  "mainstage--appending-transcript",
  "mainstage--resizing-transcript",
];
export const states = [
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
  const names = entries.map((entry) => entry.name.toLowerCase());
  if (new Set(names).size !== names.length)
    throw new Error("Screenshot filename collision");
  if (
    entries.some(
      (entry) => !ids.includes(entry.story) || !/^[a-z0-9-]+$/.test(entry.name),
    )
  )
    throw new Error("Invalid screenshot registry");
}
