// Type definitions for YouTube IFrame Player API

interface YT {
  PlayerState: {
    UNSTARTED: number
    ENDED: number
    PLAYING: number
    PAUSED: number
    BUFFERING: number
    CUED: number
  }
  Player: {
    new (
      elementId: string | HTMLElement,
      options: {
        height?: string | number
        width?: string | number
        videoId?: string
        playerVars?: {
          autoplay?: 0 | 1
          controls?: 0 | 1
          disablekb?: 0 | 1
          enablejsapi?: 0 | 1
          fs?: 0 | 1
          iv_load_policy?: 1 | 3
          modestbranding?: 0 | 1
          playsinline?: 0 | 1
          rel?: 0 | 1
          showinfo?: 0 | 1
        }
        events?: {
          onReady?: (event: { target: YT.Player }) => void
          onStateChange?: (event: { data: number; target: YT.Player }) => void
          onPlaybackQualityChange?: (event: { data: string; target: YT.Player }) => void
          onPlaybackRateChange?: (event: { data: number; target: YT.Player }) => void
          onError?: (event: { data: number; target: YT.Player }) => void
          onApiChange?: (event: { target: YT.Player }) => void
        }
      },
    ): Player
  }
  Player: Player
}

interface Player {
  playVideo(): void
  pauseVideo(): void
  stopVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  clearVideo(): void
  nextVideo(): void
  previousVideo(): void
  playVideoAt(index: number): void
  mute(): void
  unMute(): void
  isMuted(): boolean
  setVolume(volume: number): void
  getVolume(): number
  setSize(width: number, height: number): void
  getPlaybackRate(): number
  setPlaybackRate(suggestedRate: number): void
  getAvailablePlaybackRates(): number[]
  setLoop(loopPlaylists: boolean): void
  setShuffle(shufflePlaylist: boolean): void
  getVideoLoadedFraction(): number
  getPlayerState(): number
  getCurrentTime(): number
  getDuration(): number
  getVideoUrl(): string
  getVideoEmbedCode(): string
  getPlaylist(): string[]
  getPlaylistIndex(): number
  addEventListener(event: string, listener: string): void
  removeEventListener(event: string, listener: string): void
  getIframe(): HTMLIFrameElement
  destroy(): void
}

interface Window {
  YT: YT
  onYouTubeIframeAPIReady: (() => void) | null
}
declare var YT: YT
