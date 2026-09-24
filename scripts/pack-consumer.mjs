import { mkdtempSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
const root = resolve(".");
const temporary = mkdtempSync(join(tmpdir(), "spg-consumer-"));
const run = (command, args, cwd = temporary) =>
  execFileSync(command, args, { cwd, stdio: "inherit" });
try {
  run("pnpm", ["pack", "--pack-destination", temporary], root);
  const archive = readdirSync(temporary).find((name) => name.endsWith(".tgz"));
  if (!archive) throw new Error("No packed archive");
  for (const reactVersion of ["18.3.1", "19"]) {
    writeFileSync(
      join(temporary, "package.json"),
      JSON.stringify({
        private: true,
        type: "module",
        packageManager: "pnpm@9.15.9",
        dependencies: {
          "spatial-plugin-grid": `file:./${archive}`,
          react: reactVersion,
          "react-dom": reactVersion,
        },
        devDependencies: {
          typescript: "5.7.3",
          "@types/react": reactVersion === "19" ? "19" : "18",
          "@types/react-dom": reactVersion === "19" ? "19" : "18",
          vite: "^6.0.0",
        },
      }),
    );
    writeFileSync(
      join(temporary, "index.tsx"),
      `import {AgentWorkspace as SpatialPluginGrid, MainStage, geometry, type GroupedPluginDefinition as PluginDefinition} from 'spatial-plugin-grid';\nimport 'spatial-plugin-grid/styles.css';\nconst plugins: PluginDefinition[] = [{id:'consumer',title:'Consumer',home:'11',allowedSizes:['1x1'],render:({size})=><p>{size}</p>}];\nexport const app=<SpatialPluginGrid plugins={plugins} onStageLockedChange={(locked:boolean)=>{}} mainStage={{composer:({locked,setLocked,setExpanded})=><button onClick={()=>{setLocked(!locked);setExpanded(false);}}>Lock</button>}}/>;\nexport const stage=<MainStage expanded={false} onExpandedChange={()=>{}} locked={true} onLockedChange={(locked:boolean)=>{}} transcript={({locked,expanded,setLocked})=><button onClick={()=>setLocked(false)}>{String(locked && expanded)}</button>}/>;\nimport {generic} from './generic';\nexport {generic};\nimport {createRoot} from 'react-dom/client';\nconst root = document.getElementById('root');\nif (root) createRoot(root).render(app);\nconsole.log(geometry('34','1x2'));`,
    );
    writeFileSync(
      join(temporary, "generic.tsx"),
      `
import {SpatialPluginGrid, defaultGrid, definePlugin, defineWorkspace, useLayoutTakeover, ActionBlock, type LayoutTakeoverRegion} from 'spatial-plugin-grid';
import {createAgentPlugin, type AgentPluginOptions} from 'spatial-plugin-grid/plugins/agent';
import {createAgentPlugin as createCatalogAgent, type AgentPluginOptions as CatalogAgentOptions} from 'spatial-plugin-grid/plugins';
const options: AgentPluginOptions = {id:'assistant'};
const catalogOptions: CatalogAgentOptions = {id:'catalog-assistant'};
const catalogAgent = createCatalogAgent(catalogOptions);
const catalogWorkspace = defineWorkspace(defaultGrid).place(catalogAgent,{anchor:{row:3,column:1},initialState:'collapsed'});
export const catalog = <SpatialPluginGrid workspace={catalogWorkspace}/>;
// @ts-expect-error plugin states remain a literal union through the catalog
const invalidCatalog = ()=>defineWorkspace(defaultGrid).place(catalogAgent,{anchor:{row:3,column:1},initialState:'unknown'});
const regions: readonly LayoutTakeoverRegion[] = [{id:'choice',title:'Choice',rect:{row:1,column:1,rows:1,columns:1},render:({close})=><ActionBlock label="Choose" onActivate={close}/>}];
export function TakeoverConsumer(){const overlay=useLayoutTakeover({open:true,onOpenChange:()=>{},regions}); return <SpatialPluginGrid overlay={overlay} presentationStates={{}} onOverlayDismiss={()=>{}}/>;}
const status=definePlugin({id:'status',title:'Status',layout:{anchor:'top-left',states:{ready:{rows:1,columns:1}},transitions:{ready:[]}},render:({state})=><p>{state}</p>});
const agent=createAgentPlugin(options);
const workspace=defineWorkspace(defaultGrid).place(status,{anchor:{row:1,column:4},initialState:'ready'}).place(agent,{anchor:{row:3,column:3},initialState:'collapsed',appearance:'main-stage'});
export const generic=<SpatialPluginGrid workspace={workspace}/>;
export const empty=<SpatialPluginGrid/>;
// @ts-expect-error all-state expansion cannot leave grid
const invalid=()=>defineWorkspace(defaultGrid).place(agent,{anchor:{row:1,column:1},initialState:'collapsed'});
`,
    );
    writeFileSync(
      join(temporary, "index.html"),
      '<div id="root"></div><script type="module" src="/index.tsx"></script>',
    );
    run("pnpm", ["install", "--ignore-workspace", "--no-frozen-lockfile"]);
    run("pnpm", [
      "exec",
      "tsc",
      "--noEmit",
      "--strict",
      "--skipLibCheck",
      "--jsx",
      "react-jsx",
      "--module",
      "ESNext",
      "--moduleResolution",
      "Bundler",
      "--target",
      "ES2022",
      "index.tsx",
      "generic.tsx",
    ]);
    run("node", [
      "--input-type=module",
      "-e",
      `import {readFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';
import ts from 'typescript';
const root = await import('spatial-plugin-grid');
const entries = [
  {specifier: 'spatial-plugin-grid', factory: 'createAgentPlugin'},
  {specifier: 'spatial-plugin-grid/plugins', factory: 'createAgentPlugin'},
  {specifier: 'spatial-plugin-grid/plugins/agent', factory: 'createAgentPlugin'},
  {specifier: 'spatial-plugin-grid/plugins', factory: 'createListPlugin'},
  {specifier: 'spatial-plugin-grid/plugins/list', factory: 'createListPlugin'},
];
for (const {specifier, factory} of entries) {
  const entry = import.meta.resolve(specifier);
  const source = ts.createSourceFile(entry, readFileSync(new URL(entry), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const first = source.statements[0];
  assert(first && ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression) && first.expression.text === 'use client', specifier + ' must begin with a use client directive');
  const api = await import(specifier);
  assert.equal(api[factory], root[factory], specifier + ' must share the same ' + factory + ' factory');
  if (specifier !== 'spatial-plugin-grid') {
    assert(Object.keys(api).includes(factory), specifier + ' must export ' + factory);
  }
  const plugin = api[factory]({id: specifier, title: specifier});
  const workspace = root.defineWorkspace(root.defaultGrid).place(plugin, {anchor:{row:3,column:1},initialState: plugin.layout.states.compact ? 'compact' : 'collapsed'});
  assert(workspace);
  assert.throws(() => root.defineWorkspace(root.defaultGrid).place(plugin, {anchor:{row:1,column:4},initialState: plugin.layout.states.compact ? 'expanded' : 'collapsed'}));
}
await assert.rejects(import('spatial-plugin-grid/plugins/agent/createAgentPlugin'), {code:'ERR_PACKAGE_PATH_NOT_EXPORTED'});
await assert.rejects(import('spatial-plugin-grid/plugins/list/createListPlugin'), {code:'ERR_PACKAGE_PATH_NOT_EXPORTED'});
assert.equal(typeof root.SpatialPluginGrid, 'function');
assert.equal(root.geometry('31','1x2').row, 2);
console.log('All public entries: client boundaries, ESM exports, factory identity and placement validation passed');`,
    ]);
    run("pnpm", ["exec", "vite", "build"]);
    console.log(
      `Packed consumer React ${reactVersion}: compile, ESM import, CSS export and browser bundle passed`,
    );
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
