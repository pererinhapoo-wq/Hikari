-- HIKARI comentários
-- Adiciona suporte a imagem nos comentários.

alter table "comment"
  add column if not exists "imageUrl" text;

create index if not exists "comment_image_idx"
  on "comment" ("imageUrl");
