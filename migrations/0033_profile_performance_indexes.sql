-- HIKARI — Etapa 3: Índices para comentários, seguidores e seguindo
--
-- 1. Comentários por usuário ordenados cronologicamente:
-- Permite varredura indexada direta (Index Scan) em "comment" filtrando por "userId"
-- e ordenando por "createdAt DESC, id DESC", eliminando nós de Sort em memória.
CREATE INDEX IF NOT EXISTS "comment_user_created_id_idx"
  ON "comment" ("userId", "createdAt" DESC, "id" DESC);

-- 2. Seguidores de um usuário ordenados cronologicamente:
-- Otimiza a listagem de seguidores com filtro em "followingId" e ordenação estável por "createdAt DESC".
CREATE INDEX IF NOT EXISTS "user_follow_following_created_idx"
  ON "user_follow" ("followingId", "createdAt" DESC);

-- 3. Usuários que um perfil segue (seguindo) ordenados cronologicamente:
-- Otimiza a listagem de quem o usuário segue com filtro em "followerId" e ordenação estável por "createdAt DESC".
CREATE INDEX IF NOT EXISTS "user_follow_follower_created_idx"
  ON "user_follow" ("followerId", "createdAt" DESC);
