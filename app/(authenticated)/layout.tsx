"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Navigation from "@/components/navigation"

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if user is authenticated
    const user = localStorage.getItem("user")
    if (user) {
      const userData = JSON.parse(user)
      if (userData.isAuthenticated) {
        setIsAuthenticated(true)
      } else {
        router.push("/login")
      }
    } else {
      router.push("/login")
    }
    setIsLoading(false)
  }, [router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="flex flex-col min-h-screen bg-black">
      <main className="flex-1 pb-16">{children}</main>
      <Navigation />
    </div>
  )
}
