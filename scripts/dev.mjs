// Runs the authoritative game server and the Vite client together.
import { spawn } from "node:child_process";

const env = { ...process.env, SIKA_DEV_TOOLS: process.env.SIKA_DEV_TOOLS ?? "1" };
const procs = [
  spawn("node", ["--disable-warning=ExperimentalWarning", "--watch", "server/index.ts"], { stdio: "inherit", env }),
  spawn("npx", ["vite"], { stdio: "inherit", env }),
];
const stop = () => procs.forEach((p) => p.kill("SIGTERM"));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
procs.forEach((p) => p.on("exit", (code) => { if (code) { stop(); process.exit(code); } }));
