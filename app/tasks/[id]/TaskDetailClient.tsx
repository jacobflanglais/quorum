"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  Check,
  Clock,
  Edit3,
  ExternalLink,
  Loader2,
  Mail,
  Pause,
  Play,
  Play as PlayIcon,
  Trash2,
  X,
} from "lucide-react"
import { formatDistanceToNowStrict } from "date-fns"
import { humanize, SCHEDULE_PRESETS } from "@/lib/scheduler/cron"
import { TagInput } from "@/components/app/TagInput"
import type {
  ScheduledTask,
  ScheduledTaskRunDetail,
} from "@/lib/scheduler/types"

interface Props {
  initialTask: ScheduledTask
  initialRuns: ScheduledTaskRunDetail[]
}

export function TaskDetailClient({ initialTask, initialRuns }: Props) {
  const router = useRouter()
  const [task, setTask] = useState(initialTask)
  const [runs, setRuns] = useState(initialRuns)
  const [editing, setEditing] = useState(false)
  const [runningNow, setRunningNow] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggleEnabled() {
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: !task.enabled }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setTask(data.task)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Toggle failed")
    } finally {
      setPending(false)
    }
  }

  async function deleteTask() {
    if (!confirm(`Delete "${task.name}" and all its run history?`)) return
    setPending(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      router.push("/tasks")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed")
      setPending(false)
    }
  }

  async function runNow() {
    if (!confirm("Run this task now? It will count toward your cost budget.")) return
    setRunningNow(true)
    setError(null)
    try {
      const res = await fetch(`/api/tasks/${task.id}/run`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)

      // Refresh the runs list
      const detailRes = await fetch(`/api/tasks/${task.id}`)
      const detailData = await detailRes.json()
      if (detailRes.ok) {
        setTask(detailData.task)
        setRuns(detailData.runs)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed")
    } finally {
      setRunningNow(false)
    }
  }

  async function saveEdit(patch: Partial<ScheduledTask>) {
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setTask(data.task)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setPending(false)
    }
  }

  return (
    <div>
      <h1 className="mt-6 font-display text-4xl tracking-tight text-foreground">
        {task.name}
      </h1>
      {task.description && (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fg-muted">
          {task.description}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          {humanize(task.schedule_cron)} · {task.timezone}
        </span>
        {task.notify_email && (
          <span className="inline-flex items-center gap-1.5">
            <Mail className="h-3 w-3" />
            Email on completion
          </span>
        )}
        {task.tags.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-fg-ghost">·</span>
            {task.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex rounded-md border border-border bg-surface px-2 py-0.5 text-fg-muted"
              >
                {tag}
              </span>
            ))}
          </span>
        )}
        {task.next_run_at && task.enabled && (
          <span>
            Next ·{" "}
            {formatDistanceToNowStrict(new Date(task.next_run_at), {
              addSuffix: true,
            })}
          </span>
        )}
        {!task.enabled && <span className="text-warning">Paused</span>}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-md border border-critical/30 bg-critical/5 p-3 text-sm text-foreground"
        >
          {error}
        </div>
      )}

      {/* Action bar */}
      <div className="mt-8 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={runNow}
          disabled={runningNow || pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-accent-muted/50 bg-accent-subtle px-4 font-mono text-[10px] uppercase tracking-widest text-primary transition-colors hover:bg-accent-muted/20 disabled:opacity-50"
        >
          {runningNow ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <PlayIcon className="h-3 w-3" />
          )}
          Run now
        </button>
        <button
          type="button"
          onClick={toggleEnabled}
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-4 font-mono text-[10px] uppercase tracking-widest text-fg-muted transition-colors hover:text-foreground disabled:opacity-50"
        >
          {task.enabled ? (
            <Pause className="h-3 w-3" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          {task.enabled ? "Pause" : "Resume"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(!editing)}
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-4 font-mono text-[10px] uppercase tracking-widest text-fg-muted transition-colors hover:text-foreground disabled:opacity-50"
        >
          <Edit3 className="h-3 w-3" />
          {editing ? "Cancel edit" : "Edit"}
        </button>
        <button
          type="button"
          onClick={deleteTask}
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-4 font-mono text-[10px] uppercase tracking-widest text-fg-muted transition-colors hover:border-critical/40 hover:text-critical disabled:opacity-50"
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </button>
      </div>

      {/* Prompt or edit form */}
      <div className="mt-12">
        {editing ? (
          <EditForm task={task} onSave={saveEdit} onCancel={() => setEditing(false)} pending={pending} />
        ) : (
          <PromptDisplay prompt={task.prompt} />
        )}
      </div>

      {/* Run history */}
      <div className="mt-16">
        <SectionHeader label="Run history" title="What the council has answered" />
        {runs.length === 0 ? (
          <p className="text-sm leading-relaxed text-fg-muted">
            No runs yet. Hit <em>Run now</em> to trigger immediately, or wait
            for the next scheduled fire.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {runs.map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function PromptDisplay({ prompt }: { prompt: string }) {
  return (
    <div>
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-muted">
        Prompt
      </p>
      <div className="rounded-lg border border-border bg-surface p-5">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {prompt}
        </p>
      </div>
    </div>
  )
}

function RunRow({ run }: { run: ScheduledTaskRunDetail }) {
  const isOk = run.status === "completed"
  const isFail = run.status === "failed"

  return (
    <li className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <StatusBadge status={run.status} />
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
            {formatDistanceToNowStrict(new Date(run.ran_at), {
              addSuffix: true,
            })}
          </p>
          {isOk && run.recommendation && (
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-foreground">
              {run.recommendation}
            </p>
          )}
          {isFail && run.error && (
            <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-critical">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {run.error}
            </p>
          )}
          {run.confidence && (
            <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
              Confidence · {run.confidence}
            </p>
          )}
        </div>
        {run.council_query_id && (
          <Link
            href={`/?q=${run.council_query_id}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 font-mono text-[10px] uppercase tracking-widest text-fg-muted transition-colors hover:text-foreground"
          >
            View
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
    </li>
  )
}

function StatusBadge({ status }: { status: "pending" | "completed" | "failed" }) {
  const styles =
    status === "completed"
      ? "border-success/40 text-success"
      : status === "failed"
        ? "border-critical/40 text-critical"
        : "border-warning/40 text-warning"
  return (
    <span
      className={`mt-0.5 inline-flex shrink-0 rounded-md border ${styles} bg-background px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest`}
    >
      {status}
    </span>
  )
}

function EditForm({
  task,
  onSave,
  onCancel,
  pending,
}: {
  task: ScheduledTask
  onSave: (patch: Partial<ScheduledTask>) => Promise<void>
  onCancel: () => void
  pending: boolean
}) {
  const [name, setName] = useState(task.name)
  const [description, setDescription] = useState(task.description ?? "")
  const [prompt, setPrompt] = useState(task.prompt)
  const [cron, setCron] = useState(task.schedule_cron)
  const [timezone, setTimezone] = useState(task.timezone)
  const [tags, setTags] = useState<string[]>(task.tags ?? [])
  const [searchEnabled, setSearchEnabled] = useState(task.search_enabled ?? false)
  const [deepResearch, setDeepResearch] = useState(
    task.deep_research_enabled ?? false,
  )
  const [notifyEmail, setNotifyEmail] = useState(task.notify_email)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    await onSave({
      name: name.trim(),
      description: description.trim() || null,
      prompt: prompt.trim(),
      schedule_cron: cron.trim(),
      timezone: timezone.trim(),
      tags,
      search_enabled: searchEnabled,
      deep_research_enabled: deepResearch && searchEnabled,
      notify_email: notifyEmail,
    })
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-border bg-surface p-6">
      <p className="mb-6 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-muted">
        Edit task
      </p>

      <div className="grid gap-5">
        <FormField label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={pending}
            maxLength={100}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </FormField>

        <FormField label="Description">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={pending}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </FormField>

        <FormField label="Prompt">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            disabled={pending}
            className="w-full resize-none rounded-md border border-border bg-background p-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </FormField>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Cron (5 fields)">
            <input
              value={cron}
              onChange={(e) => setCron(e.target.value)}
              disabled={pending}
              className="h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
              {humanize(cron)}
            </p>
          </FormField>
          <FormField label="Timezone">
            <input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              disabled={pending}
              className="h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </FormField>
        </div>

        <FormField label="Tags">
          <TagInput
            value={tags}
            onChange={setTags}
            disabled={pending}
            placeholder="Add topics…"
          />
          <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
            Used on /briefings to filter the archive
          </p>
        </FormField>

        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-background p-3">
          <input
            type="checkbox"
            checked={searchEnabled}
            onChange={(e) => setSearchEnabled(e.target.checked)}
            disabled={pending}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-primary"
          />
          <span className="flex-1">
            <span className="block text-sm text-foreground">
              Search the web before each run
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-fg-muted">
              Fetches current sources via Tavily and grounds the council on
              them — best for current-events prompts.
            </span>
          </span>
        </label>

        <label
          className={
            searchEnabled
              ? "flex cursor-pointer items-start gap-3 rounded-md border border-border bg-background p-3"
              : "flex items-start gap-3 rounded-md border border-border bg-background p-3 opacity-50"
          }
        >
          <input
            type="checkbox"
            checked={deepResearch && searchEnabled}
            onChange={(e) => setDeepResearch(e.target.checked)}
            disabled={pending || !searchEnabled}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-primary disabled:cursor-not-allowed"
          />
          <span className="flex-1">
            <span className="block text-sm text-foreground">
              Deep research mode
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-fg-muted">
              Full-page extraction of top sources after search — voices reason
              over actual article text instead of snippets. Adds ~$0.02 + extra
              latency per run.
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-background p-3">
          <input
            type="checkbox"
            checked={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.checked)}
            disabled={pending}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-primary"
          />
          <span className="flex-1">
            <span className="block text-sm text-foreground">
              Email me when this task runs
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-fg-muted">
              Synthesis digest with the recommendation, main caveat, and blind
              spots.
            </span>
          </span>
        </label>

        <details className="rounded border border-border bg-background p-3 text-xs text-fg-muted">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest">
            Common cron patterns
          </summary>
          <ul className="mt-2 flex flex-col gap-1 font-mono">
            {SCHEDULE_PRESETS.map((p) => (
              <li key={p.id}>
                <code>{p.buildCron(7, 0)}</code> — {p.label} at 07:00
              </li>
            ))}
          </ul>
        </details>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="inline-flex h-9 items-center rounded-md border border-border px-4 font-mono text-[10px] uppercase tracking-widest text-fg-muted hover:text-foreground"
          >
            <X className="mr-1.5 h-3 w-3" />
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-accent-muted/50 bg-accent-subtle px-4 font-mono text-[10px] uppercase tracking-widest text-primary disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            Save
          </button>
        </div>
      </div>
    </form>
  )
}

function FormField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 block font-mono text-[10px] uppercase tracking-widest text-fg-muted">
        {label}
      </span>
      {children}
    </label>
  )
}

function SectionHeader({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-fg-ghost">
        {label}
      </p>
      <h2 className="mt-2 font-display text-2xl tracking-tight text-foreground">
        {title}
      </h2>
    </div>
  )
}
