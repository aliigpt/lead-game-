// Runs the game server and the Vite dev server together.
import { spawn } from "node:child_process";
const run = (args) => spawn("npx", args, { stdio: "inherit", shell: process.platform === "win32" });
const procs = [run(["node", "--watch", "server/index.js"]), run(["vite"])];
const stop = () => { procs.forEach((p) => p.kill()); process.exit(); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
