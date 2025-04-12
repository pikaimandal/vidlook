"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { Home, User, Coins } from "lucide-react"

export default function Navigation() {
  const pathname = usePathname()

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-secondary/80 backdrop-blur-lg border-t border-gray-800 z-50">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        <Link
          href="/home"
          className={`flex flex-col items-center justify-center w-full h-full ${
            pathname === "/home" ? "text-primary" : "text-gray-400"
          }`}
        >
          <Home className="h-6 w-6" />
          <span className="text-xs mt-1">Home</span>
        </Link>
        <Link
          href="/tokens"
          className={`flex flex-col items-center justify-center w-full h-full ${
            pathname === "/tokens" ? "text-primary" : "text-gray-400"
          }`}
        >
          <Coins className="h-6 w-6" />
          <span className="text-xs mt-1">Tokens</span>
        </Link>
        <Link
          href="/profile"
          className={`flex flex-col items-center justify-center w-full h-full ${
            pathname === "/profile" ? "text-primary" : "text-gray-400"
          }`}
        >
          <User className="h-6 w-6" />
          <span className="text-xs mt-1">Profile</span>
        </Link>
      </div>
    </div>
  )
}
