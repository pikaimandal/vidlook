"use client"

import { useEffect, useState } from "react"
import { Coins } from "lucide-react"
import Link from "next/link"

interface User {
  username: string
  tokens: number
}

export default function UserHeader() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    // Get user data from localStorage
    const userData = localStorage.getItem("user")
    if (userData) {
      setUser(JSON.parse(userData))
    }

    // Set up event listener for token updates
    window.addEventListener("tokenUpdate", () => {
      const updatedUserData = localStorage.getItem("user")
      if (updatedUserData) {
        setUser(JSON.parse(updatedUserData))
      }
    })

    return () => {
      window.removeEventListener("tokenUpdate", () => {})
    }
  }, [])

  if (!user) {
    return null
  }

  return (
    <div className="flex justify-between items-center p-4 bg-secondary/30 backdrop-blur-lg sticky top-0 z-10">
      <Link href="/profile" className="flex items-center hover:opacity-80 transition-opacity">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center mr-2">
          <span className="text-sm font-bold">{user.username.charAt(0)}</span>
        </div>
        <span className="font-medium">{user.username}</span>
      </Link>
      <Link
        href="/tokens"
        className="flex items-center bg-secondary/80 px-3 py-1 rounded-full hover:bg-secondary/60 transition-colors"
      >
        <Coins className="h-4 w-4 text-primary mr-1" />
        <span className="text-sm font-medium">{user.tokens} VIDEO</span>
      </Link>
    </div>
  )
}
