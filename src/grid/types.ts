import type { ReactNode } from "react";

/** Bounded dimensions keep declaration inference fast and errors readable. */
export type Dimension = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type Alignment =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";
export interface Footprint {
  readonly rows: Dimension;
  readonly columns: Dimension;
}
export interface Coordinate {
  readonly row: number;
  readonly column: number;
}
export interface Rectangle extends Coordinate {
  readonly rows: number;
  readonly columns: number;
}
export type States = Readonly<Record<string, Footprint>>;
export type StateName<S extends States> = Extract<keyof S, string>;
export type Transitions<S extends States> = {
  readonly [K in keyof S]: readonly StateName<S>[];
};
export interface PluginContext<N extends string> {
  readonly state: N;
  readonly pinned: boolean;
  transitionTo: (state: N) => void;
  reset: () => void;
  setPinned: (pinned: boolean) => void;
}
export interface PluginDefinition<S extends States, A extends Alignment> {
  readonly id: string;
  readonly title: string;
  readonly layout: {
    readonly anchor: A;
    readonly states: S;
    readonly transitions: Transitions<S>;
    readonly minimum?: Footprint;
  };
  readonly render: (context: PluginContext<StateName<S>>) => ReactNode;
}
export interface GridDefinition<
  R extends readonly Dimension[],
  C extends readonly Dimension[],
> {
  readonly rows: R;
  readonly columns: C;
}
export type Axis =
  | readonly [1]
  | readonly [1, 2]
  | readonly [1, 2, 3]
  | readonly [1, 2, 3, 4]
  | readonly [1, 2, 3, 4, 5]
  | readonly [1, 2, 3, 4, 5, 6]
  | readonly [1, 2, 3, 4, 5, 6, 7]
  | readonly [1, 2, 3, 4, 5, 6, 7, 8];
export interface Region extends Footprint {
  readonly row: Dimension;
  readonly column: Dimension;
}
type Sum<A extends number, B extends number> = [
  ...Tuple<A>,
  ...Tuple<B>,
]["length"] &
  number;
type End<A extends number, B extends number> = [
  ...Tuple<A>,
  ...Tuple<B>,
] extends [unknown, ...infer R]
  ? R["length"]
  : never;
type InAxis<
  Start extends number,
  Span extends number,
  Origin extends number,
  Count extends number,
  Backwards extends boolean,
> = Backwards extends true
  ? LTE<End<Origin, Span>, Start> extends true
    ? LTE<Start, End<Origin, Count>>
    : false
  : LTE<Origin, Start> extends true
    ? LTE<Sum<Start, Span>, Sum<Origin, Count>>
    : false;
type InvalidRegionStates<
  S extends States,
  A extends Alignment,
  P extends Coordinate,
  R extends Region,
> = {
  [K in keyof S]: InAxis<
    P["row"],
    S[K]["rows"],
    R["row"],
    R["rows"],
    A extends `bottom-${string}` ? true : false
  > extends true
    ? InAxis<
        P["column"],
        S[K]["columns"],
        R["column"],
        R["columns"],
        A extends `${string}-right` ? true : false
      > extends true
      ? never
      : K
    : K;
}[keyof S];
type RegionFilter<
  P,
  S extends States,
  A extends Alignment,
  R extends Region | undefined,
> = P extends Coordinate
  ? R extends Region
    ? InvalidRegionStates<S, A, P, R> extends never
      ? P
      : never
    : P
  : never;
export type CompatibleAnchor<
  G extends GridDefinition<Axis, Axis>,
  S extends States,
  A extends Alignment,
  R extends Region | undefined,
> = R extends Region
  ? Fits<
      R["row"],
      R["column"],
      R,
      "top-left",
      G["rows"]["length"],
      G["columns"]["length"]
    > extends true
    ? RegionFilter<ValidAnchor<G, S, A>, S, A, R>
    : never
  : ValidAnchor<G, S, A>;
type InvalidMinimum<S extends States, M extends Footprint> = {
  [K in keyof S]: LTE<M["rows"], S[K]["rows"]> extends true
    ? LTE<M["columns"], S[K]["columns"]> extends true
      ? never
      : K
    : K;
}[keyof S];
export type MinimumCheck<
  S extends States,
  M extends Footprint | undefined,
> = M extends Footprint
  ? InvalidMinimum<S, M> extends never
    ? unknown
    : { readonly minimumViolation: never }
  : unknown;

// Finite lookup, not recursive arithmetic over arbitrary numbers.
type Tuples = {
  0: [];
  1: [...Tuples[0], unknown];
  2: [...Tuples[1], unknown];
  3: [...Tuples[2], unknown];
  4: [...Tuples[3], unknown];
  5: [...Tuples[4], unknown];
  6: [...Tuples[5], unknown];
  7: [...Tuples[6], unknown];
  8: [...Tuples[7], unknown];
  9: [...Tuples[8], unknown];
  10: [...Tuples[9], unknown];
  11: [...Tuples[10], unknown];
  12: [...Tuples[11], unknown];
  13: [...Tuples[12], unknown];
  14: [...Tuples[13], unknown];
  15: [...Tuples[14], unknown];
  16: [...Tuples[15], unknown];
};
type Tuple<N extends number> = N extends keyof Tuples ? Tuples[N] : never;
type LTE<A extends number, B extends number> =
  Tuple<B> extends [...Tuple<A>, ...unknown[]] ? true : false;
type FitsForward<
  Start extends number,
  Span extends number,
  Count extends number,
> = [...Tuple<Start>, ...Tuple<Span>] extends [unknown, ...infer Rest]
  ? LTE<Rest["length"], Count>
  : false;
type Fits<
  R extends number,
  C extends number,
  F extends Footprint,
  A extends Alignment,
  H extends number,
  W extends number,
> = (
  A extends `bottom-${string}`
    ? LTE<F["rows"], R>
    : FitsForward<R, F["rows"], H>
) extends true
  ? A extends `${string}-right`
    ? LTE<F["columns"], C>
    : FitsForward<C, F["columns"], W>
  : false;
type InvalidStates<
  S extends States,
  A extends Alignment,
  R extends number,
  C extends number,
  H extends number,
  W extends number,
> = {
  [K in keyof S]: Fits<R, C, S[K], A, H, W> extends true ? never : K;
}[keyof S];
type ColumnAnchors<
  R extends number,
  C,
  S extends States,
  A extends Alignment,
  H extends number,
  W extends number,
> = C extends number
  ? InvalidStates<S, A, R, C, H, W> extends never
    ? { readonly row: R; readonly column: C }
    : never
  : never;
type RowAnchors<
  R,
  C,
  S extends States,
  A extends Alignment,
  H extends number,
  W extends number,
> = R extends number ? ColumnAnchors<R, C, S, A, H, W> : never;
/** An anchor is admitted only when EVERY state fits, not just the initial state. */
export type ValidAnchor<
  G extends GridDefinition<Axis, Axis>,
  S extends States,
  A extends Alignment,
> = RowAnchors<
  G["rows"][number],
  G["columns"][number],
  S,
  A,
  G["rows"]["length"],
  G["columns"]["length"]
>;
export interface Placement<
  N extends string,
  Anchor extends Coordinate = Coordinate,
> {
  readonly anchor: Anchor;
  readonly initialState: N;
  readonly appearance?: "panel" | "main-stage";
  readonly region?: Rectangle | undefined;
  readonly animate?: boolean;
  readonly onStateChange?: (state: N) => void;
  readonly onPinnedChange?: (pinned: boolean) => void;
}
/** Render-facing normalized instances retain validated closures, not unsafe generic casts. */
export interface PluginInstance {
  readonly id: string;
  readonly title: string;
  readonly initialState: string;
  readonly appearance: "panel" | "main-stage";
  readonly animate: boolean;
  readonly anchor: Coordinate;
  readonly alignment: Alignment;
  readonly rectangles: Readonly<Record<string, Rectangle>>;
  readonly transitions: Readonly<Record<string, readonly string[]>>;
  readonly render: (context: PluginContext<string>) => ReactNode;
  readonly onStateChange: (state: string) => void;
  readonly onPinnedChange: (pinned: boolean) => void;
}
export interface Workspace {
  readonly grid: GridDefinition<Axis, Axis>;
  readonly plugins: readonly PluginInstance[];
}
