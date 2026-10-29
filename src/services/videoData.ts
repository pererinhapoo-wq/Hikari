/**
 * Adaptador leve de videoData para o Player original do NOVA STREAM no Hikari.
 * Fornece compatibilidade com as assinaturas esperadas pelo CustomVideoPlayer
 * sem importar dados desnecessários de demonstração, catálogos ou imagens.
 */

export const getLocalVideoUrl = (_videoId: string): string | null => {
  return null;
};

export { classifyVideoResolution, formatDuration, formatQualityLabel } from './videoMetadata';
