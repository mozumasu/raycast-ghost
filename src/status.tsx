import {
  Color,
  Icon,
  LaunchType,
  MenuBarExtra,
  launchCommand,
  openCommandPreferences,
  showHUD,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import {
  Task,
  findWatched,
  getPrefs,
  listTasks,
  restartTask,
  runCommand,
  stopTask,
} from "./ghost";

interface WatchData {
  watched?: Task;
  runningCount: number;
  hasWatch: boolean;
}

export default function Command() {
  const { watchCommand, startCommand } = getPrefs();
  const watch = (watchCommand ?? "").trim();
  const start = (startCommand ?? "").trim();

  const { data, isLoading, revalidate } = useCachedPromise(
    async (): Promise<WatchData> => {
      const tasks = await listTasks();
      return {
        watched: watch ? findWatched(tasks, watch) : undefined,
        runningCount: tasks.filter((t) => t.status === "running").length,
        hasWatch: watch.length > 0,
      };
    },
  );

  const running = data?.watched?.status === "running";

  // Menu bar icon reflects the watched process state at a glance.
  const icon = running
    ? { source: Icon.CircleFilled, tintColor: Color.Green }
    : { source: Icon.Circle, tintColor: Color.SecondaryText };

  // Without a watch target, fall back to showing the running task count.
  const title = data?.hasWatch
    ? undefined
    : data
      ? String(data.runningCount)
      : undefined;

  const tooltip = data?.hasWatch
    ? `${watch}: ${running ? "running" : "stopped"}`
    : `ghost: ${data?.runningCount ?? 0} running`;

  async function handleStart() {
    if (!start) {
      await showHUD("Start Command が未設定です");
      await openCommandPreferences();
      return;
    }
    try {
      await runCommand(start);
      await showHUD(`🚀 起動しました: ${start}`);
      revalidate();
    } catch (e) {
      await showHUD(`起動に失敗しました: ${String(e)}`);
    }
  }

  async function handleStop() {
    const id = data?.watched?.id;
    if (!id) return;
    try {
      await stopTask(id);
      await showHUD("■ 停止しました");
      revalidate();
    } catch (e) {
      await showHUD(`停止に失敗しました: ${String(e)}`);
    }
  }

  async function handleRestart() {
    const task = data?.watched;
    if (!task) return;
    try {
      await restartTask(task);
      await showHUD("🔄 再起動しました");
      revalidate();
    } catch (e) {
      await showHUD(`再起動に失敗しました: ${String(e)}`);
    }
  }

  return (
    <MenuBarExtra
      icon={icon}
      title={title}
      tooltip={tooltip}
      isLoading={isLoading}
    >
      {data?.hasWatch ? (
        <MenuBarExtra.Section title={watch}>
          <MenuBarExtra.Item
            icon={
              running
                ? { source: Icon.CircleFilled, tintColor: Color.Green }
                : { source: Icon.Circle, tintColor: Color.SecondaryText }
            }
            title={running ? "Server: Running" : "Server: Stopped"}
            subtitle={data?.watched ? `PID ${data.watched.pid}` : undefined}
          />
        </MenuBarExtra.Section>
      ) : (
        <MenuBarExtra.Section>
          <MenuBarExtra.Item
            icon={Icon.Dot}
            title={`${data?.runningCount ?? 0} running`}
          />
        </MenuBarExtra.Section>
      )}

      <MenuBarExtra.Section>
        {!running && (
          <MenuBarExtra.Item
            icon={{ source: Icon.Play, tintColor: Color.Green }}
            title="Start Server"
            onAction={handleStart}
          />
        )}
        {running && (
          <MenuBarExtra.Item
            icon={{ source: Icon.Stop, tintColor: Color.Red }}
            title="Stop Server"
            onAction={handleStop}
          />
        )}
        {running && (
          <MenuBarExtra.Item
            icon={Icon.RotateClockwise}
            title="Restart Server"
            onAction={handleRestart}
          />
        )}
        <MenuBarExtra.Item
          icon={Icon.ArrowClockwise}
          title="Refresh"
          onAction={() => revalidate()}
        />
      </MenuBarExtra.Section>

      <MenuBarExtra.Section>
        <MenuBarExtra.Item
          icon={Icon.List}
          title="Manage Processes…"
          onAction={() =>
            launchCommand({ name: "manage", type: LaunchType.UserInitiated })
          }
        />
        <MenuBarExtra.Item
          icon={Icon.Gear}
          title="Configure…"
          onAction={() => openCommandPreferences()}
        />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}
