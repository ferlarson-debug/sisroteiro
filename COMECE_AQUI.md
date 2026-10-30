# Publicar o Sisroteiro

## Topologia atual: Vercel + Supabase

A aplicação roda na **Vercel**. O caminho recomendado nesta configuração é usar **PostgreSQL do Supabase**, com geração por **API OpenAI**. Não é necessário cadastrar ou iniciar uma aplicação Node.js no cPanel.

1. No projeto Supabase, abra o SQL Editor e execute `supabase/migrations/202610240001_initial.sql`. Não use a migração MySQL nesse banco.
2. Abra **Connect → Transaction pooler** e copie a connection string PostgreSQL. Use o usuário, host e porta fornecidos pelo seu próprio projeto e substitua a senha, com percent-encoding dos caracteres especiais.
3. No projeto Vercel, em **Settings → Environment Variables**, substitua `DATABASE_URL` pela conexão do Supabase no ambiente Production. Não basta alterar `.env.example` ou o código no GitHub: as variáveis do painel são independentes.
4. Mantenha `AI_API_KEY` privada para a OpenAI. `AI_MODEL` é opcional, com padrão `gpt-4.1-mini`. Se a cadeia TLS exigir, configure também `SUPABASE_DB_CA` com o CA fornecido pelo Supabase.
5. Faça um **Redeploy** após alterar as variáveis. Não use variáveis com prefixo `VITE_` para segredos.
6. Verifique `/api/health` no domínio da Vercel: esperado `200` e `{"ok":true}`. Depois teste cadastro, cliente, projeto, salvamento e exportação.

Leia o [guia completo Vercel + Supabase](docs/DEPLOY_VERCEL_SUPABASE.md). A autenticação permanece sendo a do Sisroteiro; não há dependência de Supabase Auth nesta etapa.

## Alternativa: Vercel + MySQL externo

O código continua aceitando MySQL. Para manter o banco `vmcomunica_sisroteiro` no servidor `186.209.113.107:3306`, a hospedagem precisa liberar conexões externas vindas da Vercel, autorizar o usuário `vmcomunica_admin` para esses acessos e fornecer TLS verificável. Endereços de saída da Vercel podem variar conforme a configuração/plano; confirme com os dois provedores antes de definir regras de rede. `localhost` na Vercel não representa o seu servidor cPanel.

Sem acesso remoto e TLS funcionando, somente preencher uma URL não conecta os serviços. A mudança para Supabase não transfere registros do MySQL automaticamente e não remove nenhum banco existente.

## Alternativa: aplicação no cPanel

Se decidir hospedar também a aplicação no cPanel, use o [guia cPanel + MySQL + GitHub](docs/DEPLOY_CPANEL_MYSQL.md) e o startup `app.cjs`. Apenas nessa alternativa o ambiente Node.js/venv do cPanel é necessário.

Nunca envie `.env`, senhas ou chaves ao GitHub ou pelo chat. Os arquivos de exemplo não contêm credenciais reais. Esta é a versão atual do MVP; os módulos ainda pendentes estão descritos no README.
