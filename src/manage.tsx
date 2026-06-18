import { useCallback, useEffect, useState } from "react";
import {
  Action,
  ActionPanel,
  Alert,
  Color,
  confirmAlert,
  Detail,
  Icon,
  Image,
  Keyboard,
  List,
  showToast,
  Toast,
} from "@raycast/api";
import {
  Task,
  TaskStatus,
  cleanupFinished,
  getLog,
  listTasks,
  restartTask,
  stopTask,
} from "./ghost";

function statusIcon(status: TaskStatus): Image.ImageLike {
  switch (status) {
    case "running":
      return { source: Icon.CircleFilled, tintColor: Color.Green };
    case "exited":
      return { source: Icon.CircleFilled, tintColor: Color.SecondaryText };
    case "killed":
      return { source: Icon.CircleFilled, tintColor: Color.Red };
    default:
      return { source: Icon.Circle, tintColor: Color.SecondaryText };
  }
}

function LogView({ task }: { task: Task }) {
  const [log, setLog] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getLog(task.id)
      .then((l) => setLog(l.trim() || "(ログは空です)"))
      .catch((e) => setLog(`ログの取得に失敗しました:\n\n${String(e)}`))
      .finally(() => setIsLoading(false));
  }, [task.id]);

  return (
    <Detail
      isLoading={isLoading}
      navigationTitle={task.command}
      markdown={"```\n" + log + "\n```"}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Status" text={task.status} />
          <Detail.Metadata.Label title="PID" text={task.pid} />
          <Detail.Metadata.Label title="Started" text={task.started} />
          <Detail.Metadata.Label title="Directory" text={task.directory} />
          <Detail.Metadata.Label title="Task ID" text={task.id} />
        </Detail.Metadata>
      }
    />
  );
}

export default function Command() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [runningOnly, setRunningOnly] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const t = await listTasks(runningOnly ? "running" : undefined);
      setTasks(t);
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: "一覧の取得に失敗しました",
        message: String(e),
      });
    } finally {
      setIsLoading(false);
    }
  }, [runningOnly]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStop(task: Task, force: boolean) {
    await showToast({ style: Toast.Style.Animated, title: `停止中: ${task.command}` });
    try {
      await stopTask(task.id, force);
      await showToast({ style: Toast.Style.Success, title: "停止しました" });
      await load();
    } catch (e) {
      await showToast({ style: Toast.Style.Failure, title: "停止に失敗しました", message: String(e) });
    }
  }

  async function handleRestart(task: Task) {
    await showToast({ style: Toast.Style.Animated, title: `再起動中: ${task.command}` });
    try {
      await restartTask(task);
      await showToast({ style: Toast.Style.Success, title: "再起動しました" });
      await load();
    } catch (e) {
      await showToast({ style: Toast.Style.Failure, title: "再起動に失敗しました", message: String(e) });
    }
  }

  async function handleCleanup() {
    const ok = await confirmAlert({
      title: "終了済みタスクを削除しますか？",
      message: "ghost cleanup を実行します（exited / killed が対象）",
      primaryAction: { title: "削除", style: Alert.ActionStyle.Destructive },
    });
    if (!ok) return;
    try {
      await cleanupFinished();
      await showToast({ style: Toast.Style.Success, title: "クリーンアップしました" });
      await load();
    } catch (e) {
      await showToast({ style: Toast.Style.Failure, title: "クリーンアップに失敗しました", message: String(e) });
    }
  }

  const runningCount = tasks.filter((t) => t.status === "running").length;

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="プロセスを検索"
      navigationTitle={`Ghost — ${runningCount} running`}
    >
      <List.EmptyView
        icon={Icon.Power}
        title={runningOnly ? "実行中のプロセスはありません" : "プロセスがありません"}
      />
      {tasks.map((task) => (
        <List.Item
          key={task.id}
          icon={statusIcon(task.status)}
          title={task.command}
          subtitle={task.directory}
          accessories={[
            { tag: { value: task.status, color: task.status === "running" ? Color.Green : Color.SecondaryText } },
            { text: `PID ${task.pid}` },
            { text: task.started },
          ]}
          actions={
            <ActionPanel>
              <ActionPanel.Section>
                <Action.Push title="ログを表示" icon={Icon.Text} target={<LogView task={task} />} />
                <Action
                  title="再起動"
                  icon={Icon.RotateClockwise}
                  shortcut={{ modifiers: ["cmd"], key: "return" }}
                  onAction={() => handleRestart(task)}
                />
                {task.status === "running" && (
                  <Action
                    title="停止 (SIGTERM)"
                    icon={Icon.Stop}
                    style={Action.Style.Destructive}
                    onAction={() => handleStop(task, false)}
                  />
                )}
                {task.status === "running" && (
                  <Action
                    title="強制停止 (SIGKILL)"
                    icon={Icon.XMarkCircle}
                    style={Action.Style.Destructive}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "x" }}
                    onAction={() => handleStop(task, true)}
                  />
                )}
              </ActionPanel.Section>
              <ActionPanel.Section>
                <Action.CopyToClipboard
                  title="Task ID をコピー"
                  content={task.id}
                  shortcut={Keyboard.Shortcut.Common.Copy}
                />
                <Action.ShowInFinder title="作業ディレクトリを開く" path={task.directory} />
              </ActionPanel.Section>
              <ActionPanel.Section>
                <Action
                  title="再読み込み"
                  icon={Icon.ArrowClockwise}
                  shortcut={Keyboard.Shortcut.Common.Refresh}
                  onAction={load}
                />
                <Action
                  title={runningOnly ? "すべて表示" : "実行中のみ表示"}
                  icon={Icon.Filter}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "f" }}
                  onAction={() => setRunningOnly((v) => !v)}
                />
                <Action
                  title="終了済みを削除 (cleanup)"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  shortcut={{ modifiers: ["cmd"], key: "backspace" }}
                  onAction={handleCleanup}
                />
              </ActionPanel.Section>
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
