-- Seed pererinha user profile for public search & profile navigation
insert into "user" ("id", "name", "email", "emailVerified", "image")
values ('pererinha_id', 'Matheus Pererinha', 'pererinhapoo@gmail.com', true, null)
on conflict do nothing;

insert into "profile" ("userId", "nick", "displayName", "bio", "accountType")
values ('pererinha_id', 'pererinha', 'Matheus Pererinha', 'Criador do Hikari Animes.', 'public')
on conflict do nothing;
