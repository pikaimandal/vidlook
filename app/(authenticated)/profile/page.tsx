"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { LogOut, User, Coins, Moon, Sun, Bell, BellOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import ToggleSwitch from "@/components/toggle-switch"

interface UserData {
  username: string
  tokens: number
  isAuthenticated: boolean
  preferences: {
    darkMode: boolean
    notifications: boolean
    autoplay: boolean
  }
}

export default function ProfilePage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [darkMode, setDarkMode] = useState(true)
  const [notifications, setNotifications] = useState(false)
  const [autoplay, setAutoplay] = useState(true)

  useEffect(() => {
    const user = localStorage.getItem("user")
    if (user) {
      const parsedUser = JSON.parse(user)

      // Initialize with default preferences if not present
      if (!parsedUser.preferences) {
        parsedUser.preferences = {
          darkMode: true,
          notifications: false,
          autoplay: true,
        }
        localStorage.setItem("user", JSON.stringify(parsedUser))
      }

      setUserData(parsedUser)
      setDarkMode(parsedUser.preferences.darkMode)
      setNotifications(parsedUser.preferences.notifications)
      setAutoplay(parsedUser.preferences.autoplay)
    }
  }, [])

  // Update user preferences in localStorage
  const updateUserPreferences = (preferences: { darkMode?: boolean; notifications?: boolean; autoplay?: boolean }) => {
    if (userData) {
      // Ensure all properties are defined with defaults
      const updatedPreferences = {
        darkMode: userData.preferences.darkMode,
        notifications: userData.preferences.notifications,
        autoplay: userData.preferences.autoplay,
        ...preferences,
      };
      
      const updatedUser = {
        ...userData,
        preferences: updatedPreferences,
      };

      localStorage.setItem("user", JSON.stringify(updatedUser))
      setUserData(updatedUser)
    }
  }

  const handleDarkModeToggle = (isActive: boolean) => {
    setDarkMode(isActive)
    setTheme(isActive ? "dark" : "light")
    updateUserPreferences({ darkMode: isActive })
  }

  const handleNotificationsToggle = (isActive: boolean) => {
    setNotifications(isActive)
    updateUserPreferences({ notifications: isActive })
  }

  const handleAutoplayToggle = (isActive: boolean) => {
    setAutoplay(isActive)
    updateUserPreferences({ autoplay: isActive })
  }

  const handleLogout = () => {
    localStorage.removeItem("user")
    router.push("/login")
  }

  if (!userData) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="container max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Profile</h1>

      <Card className="bg-secondary/30 border-none mb-6">
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div>
            <CardTitle>{userData.username}</CardTitle>
            <p className="text-sm text-gray-400">WorldApp User</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between py-2 border-b border-gray-800">
            <span className="text-gray-400">Account Type</span>
            <span>Standard</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-800">
            <span className="text-gray-400">Joined</span>
            <span>April 2024</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-gray-400">Total Tokens Earned</span>
            <div className="flex items-center">
              <Coins className="h-4 w-4 text-primary mr-1" />
              <span>{userData.tokens} VIDEO</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-secondary/30 border-none mb-6">
        <CardHeader>
          <CardTitle className="text-lg">App Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {darkMode ? (
                <Moon className="h-5 w-5 mr-2 text-primary" />
              ) : (
                <Sun className="h-5 w-5 mr-2 text-yellow-500" />
              )}
              <span>Dark Mode</span>
            </div>
            <ToggleSwitch isActive={darkMode} onChange={handleDarkModeToggle} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {notifications ? (
                <Bell className="h-5 w-5 mr-2 text-primary" />
              ) : (
                <BellOff className="h-5 w-5 mr-2 text-gray-400" />
              )}
              <span>Notifications</span>
            </div>
            <ToggleSwitch isActive={notifications} onChange={handleNotificationsToggle} />
          </div>
          <div className="flex items-center justify-between">
            <span>Autoplay Videos</span>
            <ToggleSwitch isActive={autoplay} onChange={handleAutoplayToggle} />
          </div>
        </CardContent>
      </Card>

      <Button variant="destructive" className="w-full" onClick={handleLogout}>
        <LogOut className="h-4 w-4 mr-2" />
        Logout
      </Button>
    </div>
  )
}
