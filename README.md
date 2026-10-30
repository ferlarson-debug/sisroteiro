# Sisroteiro

Plataforma em português para organizar clientes, briefings e roteiros audiovisuais.

**Topologia atual:** [Vercel + Supabase](docs/DEPLOY_VERCEL_SUPABASE.md).

**Alternativas preservadas:** Vercel com MySQL externo habilitado pela hospedagem, ou [aplicação e MySQL no cPanel](docs/DEPLOY_CPANEL_MYSQL.md).

## Stack

- React, TypeScript e Vite.
- API Express em Node.js no cPanel/Passenger ou em função da Vercel.
- MySQL com `mysql2` ou PostgreSQL/Supabase com `pg`, acessados exclusivamente pelo servidor com pool de conexões.
- Geração de roteiros por adaptador OpenAI, opcional.

## Desenvolvimento

Requer Node.js 22.12+ ou 24.x e um banco MySQL ou PostgreSQL de desenvolvimento.

```sh
npm ci
cp .env.example .env
# Preencha DATABASE_URL com a conexão do seu banco.
npm run db:migrate
npm run check
npm run server
# Em outro terminal:
npm run dev
```

Para servir a versão compilada: `npm run build` e `npm start` (porta 3001). `.env` é carregado somente pelo servidor e pelo comando de migração. Na Vercel, configure variáveis no painel e execute a migração antes do deploy; o build não altera o banco.

## Disponível

- Cadastro/login com senhas scrypt, sessões persistidas e cookies HttpOnly.
- Organização independente por conta, com isolamento de consultas e exportações.
- Cadastro de marcas, público, segmento e base de conhecimento em texto.
- Projetos com briefing e duração planejada.
- Editor manual em duas colunas, duração, duplicação, remoção e movimentação de cenas.
- Salvamento explícito e histórico. Versões antigas podem ser carregadas no editor e salvas como novas versões. Conflitos são detectados dentro da transação; uma gravação concorrente não sobrescreve a outra.
- Exportação de narração TXT, DOCX em duas colunas e PDF em blocos de cena. Os arquivos usam a última versão salva.
- Geração de IA quando `AI_API_KEY` estiver configurada no servidor. Validação de formato/duração e limite de cinco solicitações por organização/hora persistido no banco. Sem chave, o editor manual funciona e a geração fica desabilitada.
- Contadores calculados a partir dos registros reais.

## Testes

`npm run check` executa o build TypeScript/Vite e os testes Node. Os testes SQL usam PostgreSQL embarcado via PGlite, com a mesma migração do Supabase. Cobrem autenticação, isolamento, persistência, versões, conflitos concorrentes, exportações, limites compartilhados, RLS e validação do adaptador de IA com respostas simuladas.

A validação do Supabase remoto, do provedor de IA real e do deploy publicado exige configuração das respectivas contas. Consulte os passos de verificação no guia de deploy.

## Segurança e escopo

No esquema PostgreSQL/Supabase, as tabelas têm RLS habilitada e acesso revogado para papéis públicos. No MySQL, o isolamento entre organizações é aplicado pela API, sem RLS. Não há acesso direto ao banco pelo frontend. A API usa credenciais PostgreSQL privadas e aplica isolamento por organização. O projeto mantém sua autenticação própria; não utiliza Supabase Auth.

O documento [REQUISITOS](docs/REQUISITOS.md) registra o escopo completo. Esta entrega ainda é parte do MVP: não há pesquisa de sites, importação PDF/DOCX, aprovação por clientes, integração social, storyboard ou perfis de equipe. Não há salvamento automático. Não há migração automática do SQLite antigo para PostgreSQL; os arquivos antigos são preservados.

Antes da operação completa, definir recuperação/verificação de contas, convites/perfis, auditoria, LGPD, retenção e backup com recuperação testada. Revise fatos e duração dos roteiros gerados. O tratamento de fontes como dados não confiáveis no prompt reduz riscos sem garantir imunidade a instruções maliciosas.

## Interface e validação visual

O painel e o editor seguem o layout aprovado, com menu lateral no desktop e navegação inferior no celular. No celular, cada cena é editada em campos empilhados, sem tabela horizontal; o salvamento permanece na barra fixa. Há busca, filtros por cliente/presença de cenas, desfazer/refazer e abas de briefing, roteiro e histórico. As fontes são hospedadas com o próprio frontend.

Após `npm run build`, execute `npm run test:ui`: um Chromium local verifica cadastro, cliente/projeto, edição, histórico, exportação e persistência após login. As larguras verificadas são 320, 390, 768 e 1440px; capturas são gravadas em `artifacts/`, com dados isolados de teste. O navegador é distribuído pelo pacote npm de desenvolvimento, sem depender de um download externo do Playwright durante o teste.

Comece a publicação pelo arquivo [COMECE_AQUI](COMECE_AQUI.md). O código está preparado para integração GitHub → Vercel e servidor → Supabase/OpenAI; nenhum serviço remoto foi publicado ou validado sem as credenciais do usuário.


## MySQL e cPanel

A URL `mysql://` ativa o adaptador MySQL; `postgres://`/`postgresql://` mantém o PostgreSQL. `npm run db:migrate` aplica o esquema inicial correspondente. O SQL MySQL pode ser importado pelo phpMyAdmin. Não há migração automática de dados de um banco para outro.

`npm run package:cpanel` gera um pacote Linux com frontend compilado e dependências de produção. O workflow `deploy-cpanel.yml` gera o mesmo pacote no GitHub e oferece instalação opcional via SSH, após configurar o servidor e os segredos.

`npm run test:mysql` exige `TEST_DATABASE_URL` de um servidor MySQL **exclusivo para testes**, com permissão de criar bancos temporários. Os testes criam e apagam somente bancos com prefixo aleatório `sisroteiro_test_`; nunca use credenciais de produção. A validação foi executada em MySQL 8.4 real, incluindo concorrência e rollback.
