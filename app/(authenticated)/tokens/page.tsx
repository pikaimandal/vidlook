"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Coins, ArrowRight, Clock, Twitter, Share2, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import UserHeader from "@/components/user-header"

interface Transaction {
  id: number
  amount: number
  date: string
  status: "pending" | "completed"
}

interface Task {
  id: string
  title: string
  description: string
  reward: number
  icon: React.ReactNode
  action: () => void
  completed: boolean
}

export default function TokensPage() {
  const [userData, setUserData] = useState<{ username: string; tokens: number } | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [claimMessage, setClaimMessage] = useState(false)

  // Function to update user tokens
  const updateUserTokens = (amount: number) => {
    if (userData) {
      const updatedTokens = userData.tokens + amount
      const updatedUser = { ...userData, tokens: updatedTokens }

      // Update local state
      setUserData(updatedUser)

      // Update localStorage
      localStorage.setItem("user", JSON.stringify(updatedUser))

      // Dispatch event to update UI across the app
      window.dispatchEvent(new Event("tokenUpdate"))

      // Add transaction
      const newTransaction = {
        id: Date.now(),
        amount: amount,
        date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
        status: "completed" as const,
      }

      setTransactions((prev) => [newTransaction, ...prev])
    }
  }

  // Task completion handlers
  const handleFollowOnX = () => {
    // Open Twitter in a new tab
    window.open("https://twitter.com/vidlookapp", "_blank")

    // Mark task as completed
    setTasks((prev) => prev.map((task) => (task.id === "follow-x" ? { ...task, completed: true } : task)))

    // Award tokens
    updateUserTokens(100)
  }

  const handleShareApp = () => {
    // Check if Web Share API is available
    if (navigator.share) {
      navigator.share({
        title: "VidLook - Watch YouTube Videos and Earn",
        text: "Check out VidLook, where you can watch YouTube videos and earn VIDEO tokens!",
        url: "https://worldcoin.org/ecosystem/app_73c5e4221add70bae4ab73cfe37670d4",
      })
    } else {
      // Fallback for browsers that don't support Web Share API
      window.open(
        `https://wa.me/?text=Check out VidLook, where you can watch YouTube videos and earn VIDEO tokens! https://worldcoin.org/ecosystem/app_73c5e4221add70bae4ab73cfe37670d4`,
        "_blank",
      )
    }

    // Mark task as completed
    setTasks((prev) => prev.map((task) => (task.id === "share-app" ? { ...task, completed: true } : task)))

    // Award tokens
    updateUserTokens(120)
  }

  const handleJoinTelegram = () => {
    // Open Telegram in a new tab
    window.open("https://t.me/vidlookapp", "_blank")

    // Mark task as completed
    setTasks((prev) => prev.map((task) => (task.id === "join-telegram" ? { ...task, completed: true } : task)))

    // Award tokens
    updateUserTokens(50)
  }

  useEffect(() => {
    // Get user data from localStorage
    const user = localStorage.getItem("user")
    if (user) {
      setUserData(JSON.parse(user))
    }

    // Generate sample transactions
    setTransactions([
      {
        id: 1,
        amount: 60,
        date: "April 10, 2024",
        status: "completed",
      },
      {
        id: 2,
        amount: 45,
        date: "April 8, 2024",
        status: "completed",
      },
      {
        id: 3,
        amount: 30,
        date: "April 5, 2024",
        status: "completed",
      },
    ])

    // Initialize tasks
    setTasks([
      {
        id: "follow-x",
        title: "Follow us on X",
        description: "Follow @vidlookapp on X (Twitter)",
        reward: 100,
        icon: <Twitter className="h-5 w-5 text-primary" />,
        action: handleFollowOnX,
        completed: false,
      },
      {
        id: "share-app",
        title: "Share VidLook",
        description: "Share our app with your friends",
        reward: 120,
        icon: <Share2 className="h-5 w-5 text-primary" />,
        action: handleShareApp,
        completed: false,
      },
      {
        id: "join-telegram",
        title: "Join our Telegram",
        description: "Join our Telegram group @vidlookapp",
        reward: 50,
        icon: <MessageCircle className="h-5 w-5 text-primary" />,
        action: handleJoinTelegram,
        completed: false,
      },
    ])
  }, [])

  const handleClaimTokens = () => {
    // Show the claim message
    setClaimMessage(true)
  }

  if (!userData) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-black">
      <UserHeader />
      <div className="flex-1 p-4">
        <h1 className="text-2xl font-bold mb-6">Your Tokens</h1>

        <Card className="bg-secondary/30 border-none mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Available Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-6">
              <Coins className="h-8 w-8 text-primary mr-2" />
              <span className="text-4xl font-bold">{userData.tokens}</span>
              <span className="text-xl ml-2">VIDEO</span>
            </div>
            <p className="text-center text-sm text-gray-400 mb-4">
              You earn 1 VIDEO token for every minute of video watched
            </p>
          </CardContent>
          <CardFooter className="flex flex-col">
            <Button className="w-full bg-primary hover:bg-primary/90" onClick={handleClaimTokens}>
              Claim Tokens
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>

            {claimMessage && (
              <p className="text-red-500 text-sm mt-3 text-center">
                You will be able to claim your VIDEO tokens very soon.
              </p>
            )}
          </CardFooter>
        </Card>

        <div className="mb-6">
          <h2 className="text-lg font-medium mb-4">Complete Tasks</h2>
          <div className="space-y-4">
            {tasks.map((task) => (
              <Card key={task.id} className="bg-secondary/30 border-none overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center mr-3">
                        {task.icon}
                      </div>
                      <div>
                        <p className="font-medium">{task.title}</p>
                        <p className="text-sm text-gray-400">{task.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      {task.completed ? (
                        <span className="text-green-500 text-sm font-medium">Completed</span>
                      ) : (
                        <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={task.action}>
                          +{task.reward} VIDEO
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <h2 className="text-lg font-medium mb-2">Token History</h2>
          <p className="text-sm text-gray-400 mb-4">Your recent token earnings and transactions</p>
        </div>

        {transactions.length > 0 ? (
          <div className="space-y-4">
            {transactions.map((transaction) => (
              <Card key={transaction.id} className="bg-secondary/30 border-none">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center mr-3">
                        <Clock className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Watched Videos</p>
                        <p className="text-sm text-gray-400">{transaction.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Coins className="h-4 w-4 text-primary mr-1" />
                      <span className="font-medium">+{transaction.amount}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-secondary/30 border-none">
            <CardContent className="p-6 text-center">
              <p className="text-gray-400">No transaction history yet</p>
              <p className="text-sm text-gray-500 mt-1">Start watching videos to earn tokens</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
