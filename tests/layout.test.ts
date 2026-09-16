import { describe, expect, it } from "vitest";
import {
  geometry,
  intersects,
  pluginHomes,
  sizesFor,
  validateRegistry,
} from "../src/presets/groupedLayout";
describe("geometry", () => {
  for (const home of pluginHomes)
    for (const size of sizesFor(home))
      it(`${home} ${size} stays in its group and contains home`, () => {
        const rect = geometry(home, size),
          base = geometry(home, "1x1");
        expect(intersects(rect, base)).toBe(true);
        expect(rect.column).toBeGreaterThanOrEqual(
          Number(home[1]) <= 2 ? 1 : 3,
        );
        expect(rect.column + rect.columns).toBeLessThanOrEqual(
          Number(home[1]) <= 2 ? 3 : 5,
        );
        expect(rect.row + rect.rows).toBeLessThanOrEqual(
          home[0] === "3" ? 4 : 3,
        );
        if (home[0] === "3" && size === "1x2") expect(rect.row).toBe(2);
      });
  it("touching edges do not overlap", () =>
    expect(intersects(geometry("11", "1x1"), geometry("12", "1x1"))).toBe(
      false,
    ));
});
describe("registry", () => {
  const entry = {
    id: "a",
    title: "A",
    home: "11",
    allowedSizes: ["1x1"],
  } as const;
  it("accepts partial and full registries", () => {
    validateRegistry([]);
    validateRegistry(
      pluginHomes.map((home) => ({
        ...entry,
        id: home,
        home,
        allowedSizes: sizesFor(home),
      })),
    );
  });
  it("rejects duplicates", () => {
    expect(() => validateRegistry([entry, { ...entry, home: "12" }])).toThrow(
      "Duplicate plugin id",
    );
    expect(() => validateRegistry([entry, { ...entry, id: "b" }])).toThrow(
      "Duplicate plugin home",
    );
  });
  it("rejects invalid sizes and missing home size", () => {
    expect(() =>
      validateRegistry([
        { ...entry, home: "31", allowedSizes: ["1x1", "2x1"] },
      ]),
    ).toThrow();
    expect(() =>
      validateRegistry([{ ...entry, allowedSizes: ["2x2"] }]),
    ).toThrow();
  });
  it("validates untrusted runtime cells", () => {
    expect(() =>
      validateRegistry(
        JSON.parse(
          '[{"id":"a","title":"A","home":"32","allowedSizes":["1x1"]}]',
        ) as (typeof entry)[],
      ),
    ).toThrow("Invalid plugin home");
  });
});
