import UserHeader from "@/components/user-header"
import VideoFeed from "@/components/video-feed"

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-black">
      <UserHeader />
      <div className="flex-1 px-4 pb-4">
        <VideoFeed />
      </div>
    </div>
  )
}
