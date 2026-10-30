# Deploy na Vercel com Supabase

O frontend é estático (React/Vite). `/api/*` é encaminhado para uma função Node.js que acessa PostgreSQL. Nenhum dado depende do disco da Vercel. A autenticação continua sendo a do Sisroteiro; este projeto utiliza o **banco** do Supabase, sem integração com Supabase Auth nesta etapa.

## 1. Preparar o Supabase

1. Crie um projeto no Supabase e guarde a senha do banco de forma segura.
2. Abra **SQL Editor**, cole e execute o conteúdo de `supabase/migrations/202610240001_initial.sql`. O script cria tabelas e índices, habilita RLS e revoga o acesso dos papéis públicos `anon` e `authenticated`. Pode ser reexecutado neste esquema inicial; migrações futuras terão arquivos próprios.
3. Em **Connect**, selecione **Transaction pooler** (Supavisor, normalmente porta 6543) e copie a connection string PostgreSQL apresentada pelo seu projeto. Use o hostname e o usuário exatos fornecidos pelo painel. Substitua a senha, codificando caracteres especiais com percent-encoding.
4. A conexão de servidor precisa de um papel com acesso às tabelas e que ultrapasse RLS (a connection string do usuário `postgres` fornecida pelo painel funciona). Não use a chave `anon` ou `service_role` como senha PostgreSQL. O acesso por organização é aplicado na API do Sisroteiro; as tabelas não têm políticas de acesso pelo navegador.
5. Se houver restrições de rede no projeto, permita a conectividade exigida pelo ambiente de execução da Vercel conforme o seu plano. Valide as configurações de backup e recuperação do Supabase antes de armazenar dados de produção.

Alternativa ao SQL Editor: com `DATABASE_URL` configurada num arquivo `.env` local, execute `npm run db:migrate`. Esse comando altera o banco indicado pela variável. O build da Vercel não executa migrações nem precisa acessar o banco.

## 2. Preparar a Vercel

1. Envie os arquivos deste projeto para o GitHub e importe o repositório na Vercel.
2. Use a pasta que contém `package.json` como **Root Directory** (raiz do repositório).
3. A configuração em `vercel.json` define **Vite**, build `npm run build` e saída `dist`. Use **Node.js 24.x** (também definido em `package.json`). Não configure como site estático sem funções: a pasta `api` precisa ser incluída.
4. Em **Settings → Environment Variables**, adicione:

| Nome | Obrigatório | Conteúdo |
| --- | --- | --- |
| `DATABASE_URL` | Sim | Connection string do transaction pooler do Supabase. Marque como sensível quando disponível. |
| `SUPABASE_DB_CA` | Se necessário | Certificado CA disponibilizado pelo Supabase, em PEM. Use se a cadeia não for reconhecida pelo runtime. Aceita quebras de linha reais ou `\n`. |
| `AI_API_KEY` | Para IA | Chave do provedor OpenAI, somente no servidor. |
| `AI_MODEL` | Não | Padrão: `gpt-4.1-mini`. |

Nunca prefixe esses segredos com `VITE_`: esse prefixo publica valores no bundle do navegador. Não envie arquivos `.env` ao Git. O Supabase URL público e as chaves do SDK não são necessários, pois a API usa PostgreSQL diretamente.

5. Configure as variáveis no ambiente **Production**. Para **Preview**, use outro projeto/banco Supabase para evitar testes e cadastros no banco de produção. Se habilitar IA em Preview, configure a chave também nesse ambiente.
6. Clique em **Deploy**. Alterações posteriores nas variáveis exigem um novo deploy. A função tem `maxDuration` de 120 segundos para acomodar a chamada de IA (timeout interno de 60 segundos); confirme que esse limite é permitido no plano da conta.

A conexão usa TLS com validação de certificado. A aplicação não desativa verificação mesmo quando a URL contém `sslmode=require`. Em caso de erro de certificado, configure `SUPABASE_DB_CA`; não use `NODE_TLS_REJECT_UNAUTHORIZED=0`.

## 3. Validar após o deploy

1. `GET /api/health` deve retornar `200` e `{"ok":true}`; esse teste consulta o banco e verifica a existência das tabelas.
2. Abra a aplicação, crie uma conta, cadastre um cliente e crie um projeto.
3. Adicione uma cena, salve e recarregue a página. Verifique se o roteiro permanece.
4. Faça logout/login, confira o histórico e baixe PDF/DOCX. Esses formatos são gerados na função, com as fontes do PDF incluídas no pacote.
5. Crie outra conta e verifique que ela não vê os registros da primeira.
6. Com `AI_API_KEY` configurada, faça uma geração e revise o conteúdo e a duração. Os testes automatizados do adaptador usam respostas simuladas e não validam acesso ao serviço real.

Se `/api/health` retornar erro, consulte os logs da função. Verifique a URL, senha codificada, esquema SQL e conexão ao pooler. As respostas da API não expõem credenciais. Ao testar na mesma origem, o cookie de sessão é HttpOnly, SameSite=Strict e Secure na Vercel. Não hospede frontend e API em domínios diferentes sem adaptar a autenticação.

## Desenvolvimento e testes

```sh
npm ci
cp .env.example .env
# Edite .env localmente com as credenciais do seu banco de desenvolvimento.
npm run db:migrate
npm run check
npm run server
# Em outro terminal: npm run dev
```

`npm test` usa PostgreSQL embarcado via PGlite em bancos isolados; não acessa nem modifica o Supabase. A API de produção utiliza `pg` e conexões com pool. Os testes cobrem SQL, migração, autenticação, isolamento, histórico, exportações, limites compartilhados e gravações concorrentes. Não substituem a validação no projeto Supabase e na Vercel após configurar as credenciais.

## Dados anteriores e escopo

O arquivo SQLite da versão inicial não é usado nesta versão e não é apagado. Se houver dados nele, faça uma migração específica antes de trocar a produção; não há importação automática.

Esta configuração torna os recursos atuais publicáveis. Não implementa as fases restantes do produto: pesquisa de sites, importação de documentos, aprovação de clientes, sete perfis, storyboard e integrações sociais continuam pendentes. Recuperação de senha, verificação de e-mail, convites, auditoria e políticas de retenção também precisam ser definidos antes da operação completa com dados confidenciais.

## Integração automática entre os serviços

A ligação em execução é navegador → API na Vercel → PostgreSQL no Supabase. A geração usa API na Vercel → API OpenAI, com chave privada. O sistema não precisa administrar projetos da Vercel ou do Supabase pela API de gerenciamento.

Vincule o GitHub ao projeto Vercel uma vez para habilitar deploys automáticos a cada push. O workflow `.github/workflows/check.yml` verifica build, API e interface em pull requests e pushes na `main`; os testes não usam credenciais do banco de produção. O vínculo Git da Vercel determina a publicação; o workflow apenas valida e disponibiliza capturas de tela como artefatos.

## OpenAI e interface responsiva

A geração pede resposta estruturada aos modelos GPT e valida cenas e duração antes de salvar uma nova versão. Erros de autenticação, limite de uso, timeout ou resposta inválida preservam o roteiro salvo. A chave é lida apenas pelo backend. A tela Minha conta informa se a integração está configurada; configuração não é prova de uma chamada bem-sucedida.

O editor utiliza duas colunas no desktop e uma cena por vez no celular, com navegação entre cenas e barra fixa para salvar/exportar. Todos os controles operam sobre os registros reais; aprovações e produção ainda não estão no menu porque esses módulos não foram implementados.


## Trocar uma Vercel já publicada de MySQL para Supabase

O adaptador é selecionado pelo protocolo de `DATABASE_URL`; nenhuma mudança no frontend é necessária. Importe primeiro o esquema PostgreSQL no projeto Supabase. Depois substitua a variável privada `DATABASE_URL` na Vercel pela URL do Transaction pooler e faça Redeploy. O valor de exemplo no GitHub não altera a variável já salva na Vercel. Preserve `AI_API_KEY` e não publique a connection string real no repositório.

O endereço público `https://PROJECT_REF.supabase.co` e as chaves do SDK não substituem a connection string PostgreSQL. Use o host, usuário e porta exibidos em Connect, sem inferir o hostname do pooler a partir do nome do projeto.

Se houver dados no MySQL, preserve-os e planeje uma importação específica; trocar `DATABASE_URL` não transfere esses dados. O gerenciamento Node.js/venv do cPanel não participa desse deploy na Vercel.

## Diagnosticar erro de banco no deploy ativo

Consulte `/api/health` no domínio da aplicação. A resposta pode incluir um código fixo de diagnóstico, sem senha, URL ou mensagem interna do driver:

| Código | O que conferir |
| --- | --- |
| `DATABASE_URL_MISSING` | Variável `DATABASE_URL` ausente/vazia no deploy ativo. Cadastre no projeto Vercel correto, no ambiente correspondente (Production ou Preview), e faça Redeploy. |
| `DATABASE_URL_INVALID` / `DATABASE_PROTOCOL_INVALID` / `DATABASE_ADDRESS_INVALID` | Copie a connection string PostgreSQL do pooler, sem `DATABASE_URL=` dentro do valor, sem colchetes do exemplo e com senha codificada para URL. Não use a URL HTTPS pública do Supabase. |
| `DATABASE_AUTH_FAILED` | Usuário, senha do banco ou referência do projeto incorretos; confirme se está usando a senha atual após redefinição. |
| `DATABASE_SCHEMA_MISSING` | Execute a migração PostgreSQL no mesmo projeto/banco apontado pela connection string. |
| `DATABASE_TLS_FAILED` | Confira a conexão fornecida pelo Supabase e, se necessário, o certificado CA. Preserve a verificação TLS. |
| `DATABASE_UNREACHABLE` | Host/porta, disponibilidade do projeto, restrições de rede ou limite de conexões. |
| `DATABASE_NOT_FOUND` | Nome do banco na connection string. |
| `API_INITIALIZATION_FAILED` | Consulte os logs da função na Vercel; a causa não foi identificada como uma configuração conhecida. |

Alterar Environment Variables não modifica deployments antigos. Faça Redeploy com as variáveis atuais, verifique que terminou como Ready e abra o domínio desse novo deployment. Se estiver acessando um Preview, configure as variáveis de Preview ou use o domínio Production. Não envie o valor de `DATABASE_URL` nos prints ou no chat.
