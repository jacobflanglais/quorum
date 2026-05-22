import type { Provider, VoiceResult } from "../types"
import { callAnthropic } from "./anthropic"
import { callOpenAI } from "./openai"
import { callGoogle } from "./google"

interface CallArgs {
  model: string
  system: string
  user: string
}

export type VoiceCaller = (args: CallArgs) => Promise<VoiceResult>

export const VOICE_CALLERS: Record<Provider, VoiceCaller> = {
  anthropic: callAnthropic,
  openai: callOpenAI,
  google: callGoogle,
}
