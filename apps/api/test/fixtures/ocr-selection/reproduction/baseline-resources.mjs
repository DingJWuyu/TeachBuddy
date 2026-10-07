import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);

export async function sampleResources() {
  const read = filename => fs.readFileSync(filename, "utf8");
  const memory = Object.fromEntries(read("/proc/meminfo").split("\n").filter(Boolean).map(line => {
    const [key, value] = line.split(":");
    return [key, Number(value.trim().split(/\s+/)[0]) * 1024];
  }));
  const swap = Object.fromEntries(read("/proc/vmstat").split("\n").filter(line => /^pswp(in|out) /.test(line)).map(line => {
    const [key, value] = line.split(" "); return [key, Number(value)];
  }));
  const workers = [];
  const processes = [];
  for (const entry of fs.readdirSync("/proc")) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      const command = read(`/proc/${entry}/cmdline`).replaceAll("\0", " ");
      const status = read(`/proc/${entry}/status`);
      const process = { pid: Number(entry), ppid: Number(status.match(/^PPid:\s+(\d+)/m)?.[1] ?? 0) };
      for (const name of ["VmRSS", "VmHWM", "VmSwap"])
        process[name] = Number(status.match(new RegExp(`^${name}:\\s+(\\d+)`, "m"))?.[1] ?? 0) * 1024;
      processes.push(process);
      if (!/python.*\/(?:worker|benchmark-worker)\.py /.test(command)) continue;
      const metrics = {};
      for (const name of ["VmRSS", "VmHWM", "VmSwap"])
        metrics[name] = Number(status.match(new RegExp(`^${name}:\\s+(\\d+)`, "m"))?.[1] ?? 0) * 1024;
      const cgroup = read(`/proc/${entry}/cgroup`).match(/^0::(.+)$/m)?.[1];
      if (cgroup) for (const name of ["memory.current", "memory.peak", "memory.swap.current"])
        try { metrics[name] = Number(read(`/sys/fs/cgroup${cgroup}/${name}`).trim()); } catch {}
      if (cgroup) for (const name of ["memory.max", "memory.swap.max", "memory.events", "memory.swap.events"])
        try { metrics[name] = read(`/sys/fs/cgroup${cgroup}/${name}`).trim(); } catch {}
      workers.push({ pid: Number(entry), cgroup, ...metrics });
    } catch {}
  }
  const { stdout } = await execute("nvidia-smi", [
    "--query-gpu=memory.used,memory.free,utilization.gpu,power.draw,temperature.gpu,clocks.gr,pstate",
    "--format=csv,noheader,nounits",
  ], { timeout: 5000 });
  const ids = new Set(workers.map(worker => worker.pid));
  let changed = true;
  while (changed) {
    changed = false;
    for (const process of processes) if (ids.has(process.ppid) && !ids.has(process.pid)) {
      ids.add(process.pid); changed = true;
    }
  }
  const workerProcesses = processes.filter(process => ids.has(process.pid));
  return { at: new Date().toISOString(), memory, swap, workers, workerProcesses,
    workerRssSumBytes: workerProcesses.reduce((sum, process) => sum + process.VmRSS, 0),
    workerSwapSumBytes: workerProcesses.reduce((sum, process) => sum + process.VmSwap, 0), gpu: stdout.trim() };
}

export function monitorResources(filename) {
  let running = false;
  const sample = async () => {
    if (running) return;
    running = true;
    try { fs.appendFileSync(filename, JSON.stringify(await sampleResources()) + "\n"); }
    catch (error) { fs.appendFileSync(filename, JSON.stringify({ at: new Date().toISOString(), error: error.message }) + "\n"); }
    finally { running = false; }
  };
  const timer = setInterval(sample, 1000);
  sample();
  return async () => { clearInterval(timer); while (running) await new Promise(resolve => setTimeout(resolve, 50)); await sample(); };
}
