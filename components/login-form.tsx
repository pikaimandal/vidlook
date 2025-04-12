"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async () => {
    setIsLoading(true)
    // Simulate authentication with WorldApp
    setTimeout(() => {
      // Store user info in localStorage for demo purposes
      localStorage.setItem(
        "user",
        JSON.stringify({
          username: "WorldApp_User",
          tokens: 0,
          isAuthenticated: true,
        }),
      )
      setIsLoading(false)
      router.push("/home")
    }, 1500)
  }

  return (
    <Card className="w-full max-w-md bg-secondary/50 border-none shadow-lg">
      <CardHeader className="space-y-1 flex flex-col items-center">
        <div className="flex items-center mb-2">
          <Play className="h-10 w-10 text-primary fill-primary mr-2" />
          <CardTitle className="text-3xl font-bold">VidLook</CardTitle>
        </div>
        <CardDescription className="text-center text-gray-400">
          Watch YouTube Videos and Earn VIDEO tokens
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-4">
        <div className="w-full max-w-xs">
          <img
            src="/placeholder.svg?height=200&width=200"
            alt="WorldApp Integration"
            className="w-full h-auto rounded-lg mb-4"
          />
        </div>
        <p className="text-center text-sm text-gray-400 mb-4">
          Connect with your WorldApp account to start earning tokens while watching videos
        </p>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full bg-primary hover:bg-primary/90 text-white font-medium"
          onClick={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? "Connecting..." : "Login with WorldApp"}
        </Button>
      </CardFooter>
    </Card>
  )
}
