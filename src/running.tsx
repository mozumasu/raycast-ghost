import { useCallback, useEffect, useState } from "react";
import {
  Action,
  ActionPanel,
  Color,
  Detail,
  Icon,
  Keyboard,
  List,
  showToast,
  Toast,
  updateCommandMetadata,
} from "@raycast/api";
import { Task, getLog, listTasks, restartTask, stopTask } from "./ghost";

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

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const t = await listTasks("running");
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
  }, []);

  useEffect(() => {
    load();
    // 過去に updateCommandMetadata でセットされた動的 subtitle を消す
    // （古い情報が Root Search に残ると誤解を招くため）
    updateCommandMetadata({ subtitle: null }).catch(() => {});
  }, [load]);

  async function handleStop(task: Task, force: boolean) {
    await showToast({
      style: Toast.Style.Animated,
      title: `停止中: ${task.command}`,
    });
    try {
      await stopTask(task.id, force);
      await showToast({ style: Toast.Style.Success, title: "停止しました" });
      await load();
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: "停止に失敗しました",
        message: String(e),
      });
    }
  }

  async function handleRestart(task: Task) {
    await showToast({
      style: Toast.Style.Animated,
      title: `再起動中: ${task.command}`,
    });
    try {
      await restartTask(task);
      await showToast({ style: Toast.Style.Success, title: "再起動しました" });
      await load();
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: "再起動に失敗しました",
        message: String(e),
      });
    }
  }

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="起動中プロセスを検索"
      navigationTitle={`Ghost — ${tasks.length} running`}
    >
      <List.EmptyView icon={Icon.Power} title="起動中のプロセスはありません" />
      {tasks.map((task) => (
        <List.Item
          key={task.id}
          icon={{ source: Icon.CircleFilled, tintColor: Color.Green }}
          title={task.command}
          subtitle={task.directory}
          accessories={[{ text: `PID ${task.pid}` }, { text: task.started }]}
          actions={
            <ActionPanel>
              <ActionPanel.Section>
                <Action.Push
                  title="ログを表示"
                  icon={Icon.Text}
                  target={<LogView task={task} />}
                />
                <Action
                  title="再起動"
                  icon={Icon.RotateClockwise}
                  shortcut={{ modifiers: ["cmd"], key: "return" }}
                  onAction={() => handleRestart(task)}
                />
                <Action
                  title="停止 (SIGTERM)"
                  icon={Icon.Stop}
                  style={Action.Style.Destructive}
                  onAction={() => handleStop(task, false)}
                />
                <Action
                  title="強制停止 (SIGKILL)"
                  icon={Icon.XMarkCircle}
                  style={Action.Style.Destructive}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "x" }}
                  onAction={() => handleStop(task, true)}
                />
              </ActionPanel.Section>
              <ActionPanel.Section>
                <Action.CopyToClipboard
                  title="Task ID をコピー"
                  content={task.id}
                  shortcut={Keyboard.Shortcut.Common.Copy}
                />
                <Action.ShowInFinder
                  title="作業ディレクトリを開く"
                  path={task.directory}
                />
              </ActionPanel.Section>
              <ActionPanel.Section>
                <Action
                  title="再読み込み"
                  icon={Icon.ArrowClockwise}
                  shortcut={Keyboard.Shortcut.Common.Refresh}
                  onAction={load}
                />
              </ActionPanel.Section>
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
