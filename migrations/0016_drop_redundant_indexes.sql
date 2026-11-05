-- HIKARI — Etapa 5E, Fase 1: Remoção de índices comprovadamente redundantes
--
-- 1. "profile_userId_idx" é redundante com a chave primária "profile_pkey" em ("userId").
-- 2. "comment_like_comment_idx" é redundante com a restrição UNIQUE "comment_like_unique" em ("commentId", "userId").
-- 3. "comment_report_comment_idx" é redundante com a restrição UNIQUE "comment_report_unique" em ("commentId", "userId").
-- 4. "user_follow_followerId_idx" é redundante com a chave primária "user_follow_pkey" em ("followerId", "followingId").
--
-- Chaves primárias, índices UNIQUE e constraints permanecem 100% intactos.

DROP INDEX IF EXISTS "profile_userId_idx";
DROP INDEX IF EXISTS "comment_like_comment_idx";
DROP INDEX IF EXISTS "comment_report_comment_idx";
DROP INDEX IF EXISTS "user_follow_followerId_idx";
