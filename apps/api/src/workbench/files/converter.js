import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
const root = fileURLToPath(new URL("../../../../../", import.meta.url));
export async function convertFile({
  bytes,
  mediaType,
  directory,
  officeRoot = process.env.MATERIALS_OFFICE_ROOT,
  timeoutMs = 120000,
  signal,
}) {
  fs.mkdirSync(directory, { recursive: true });
  const work = fs.mkdtempSync(path.join(directory, "conversion-"));
  const input = path.join(work, "input"),
    output = path.join(work, "output");
  fs.mkdirSync(input);
  fs.mkdirSync(output);
  fs.writeFileSync(path.join(input, "source"), bytes, { mode: 0o400 });
  const args = [
    "--die-with-parent",
    "--unshare-all",
    "--new-session",
    "--cap-drop",
    "ALL",
    "--clearenv",
    "--ro-bind",
    "/usr",
    "/usr",
    "--symlink",
    "usr/lib",
    "/lib",
    "--symlink",
    "usr/lib64",
    "/lib64",
    "--symlink",
    "usr/bin",
    "/bin",
    "--proc",
    "/proc",
    "--dev",
    "/dev",
    "--tmpfs",
    "/tmp",
    "--dir",
    "/etc",
    "--ro-bind",
    "/etc/fonts",
    "/etc/fonts",
    "--ro-bind",
    process.execPath,
    "/runtime/node",
    "--ro-bind",
    path.join(root, "node_modules"),
    "/app/node_modules",
    "--ro-bind",
    fileURLToPath(new URL("./conversion-worker.mjs", import.meta.url)),
    "/app/api/worker.mjs",
    "--ro-bind",
    input,
    "/input",
    "--bind",
    output,
    "/output",
    "--setenv",
    "HOME",
    "/output",
    "--setenv",
    "PATH",
    "/usr/bin",
    "--setenv",
    "LANG",
    "C.UTF-8",
    "--setenv",
    "SAL_USE_VCLPLUGIN",
    "svp",
  ];
  const apiModules = path.join(root, "apps/api/node_modules");
  if (fs.existsSync(apiModules))
    args.push("--ro-bind", apiModules, "/app/api/node_modules");
  if (officeRoot) args.push("--ro-bind", path.resolve(officeRoot), "/office");
  args.push(
    "/usr/bin/prlimit",
    "--as=4294967296",
    "--fsize=536870912",
    "--cpu=120",
    "--nofile=256",
    "--",
    "/runtime/node",
    "/app/api/worker.mjs",
    mediaType,
  );
  try {
    await new Promise((resolve, reject) => {
      const child = spawn("/usr/bin/bwrap", args, {
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stderr = "",
        timedOut = false;
      const kill = () => {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {}
      };
      const timer = setTimeout(
        () => {
          timedOut = true;
          kill();
        },
        Math.min(120000, Math.max(1, timeoutMs)),
      );
      const abort = () => kill();
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) kill();
      child.stdout.resume();
      child.stderr.on("data", (chunk) => {
        if (stderr.length < 4000) stderr += chunk;
      });
      child.once("error", reject);
      child.once("close", (code) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        code === 0 && !timedOut && !signal?.aborted
          ? resolve()
          : reject(
              new Error(
                timedOut
                  ? "Conversion deadline exceeded"
                  : `Conversion failed (${code}): ${stderr.slice(0, 2000)}`,
              ),
            );
      });
    });
    const result = JSON.parse(
      fs.readFileSync(path.join(output, "result.json")),
    );
    return {
      ...result,
      pages: result.pages.map((p) => ({
        ...p,
        bytes: fs.readFileSync(path.join(output, p.name)),
      })),
      pdf: result.pdf ? fs.readFileSync(path.join(output, result.pdf)) : null,
    };
  } catch (error) {
    fs.writeFileSync(path.join(work, "failure.txt"), error.message);
    throw error;
  } finally {
    if (fs.existsSync(path.join(output, "result.json")))
      fs.rmSync(work, { recursive: true, force: true });
  }
}
