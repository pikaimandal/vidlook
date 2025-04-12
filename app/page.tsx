import { Suspense } from "react"
import SplashScreen from "@/components/splash-screen"

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SplashScreen />
    </Suspense>
  )
}
