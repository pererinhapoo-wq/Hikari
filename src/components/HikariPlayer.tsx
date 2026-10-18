/**
 * HikariPlayer - Re-exporta integralmente a implementação funcional do CustomVideoPlayer da NOVA STREAM.
 * Garante que qualquer referência legado ao player principal utilize exclusivamente o motor e controles da NOVA STREAM.
 */
export { CustomVideoPlayer as HikariPlayer } from "@/components/player/CustomVideoPlayer";
export type {
  CustomVideoPlayerProps as HikariPlayerProps,
  VideoItem,
} from "@/components/player/CustomVideoPlayer";
