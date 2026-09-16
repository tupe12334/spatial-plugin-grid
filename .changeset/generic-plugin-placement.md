---
"spatial-plugin-grid": minor
---

Replace the special-cased grid API with plugin-defined named states, footprints, transitions, four anchor alignments and all-state placement validation. The default grid is empty; register the conversation through createAgentPlugin, with any of six compatible bottom pairs. Add static region/minimum checks, Zod-backed dynamic validation, shared overlay/pinning behavior and non-agent examples.

Breaking pre-1.0 migration: SpatialPluginGrid now takes workspace instead of plugins/mainStage. Use definePlugin and defineWorkspace, transitionTo/reset and per-placement state/pin callbacks. AgentWorkspace/GroupedPluginDefinition opt into the historical grouped preset through the same engine. Preserve conversation scrolling, reduced motion, composer anchoring and committed pin guards. See docs/plugin-placement.md.
