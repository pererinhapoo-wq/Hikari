/**
 * NovaStreamPlayer - Re-exporta a implementação oficial e completa de CustomVideoPlayer
 * garantindo compatibilidade uniforme e sem divergências.
 */
export { CustomVideoPlayer as NovaStreamPlayer, CustomVideoPlayer } from './CustomVideoPlayer';
export type {
  CustomVideoPlayerProps as NovaStreamPlayerProps,
  CustomVideoPlayerProps,
  VideoMetadataUpdates,
  VideoItem,
  QualityLevel,
  PlaybackSpeed,
  VideoResolution,
  StreamQualityOption,
} from './CustomVideoPlayer';

export { default } from './CustomVideoPlayer';
