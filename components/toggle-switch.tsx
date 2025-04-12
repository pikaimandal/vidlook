"use client"

import { useState, useEffect } from "react"

interface ToggleSwitchProps {
  isActive?: boolean
  onChange?: (isActive: boolean) => void
  disabled?: boolean
}

export default function ToggleSwitch({ isActive = false, onChange, disabled = false }: ToggleSwitchProps) {
  const [active, setActive] = useState(isActive)

  useEffect(() => {
    setActive(isActive)
  }, [isActive])

  const handleToggle = () => {
    if (disabled) return

    const newState = !active
    setActive(newState)

    if (onChange) {
      onChange(newState)
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background ${
        active ? "bg-primary" : "bg-gray-700"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      disabled={disabled}
      aria-pressed={active}
    >
      <span className="sr-only">{active ? "Enabled" : "Disabled"}</span>
      <span
        className={`${
          active ? "translate-x-6" : "translate-x-1"
        } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
      />
    </button>
  )
}
