import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { getPreferenceValues } from "@raycast/api";

const execFileAsync = promisify(execFile);

export type TaskStatus = "running" | "exited" | "killed" | string;

export interface Task {
  id: string;
  pid: string;
  status: TaskStatus;
  started: string;
  command: string;
  directory: string;
}

interface Prefs {
  ghostPath?: string;
  watchCommand?: string;
  startCommand?: string;
}

export function getPrefs(): Prefs {
  return getPreferenceValues<Prefs>();
}

function currentUser(): string {
  return process.env.USER ?? userInfo().username;
}

// Raycast spawns processes with a minimal PATH. Enrich it so both ghost itself
// and the child commands it launches (e.g. plamo-translate) resolve.
function enrichedEnv(): NodeJS.ProcessEnv {
  const home = homedir();
  const extra = [
    `${home}/.local/bin`,
    `${home}/.nix-profile/bin`,
    `/etc/profiles/per-user/${currentUser()}/bin`,
    "/run/current-system/sw/bin",
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
  ];
  const path = [process.env.PATH ?? "", ...extra].filter(Boolean).join(":");
  return { ...process.env, PATH: path };
}

export function resolveGhostPath(): string {
  const { ghostPath } = getPrefs();
  if (ghostPath && ghostPath.trim() && existsSync(ghostPath.trim())) {
    return ghostPath.trim();
  }
  const home = homedir();
  const candidates = [
    `/etc/profiles/per-user/${currentUser()}/bin/ghost`,
    `${home}/.nix-profile/bin/ghost`,
    "/run/current-system/sw/bin/ghost",
    "/opt/homebrew/bin/ghost",
    "/usr/local/bin/ghost",
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return "ghost"; // last resort: rely on PATH lookup
}

async function ghost(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(resolveGhostPath(), args, {
    env: enrichedEnv(),
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout;
}

// ghost list has no JSON output, so parse the fixed-width table using the
// header label positions (column widths are dynamic depending on content).
export function parseList(out: string): Task[] {
  const lines = out.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headerIdx = lines.findIndex((l) => l.includes("Task ID") && l.includes("Status"));
  if (headerIdx === -1) return [];
  const header = lines[headerIdx];

  const cols: { key: keyof Task; label: string }[] = [
    { key: "id", label: "Task ID" },
    { key: "pid", label: "PID" },
    { key: "status", label: "Status" },
    { key: "started", label: "Started" },
    { key: "command", label: "Command" },
    { key: "directory", label: "Directory" },
  ];
  const present = cols
    .map((c) => ({ ...c, start: header.indexOf(c.label) }))
    .filter((c) => c.start >= 0)
    .sort((a, b) => a.start - b.start);

  const tasks: Task[] = [];
  for (const line of lines.slice(headerIdx + 1)) {
    if (/^[-\s]+$/.test(line)) continue; // separator row
    const t: Partial<Task> = {};
    for (let i = 0; i < present.length; i++) {
      const start = present[i].start;
      const end = i + 1 < present.length ? present[i + 1].start : line.length;
      t[present[i].key] = line.slice(start, end).trim();
    }
    if (t.id && /^[0-9a-f-]{16,}$/i.test(t.id)) {
      tasks.push(t as Task);
    }
  }
  return tasks;
}

export async function listTasks(statusFilter?: TaskStatus): Promise<Task[]> {
  const args = ["list"];
  if (statusFilter) args.push("--status", statusFilter);
  return parseList(await ghost(args));
}

export async function runCommand(command: string, cwd?: string): Promise<void> {
  const parts = command.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) throw new Error("Start Command が空です");
  const args = ["run"];
  if (cwd) args.push("--cwd", cwd);
  args.push(...parts);
  await ghost(args);
}

export async function stopTask(id: string, force = false): Promise<void> {
  const args = ["stop", id];
  if (force) args.push("--force");
  await ghost(args);
}

export async function getLog(id: string): Promise<string> {
  return ghost(["log", id]);
}

export async function cleanupFinished(): Promise<void> {
  await ghost(["cleanup"]);
}

// ghost に restart は無いため、停止（実行中なら）してから同じ command と
// 作業ディレクトリで再実行する。
export async function restartTask(task: Task): Promise<void> {
  if (task.status === "running") {
    await stopTask(task.id);
  }
  await runCommand(task.command, task.directory);
}

// Prefer a running match; fall back to the most recent matching task.
export function findWatched(tasks: Task[], watch: string): Task | undefined {
  const matches = tasks.filter((t) => t.command.includes(watch));
  return matches.find((t) => t.status === "running") ?? matches[0];
}
