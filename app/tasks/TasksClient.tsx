"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  Clock,
  Loader2,
  Pause,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react"
import { formatDistanceToNowStrict } from "date-fns"
import { humanize, SCHEDULE_PRESETS } from "@/lib/scheduler/cron"
import { TagInput } from "@/components/app/TagInput"
import type { ScheduledTask } from "@/lib/scheduler/types"

interface TasksClientProps {
  initialTasks: ScheduledTask[]
}

export function TasksClient({ initialTasks }: TasksClientProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [creating, setCreating] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function createTask(input: NewTaskInput) {
    setError(null)
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const data = (await res.json()) as { task: ScheduledTask }
      setTasks((t) => [data.task, ...t])
      setCreating(false)
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err))
    }
  }

  async function toggleEnabled(task: ScheduledTask) {
    setPendingId(task.id)
    setError(null)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: !task.enabled }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const data = (await res.json()) as { task: ScheduledTask }
      setTasks((arr) => arr.map((t) => (t.id === task.id ? data.task : t)))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Toggle failed")
    } finally {
      setPendingId(null)
    }
  }

  async function deleteTask(task: ScheduledTask) {
    if (!confirm(`Delete "${task.name}" and all its run history?`)) return
    setPendingId(task.id)
    setError(null)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      setTasks((arr) => arr.filter((t) => t.id !== task.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div
          role="alert"
          className="rounded-md border border-critical/30 bg-critical/5 p-3 text-sm text-foreground"
        >
          {error}
        </div>
      )}

      {!creating && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="group inline-flex h-11 items-center gap-2 self-start rounded-md border border-accent-muted/50 bg-accent-subtle px-5 text-sm font-medium text-primary transition-colors hover:bg-accent-muted/20"
        >
          <Plus className="h-4 w-4" />
          New task
        </button>
      )}

      {creating && (
        <NewTaskForm
          onSubmit={createTask}
          onCancel={() => setCreating(false)}
        />
      )}

      {tasks.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="flex flex-col gap-3">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              pending={pendingId === task.id}
              onToggle={() => toggleEnabled(task)}
              onDelete={() => deleteTask(task)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface/40 p-10 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-muted">
        Empty
      </p>
      <p className="mt-4 font-display text-xl text-foreground">
        Set your first scheduled task.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-fg-muted">
        Examples: a 7am AI industry briefing, a Sunday-evening week-ahead
        planning prompt, a daily check-in on whatever you&rsquo;re tracking.
      </p>
    </div>
  )
}

function TaskRow({
  task,
  pending,
  onToggle,
  onDelete,
}: {
  task: ScheduledTask
  pending: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <li className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <Link
            href={`/tasks/${task.id}`}
            className="block font-display text-xl tracking-tight text-foreground hover:underline"
          >
            {task.name}
          </Link>
          {task.description && (
            <p className="mt-1 text-sm text-fg-muted">{task.description}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              {humanize(task.schedule_cron)} · {task.timezone}
            </span>
            {task.next_run_at && task.enabled && (
              <span>
                Next ·{" "}
                {formatDistanceToNowStrict(new Date(task.next_run_at), {
                  addSuffix: true,
                })}
              </span>
            )}
            {task.last_run_at && (
              <span>
                Last ·{" "}
                {formatDistanceToNowStrict(new Date(task.last_run_at), {
                  addSuffix: true,
                })}
              </span>
            )}
            {!task.enabled && (
              <span className="text-warning">Paused</span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label={task.enabled ? "Pause task" : "Resume task"}
            onClick={onToggle}
            disabled={pending}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-fg-muted transition-colors hover:text-foreground disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : task.enabled ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            aria-label="Delete task"
            onClick={onDelete}
            disabled={pending}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-fg-muted transition-colors hover:border-critical/40 hover:text-critical disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <Link
            href={`/tasks/${task.id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 font-mono text-[10px] uppercase tracking-widest text-fg-muted transition-colors hover:text-foreground"
          >
            Open
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </li>
  )
}

// ── new task form ───────────────────────────────────────────

interface NewTaskInput {
  name: string
  description: string | null
  prompt: string
  schedule_cron: string
  timezone: string
  tags: string[]
  search_enabled: boolean
  notify_email: boolean
}

function NewTaskForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (input: NewTaskInput) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [prompt, setPrompt] = useState("")
  const [presetId, setPresetId] = useState<string>("daily")
  const [hour, setHour] = useState(7)
  const [minute, setMinute] = useState(0)
  const [customCron, setCustomCron] = useState("")
  const [useCustom, setUseCustom] = useState(false)
  const [timezone, setTimezone] = useState(
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC",
  )
  const [tags, setTags] = useState<string[]>([])
  const [searchEnabled, setSearchEnabled] = useState(false)
  const [notifyEmail, setNotifyEmail] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const preset = SCHEDULE_PRESETS.find((p) => p.id === presetId)
  const schedule_cron = useCustom
    ? customCron.trim()
    : preset?.buildCron(hour, minute) ?? ""

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || null,
        prompt: prompt.trim(),
        schedule_cron,
        timezone,
        tags,
        search_enabled: searchEnabled,
        notify_email: notifyEmail,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create task")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-border bg-surface p-6"
    >
      <div className="mb-6 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-muted">
          New task
        </p>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          aria-label="Cancel"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-muted transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-5">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Morning AI briefing"
            maxLength={100}
            required
            disabled={saving}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-fg-ghost focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </Field>

        <Field label="Description (optional)">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this task tracking?"
            disabled={saving}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-fg-ghost focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </Field>

        <Field label="Question to ask the council">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Summarize today's most important AI industry news, highlight any breakthrough capabilities or concerning trends, and flag what I should pay attention to this week."
            rows={4}
            required
            disabled={saving}
            className="w-full resize-none rounded-md border border-border bg-background p-3 text-sm text-foreground placeholder:text-fg-ghost focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Frequency">
            <select
              value={useCustom ? "custom" : presetId}
              onChange={(e) => {
                if (e.target.value === "custom") {
                  setUseCustom(true)
                } else {
                  setUseCustom(false)
                  setPresetId(e.target.value)
                }
              }}
              disabled={saving}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {SCHEDULE_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
              <option value="custom">Custom cron expression</option>
            </select>
          </Field>

          {!useCustom && (
            <Field label="Time">
              <div className="flex items-center gap-2">
                <select
                  value={hour}
                  onChange={(e) => setHour(parseInt(e.target.value))}
                  disabled={saving}
                  className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {h.toString().padStart(2, "0")}
                    </option>
                  ))}
                </select>
                <span className="font-mono text-fg-muted">:</span>
                <select
                  value={minute}
                  onChange={(e) => setMinute(parseInt(e.target.value))}
                  disabled={saving}
                  className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                >
                  {[0, 15, 30, 45].map((m) => (
                    <option key={m} value={m}>
                      {m.toString().padStart(2, "0")}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
          )}
        </div>

        {useCustom && (
          <Field label="Cron expression (5 fields)">
            <input
              value={customCron}
              onChange={(e) => setCustomCron(e.target.value)}
              placeholder="0 7 * * 1-5"
              disabled={saving}
              className="h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-sm text-foreground placeholder:text-fg-ghost focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </Field>
        )}

        <Field label="Timezone">
          <input
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="America/New_York"
            disabled={saving}
            className="h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </Field>

        {schedule_cron && (
          <p className="font-mono text-[11px] uppercase tracking-widest text-fg-muted">
            Preview · {humanize(schedule_cron)}{" "}
            <span className="text-fg-ghost">({schedule_cron})</span>
          </p>
        )}

        <Field label="Tags (optional)">
          <TagInput
            value={tags}
            onChange={setTags}
            disabled={saving}
            placeholder="Add topics — e.g. AI industry, markets…"
          />
          <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
            Used on /briefings to filter the archive
          </p>
        </Field>

        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-background p-3">
          <input
            type="checkbox"
            checked={searchEnabled}
            onChange={(e) => setSearchEnabled(e.target.checked)}
            disabled={saving}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-primary"
          />
          <span className="flex-1">
            <span className="block text-sm text-foreground">
              Search the web before this task runs
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-fg-muted">
              Tavily fetches top sources for your prompt before the council
              answers — useful for current-events questions. Adds ~$0.005 + a
              few cents in extra tokens per run.
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-background p-3">
          <input
            type="checkbox"
            checked={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.checked)}
            disabled={saving}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-primary"
          />
          <span className="flex-1">
            <span className="block text-sm text-foreground">
              Email me when this task runs
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-fg-muted">
              You&rsquo;ll receive the synthesis as a Quorum-branded digest with
              the recommendation, main caveat, and blind spots.
            </span>
          </span>
        </label>

        {error && (
          <p role="alert" className="text-sm text-critical">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="inline-flex h-9 items-center rounded-md border border-border px-4 font-mono text-[10px] uppercase tracking-widest text-fg-muted hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              saving ||
              !name.trim() ||
              !prompt.trim() ||
              !schedule_cron.trim()
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-accent-muted/50 bg-accent-subtle px-4 font-mono text-[10px] uppercase tracking-widest text-primary disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            Create task
          </button>
        </div>
      </div>
    </form>
  )
}

function Field({
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
