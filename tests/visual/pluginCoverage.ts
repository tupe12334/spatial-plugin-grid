export interface PluginScreenshots {
  plugin: string;
  stories: readonly string[];
}

/** Each reusable plugin owns real Storybook scenarios and their screenshots. */
export const pluginScreenshots: readonly PluginScreenshots[] = [
  {
    plugin: "agent",
    stories: ["21", "22", "23", "31", "32", "33"].map(
      (anchor) => `agentplugin--at-${anchor}`,
    ),
  },
];

export function screenshotPath(
  entry: { story: string; name: string },
  coverage: readonly PluginScreenshots[] = pluginScreenshots,
): string {
  const owner = coverage.find(({ stories }) => stories.includes(entry.story));
  return owner
    ? `plugins/${owner.plugin}/${entry.name}.png`
    : `${entry.name}.png`;
}

export function verifyPluginCoverage(
  plugins: readonly string[],
  storyIds: readonly string[],
  entries: readonly { story: string; name: string }[],
  coverage: readonly PluginScreenshots[] = pluginScreenshots,
): void {
  const owners = new Set<string>();
  const claimed = new Set<string>();
  for (const { plugin, stories } of coverage) {
    if (!/^[a-z0-9-]+$/.test(plugin) || owners.has(plugin))
      throw new Error(`Invalid or duplicate screenshot plugin: ${plugin}`);
    owners.add(plugin);
    if (!plugins.includes(plugin) || stories.length === 0)
      throw new Error(`Missing plugin or screenshot stories: ${plugin}`);
    for (const story of stories) {
      if (claimed.has(story))
        throw new Error(
          `Screenshot story has multiple plugin owners: ${story}`,
        );
      claimed.add(story);
      if (
        !storyIds.includes(story) ||
        !entries.some((entry) => entry.story === story)
      )
        throw new Error(`Missing screenshot coverage for ${plugin}: ${story}`);
    }
  }
  for (const plugin of plugins) {
    if (!owners.has(plugin))
      throw new Error(`Plugin requires screenshot coverage: ${plugin}`);
  }
}
