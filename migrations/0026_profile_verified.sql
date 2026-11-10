-- HIKARI Selo de Verificação de Usuário
-- Permite que a conta proprietária do nick 'pererinha' conceda ou remova o selo de verificado.

alter table "profile"
  add column if not exists "isVerified" boolean not null default false;

-- Garantir que a conta oficial pererinha já possua o selo ativo
update "profile"
set "isVerified" = true
where lower("nick") = 'pererinha';
