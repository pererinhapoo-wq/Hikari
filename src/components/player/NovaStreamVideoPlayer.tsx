/**
 * NovaStreamVideoPlayer - Implementação dos controles personalizados Nova Stream
 * unificada e sincronizada com CustomVideoPlayer.
 */
import { CustomVideoPlayer } from './CustomVideoPlayer';

export { CustomVideoPlayer as NovaStreamVideoPlayer, CustomVideoPlayer } from './CustomVideoPlayer';
export type {
  CustomVideoPlayerProps as NovaStreamVideoPlayerProps,
  CustomVideoPlayerProps,
  VideoMetadataUpdates,
  VideoItem,
  QualityLevel,
  PlaybackSpeed,
  VideoResolution,
  StreamQualityOption,
} from './CustomVideoPlayer';

export default CustomVideoPlayer;
