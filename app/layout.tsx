import type React from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: 'VidLook - Watch Videos and Earn VIDEO Tokens',
  description: 'VidLook is a Worldcoin mini-app where you can watch videos and earn VIDEO tokens, powered by Invidious API.',
  keywords: ['Worldcoin', 'mini-app', 'VidLook', 'VIDEO tokens', 'video', 'earn', 'Invidious'],
  generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preload Invidious API instances for faster video loading */}
        <link rel="preconnect" href="https://invidious.slipfox.xyz" />
        <link rel="preconnect" href="https://invidious.privacydev.net" />
        <link rel="dns-prefetch" href="https://invidious.slipfox.xyz" />
        <link rel="dns-prefetch" href="https://invidious.privacydev.net" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}


import './globals.css'