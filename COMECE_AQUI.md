# Publicar o Sisroteiro

A configuração recomendada nesta entrega é **cPanel + MySQL + GitHub**, com geração por **API OpenAI**.

1. No cPanel, crie o banco MySQL e o usuário. Importe `mysql/migrations/001_initial.sql` pelo phpMyAdmin.
2. Crie a aplicação em **Setup Node.js App/Application Manager**, com Node.js 22.12+ ou 24, modo Production, Application root `apps/sisroteiro` e startup **`app.cjs`**. Use domínio/subdomínio HTTPS na raiz.
3. Configure `DATABASE_URL` MySQL, `NODE_ENV=production`, `TRUST_PROXY=1` (para Apache/Passenger como único proxy) e `AI_API_KEY` no ambiente privado da aplicação. A chave da API OpenAI é independente da assinatura ChatGPT.
4. Instale o pacote pronto `sisroteiro-cpanel.tar.gz`, preservando `.env` e o symlink `node_modules` do CloudLinux. O pacote já traz frontend compilado e dependências de produção.
5. Reinicie a aplicação e verifique `/api/health`.
6. Envie o código-fonte ao GitHub. O workflow gera pacotes automaticamente; para instalar automaticamente via SSH, configure as variáveis e os segredos descritos no guia.

**Leia o passo a passo:** [cPanel, MySQL e GitHub](docs/DEPLOY_CPANEL_MYSQL.md).

A opção anterior [Vercel + Supabase](docs/DEPLOY_VERCEL_SUPABASE.md) continua disponível com `DATABASE_URL` PostgreSQL. Não importe o SQL de um banco no outro. Não há migração automática de dados entre bancos.

Nunca envie `.env`, senhas ou chaves ao GitHub ou pelo chat. Os pacotes não contêm credenciais reais. Esta é a versão atual do MVP; os módulos ainda pendentes estão descritos no README.
