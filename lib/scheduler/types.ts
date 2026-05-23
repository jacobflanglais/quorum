export interface ScheduledTask {
  id: string
  user_id: string
  name: string
  description: string | null
  prompt: string
  schedule_cron: string
  timezone: string
  tags: string[]
  enabled: boolean
  next_run_at: string | null
  last_run_at: string | null
  created_at: string
  updated_at: string
}

export interface ScheduledTaskRun {
  id: string
  task_id: string
  council_query_id: string | null
  status: "pending" | "completed" | "failed"
  ran_at: string
  error: string | null
}

export interface ScheduledTaskRunDetail extends ScheduledTaskRun {
  recommendation?: string | null
  confidence?: "high" | "medium" | "low" | null
  question?: string | null
}
