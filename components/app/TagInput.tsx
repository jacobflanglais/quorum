"use client"

import { useEffect, useRef, useState } from "react"
import { Plus, X } from "lucide-react"

/**
 * Chip-style tag editor with autocomplete + suggestions.
 *
 * - Backspace on empty input removes last tag
 * - Enter or comma commits the current input as a new tag
 * - Suggestions: union of `existingTags` (user's prior tags) and
 *   `seedSuggestions` (curated defaults), excluding tags already on
 *   the value list
 */

const SEED_SUGGESTIONS = [
  "AI industry",
  "Markets",
  "Sports headlines",
  "Tech news",
  "Personal planning",
  "Health",
  "Politics",
]

interface TagInputProps {
  value: string[]
  onChange: (next: string[]) => void
  existingTags?: string[]
  placeholder?: string
  disabled?: boolean
  showSuggestions?: boolean
  max?: number
}

export function TagInput({
  value,
  onChange,
  existingTags = [],
  placeholder = "Add a tag…",
  disabled = false,
  showSuggestions = true,
  max = 16,
}: TagInputProps) {
  const [input, setInput] = useState("")
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function addTag(raw: string) {
    const trimmed = raw.trim().replace(/,$/, "")
    if (!trimmed) return
    if (value.includes(trimmed)) return
    if (value.length >= max) return
    onChange([...value, trimmed])
    setInput("")
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addTag(input)
    } else if (e.key === "Backspace" && input === "" && value.length > 0) {
      onChange(value.slice(0, -1))
    } else if (e.key === "Escape") {
      setInput("")
      inputRef.current?.blur()
    }
  }

  const candidates = Array.from(
    new Set([...existingTags, ...SEED_SUGGESTIONS]),
  )
    .filter((t) => !value.includes(t))
    .filter((t) =>
      input.trim()
        ? t.toLowerCase().includes(input.trim().toLowerCase())
        : true,
    )
    .slice(0, 8)

  // Keep focus state stable across click events on suggestions
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!inputRef.current?.parentElement?.parentElement?.contains(e.target as Node)) {
        setFocused(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-background p-2 focus-within:border-primary">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1.5 rounded-md border border-accent-muted/40 bg-accent-subtle px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-primary"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              disabled={disabled}
              aria-label={`Remove ${tag}`}
              className="inline-flex items-center justify-center rounded-sm text-primary/70 hover:text-primary"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          placeholder={value.length === 0 ? placeholder : ""}
          disabled={disabled || value.length >= max}
          className="flex-1 min-w-[140px] bg-transparent text-sm text-foreground placeholder:text-fg-ghost focus:outline-none"
        />
      </div>

      {showSuggestions && focused && candidates.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1.5 max-h-48 overflow-y-auto rounded-md border border-border bg-surface-elevated p-1.5 shadow-lg">
          <p className="px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
            Suggestions
          </p>
          {candidates.map((tag) => (
            <button
              key={tag}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                addTag(tag)
                inputRef.current?.focus()
              }}
              className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-left text-sm text-foreground hover:bg-surface"
            >
              <Plus className="h-3 w-3 text-fg-ghost" />
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
