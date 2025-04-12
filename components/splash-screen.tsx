"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Play } from "lucide-react"

export default function SplashScreen() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
      router.push("/login")
    }, 3000)

    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black">
      <div className="flex items-center mb-6 animate-pulse">
        <Play className="h-16 w-16 text-primary fill-primary mr-2" />
        <h1 className="text-5xl font-bold text-white">VidLook</h1>
      </div>
      <p className="text-xl text-gray-400 mb-8">Watch YouTube Videos and Earn</p>
      <div className="w-16 h-1 bg-primary rounded-full animate-pulse"></div>
    </div>
  )
}
