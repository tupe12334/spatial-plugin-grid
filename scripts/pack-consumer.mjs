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
          "@tupe12334/spatial-plugin-grid": `file:./${archive}`,
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
      `import {SpatialPluginGrid, MainStage, geometry, type PluginDefinition} from '@tupe12334/spatial-plugin-grid';\nimport '@tupe12334/spatial-plugin-grid/styles.css';\nconst plugins: PluginDefinition[] = [{id:'consumer',title:'Consumer',home:'11',allowedSizes:['1x1'],render:({size})=><p>{size}</p>}];\nexport const app=<SpatialPluginGrid plugins={plugins} onStageLockedChange={(locked:boolean)=>{}} mainStage={{composer:({locked,setLocked,setExpanded})=><button onClick={()=>{setLocked(!locked);setExpanded(false);}}>Lock</button>}}/>;\nexport const stage=<MainStage expanded={false} onExpandedChange={()=>{}} locked={true} onLockedChange={(locked:boolean)=>{}} transcript={({locked,expanded,setLocked})=><button onClick={()=>setLocked(false)}>{String(locked && expanded)}</button>}/>;\nimport {createRoot} from 'react-dom/client';\nconst root = document.getElementById('root');\nif (root) createRoot(root).render(app);\nconsole.log(geometry('34','1x2'));`,
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
    ]);
    run("node", [
      "--input-type=module",
      "-e",
      "import {SpatialPluginGrid,geometry} from '@tupe12334/spatial-plugin-grid'; if(typeof SpatialPluginGrid !== 'function' || geometry('31','1x2').row !== 2) throw Error('Invalid package import'); console.log('ESM import passed');",
    ]);
    run("pnpm", ["exec", "vite", "build"]);
    console.log(
      `Packed consumer React ${reactVersion}: compile, ESM import, CSS export and browser bundle passed`,
    );
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
