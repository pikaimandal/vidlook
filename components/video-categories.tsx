"use client"

import { Button } from "@/components/ui/button"

export type VideoCategory = "All" | "Trending" | "Gaming" | "Music" | "News" | "Movies" | "Sports" | "Technology"

interface VideoCategoriesProps {
  activeCategory: VideoCategory
  onCategoryChange: (category: VideoCategory) => void
}

export default function VideoCategories({ activeCategory, onCategoryChange }: VideoCategoriesProps) {
  const categories: VideoCategory[] = ["All", "Trending", "Gaming", "Music", "News", "Movies", "Sports", "Technology"]

  return (
    <div className="flex overflow-x-auto pb-2 mb-4 scrollbar-hide -mx-4 px-4">
      <div className="flex space-x-2">
        {categories.map((category) => (
          <Button
            key={category}
            variant={activeCategory === category ? "default" : "outline"}
            className={`whitespace-nowrap ${
              activeCategory === category
                ? "bg-primary hover:bg-primary/90"
                : "bg-secondary/50 hover:bg-secondary text-white border-none"
            }`}
            onClick={() => onCategoryChange(category)}
          >
            {category}
          </Button>
        ))}
      </div>
    </div>
  )
}
