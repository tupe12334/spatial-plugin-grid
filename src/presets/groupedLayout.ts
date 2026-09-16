export const pluginHomes = [
  "11",
  "12",
  "13",
  "14",
  "21",
  "22",
  "23",
  "24",
  "31",
  "34",
] as const;
export type PluginHome = (typeof pluginHomes)[number];
export type PluginSize = "1x1" | "2x1" | "1x2" | "2x2";
export interface Rect {
  column: number;
  row: number;
  columns: number;
  rows: number;
}
export interface LayoutPreset {
  readonly name: string;
  readonly navbarHeight: number;
  readonly gap: number;
  readonly padding: number;
}
export const agentWorkspace: LayoutPreset = {
  name: "Agent Workspace",
  navbarHeight: 64,
  gap: 12,
  padding: 12,
};
export function sizesFor(home: PluginHome): readonly PluginSize[] {
  return home[0] === "3" ? ["1x1", "1x2"] : ["1x1", "2x1", "1x2", "2x2"];
}
export function geometry(home: PluginHome, size: PluginSize): Rect {
  if (!pluginHomes.includes(home) || !sizesFor(home).includes(size))
    throw new Error(`Invalid geometry: ${home}/${size}`);
  const row = Number(home[0]),
    column = Number(home[1]);
  const columns = size[0] === "2" ? 2 : 1,
    rows = size[2] === "2" ? 2 : 1;
  return {
    column: columns === 2 ? (column <= 2 ? 1 : 3) : column,
    row: rows === 2 ? (row === 3 ? 2 : 1) : row,
    columns,
    rows,
  };
}
export { intersects } from "../grid/contract";
export interface RegistryEntry {
  readonly id: string;
  readonly title: string;
  readonly home: PluginHome;
  readonly allowedSizes: readonly PluginSize[];
}
export function validateRegistry(entries: readonly RegistryEntry[]): void {
  const ids = new Set<string>(),
    homes = new Set<string>();
  for (const entry of entries) {
    if (!entry.id.trim() || !entry.title.trim())
      throw new Error("Plugin id and title must be nonempty");
    if (ids.has(entry.id)) throw new Error(`Duplicate plugin id: ${entry.id}`);
    if (homes.has(entry.home))
      throw new Error(`Duplicate plugin home: ${entry.home}`);
    if (!pluginHomes.includes(entry.home))
      throw new Error(`Invalid plugin home: ${entry.home}`);
    if (
      !entry.allowedSizes.includes("1x1") ||
      new Set(entry.allowedSizes).size !== entry.allowedSizes.length ||
      entry.allowedSizes.some((size) => !sizesFor(entry.home).includes(size))
    )
      throw new Error(`Invalid allowed sizes: ${entry.id}`);
    ids.add(entry.id);
    homes.add(entry.home);
  }
}
