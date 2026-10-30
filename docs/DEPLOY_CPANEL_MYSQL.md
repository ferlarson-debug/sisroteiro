# cPanel + MySQL + GitHub

## Arquitetura e requisitos

O servidor cPanel hospeda o frontend e a API Node.js na mesma origem. Os dados ficam no MySQL; a geração continua integrada à API OpenAI. Não é necessário usar Vercel ou Supabase nesta configuração. A opção PostgreSQL/Supabase permanece no código, selecionada pelo protocolo de `DATABASE_URL`.

Requisitos: Node.js **22.12+ ou 24.x**, Setup Node.js App/Application Manager com Passenger, MySQL **8.0+**, HTTPS e acesso HTTPS de saída a `api.openai.com`. O esquema usa InnoDB e utf8mb4. MariaDB 10.6+ é um alvo de compatibilidade do SQL, mas a validação desta entrega foi executada em MySQL 8.4; confirme a versão e teste se sua hospedagem usa MariaDB.

Use um domínio ou subdomínio próprio na raiz, por exemplo `roteiros.suaempresa.com.br`. O build atual usa `/api` e `/assets` na raiz; instalação em subpasta exige ajuste adicional.

## 1. Criar o banco

No cPanel, abra **MySQL Databases/Database Wizard**. Crie o banco, o usuário e associe o usuário com permissões para as tabelas da aplicação. Use os nomes completos com o prefixo da conta cPanel.

No phpMyAdmin, selecione esse banco e importe `mysql/migrations/001_initial.sql`. Não importe o SQL da pasta `supabase`, que é específico para PostgreSQL. O SQL MySQL não cria banco/usuário nem altera configurações do servidor.

Alternativa pelo terminal, com `DATABASE_URL` privada configurada e Node ativo: `npm run db:migrate`. O comando escolhe a migração conforme a URL. A criação inicial usa comandos idempotentes; DDL MySQL pode fazer commit implícito. Não existe reversão automática de migrações. Faça backup antes de executar em um banco existente.

## 2. Registrar a aplicação Node.js

Em **Setup Node.js App** ou **Application Manager**:

- Node.js: 22.12+ ou 24.x.
- Mode: Production.
- Application root: `apps/sisroteiro`, fora de `public_html`.
- Application URL: domínio/subdomínio com HTTPS, na raiz `/`.
- Application startup file: **`app.cjs`**.

O wrapper CommonJS inicia os módulos ES da API e carrega `.env` da própria aplicação, se existir. Ele não depende do diretório atual do processo. Se o painel não aceitar `.cjs`, peça ao provedor para configurar esse startup file no Passenger; não basta renomeá-lo para `.js`, pois o pacote usa `type: module`.

Cadastre as variáveis nas configurações da aplicação ou em `.env` dentro do Application root, fora da pasta pública:

```dotenv
DATABASE_URL=mysql://CONTA_USUARIO:SENHA_CODIFICADA@localhost:3306/CONTA_BANCO
NODE_ENV=production
TRUST_PROXY=1
AI_API_KEY=SUA_CHAVE_PRIVADA_DA_API_OPENAI
AI_MODEL=gpt-4.1-mini
```

Não envie esse arquivo ao GitHub. Codifique caracteres especiais da senha para URL. `TRUST_PROXY=1` se aplica quando Apache/Passenger é o único salto de proxy confiável; ajuste a configuração de rede com o provedor se houver outra topologia. O cookie é Secure em produção e precisa de HTTPS.

MySQL em `localhost` usa a conexão local. Banco remoto exige TLS com verificação de certificado. Use `MYSQL_SSL_CA` se o provedor fornecer um certificado CA próprio. Não desabilite a verificação TLS.

## 3. Instalar o pacote pronto

O pacote **`sisroteiro-cpanel.tar.gz`** já inclui `dist` e `node_modules` de produção. Foi preparado para Linux, sem os pacotes de navegador/teste usados no desenvolvimento. O código-fonte também é entregue separadamente.

Crie a aplicação no cPanel antes da instalação. Se o CloudLinux criar um symlink `node_modules` para o ambiente virtual, preserve esse symlink.

Com terminal/SSH, envie o pacote para sua pasta pessoal e execute o script fornecido com o código-fonte:

```sh
bash scripts/deploy-cpanel.sh "$HOME/sisroteiro-cpanel.tar.gz"
```

O destino padrão é `$HOME/apps/sisroteiro`. Para outro Application root, informe a variável `CPANEL_APP_ROOT` ao executar ou grave o caminho absoluto em `$HOME/.sisroteiro-app-root`.

O script copia o código e as dependências para o destino, preserva `.env`, segue o symlink de `node_modules` do CloudLinux e toca `tmp/restart.txt` para solicitar reinício ao Passenger. Não altera banco, não executa migrações, não limpa arquivos antigos e não fornece rollback automático. Faça backup da versão atual antes de uma atualização.

Sem SSH/Terminal: extraia o pacote em uma pasta temporária pelo File Manager, copie os arquivos para o Application root e copie **o conteúdo** de `node_modules` para o diretório apontado pelo symlink existente. Preserve o symlink e o `.env`. Reinicie pelo botão Restart do painel. Não extraia tudo por cima do symlink do ambiente virtual sem conferir o comportamento do gerenciador de arquivos.

Não é necessário rodar NPM Install para o pacote pronto. Caso prefira compilar no servidor, ative o ambiente Node indicado pelo painel, execute `npm ci`, `npm run build` e `npm start` somente para testes pelo terminal; em produção o processo é gerenciado pelo Passenger.

## 4. Integrar o GitHub

Envie o código-fonte ao repositório `ferlarson-debug/sisroteiro`, incluindo `.github`, `.gitignore` e `.env.example`; exclua `.env`, `node_modules`, `data` e credenciais.

O workflow **Publicar no cPanel** executa testes, compila e gera o pacote a cada push na `main` ou execução manual. O pacote pode ser baixado em **Actions → Publicar no cPanel → Artifacts → sisroteiro-cpanel**. Isso já funciona sem acesso SSH do GitHub ao servidor.

Para também instalar automaticamente, a hospedagem precisa aceitar SSH/SCP. Em **GitHub → Settings → Secrets and variables → Actions**, configure:

| Tipo | Nome | Conteúdo |
| --- | --- | --- |
| Variable | `CPANEL_HOST` | Hostname/IP SSH da hospedagem. |
| Variable | `CPANEL_USER` | Usuário SSH da conta cPanel. |
| Variable | `CPANEL_PORT` | Porta SSH, padrão 22. |
| Variable | `CPANEL_AUTO_DEPLOY` | `true`, somente depois da configuração inicial do banco e da aplicação. |
| Secret | `CPANEL_SSH_KEY` | Chave privada dedicada, cuja pública foi autorizada na hospedagem. |
| Secret | `CPANEL_SSH_KNOWN_HOSTS` | Entrada known_hosts do servidor, com a impressão digital verificada por um canal confiável junto ao provedor. |

Não use a senha cPanel, a chave OpenAI ou a senha do banco nesses campos de SSH. As credenciais da aplicação ficam no cPanel. Se configurar o environment GitHub `production` com segredos próprios, assegure que os valores estejam disponíveis para esse environment.

O workflow verifica a identidade do servidor SSH; não ignora a verificação de host. Ele envia o pacote e executa o script de instalação, preservando o `.env`. Para um destino diferente do padrão, configure `$HOME/.sisroteiro-app-root` no servidor antes de habilitar deploys.

O recurso **Git Version Control** do cPanel, sozinho, não significa que novos commits do GitHub serão publicados automaticamente. O fluxo automatizado fornecido aqui é GitHub Actions + SSH. Se sua hospedagem bloquear SSH externo, use os artefatos para publicação manual ou peça ao provedor um mecanismo de implantação suportado.

## 5. Conferir a publicação

- `/api/health`: esperado `200` com `{"ok":true}` após importar as tabelas.
- Página inicial: cadastro/login acessível por HTTPS.
- Crie um cliente e um projeto, adicione cenas, salve, recarregue e confira o histórico.
- Teste PDF/DOCX e edição no celular.
- Configure a chave OpenAI e teste uma geração real. Ter a chave presente não comprova que a conta possui saldo ou acesso ao modelo.

As conexões com o seu cPanel e a OpenAI precisam ser validadas no servidor real. Os testes locais não comprovam permissões da hospedagem, configuração do Passenger, DNS, HTTPS ou acesso SSH.

## Dados existentes

Adicionar suporte MySQL não transfere registros do SQLite/PostgreSQL. Esses bancos são preservados; se já houver dados reais, faça uma migração específica, com backup e validação, antes de mudar `DATABASE_URL`.

MySQL não possui as políticas RLS PostgreSQL usadas no esquema Supabase. O isolamento entre organizações é aplicado pela API e foi testado; mantenha o usuário do banco privado, sem acesso direto pelo navegador.


## Configuração informada para esta hospedagem

- Servidor cPanel informado: `pro119.dnspro.com.br`.
- Banco: `vmcomunica_sisroteiro`.
- Usuário MySQL: `vmcomunica_admin`.
- Host de conexão do aplicativo no mesmo servidor: `localhost` (confirmar no painel/provedor).
- Porta padrão: `3306` (confirmar se a hospedagem usa outra).

Associe o usuário `vmcomunica_admin` ao banco `vmcomunica_sisroteiro` em MySQL Databases e conceda as permissões necessárias às tabelas da aplicação. No phpMyAdmin, selecione esse banco e importe `mysql/migrations/001_initial.sql`.

Na aplicação Node.js do cPanel, configure privadamente:

```dotenv
DATABASE_URL=mysql://vmcomunica_admin:SENHA_CODIFICADA@localhost:3306/vmcomunica_sisroteiro
NODE_ENV=production
TRUST_PROXY=1
```

Substitua `SENHA_CODIFICADA` pela senha real do usuário MySQL, com percent-encoding para caracteres especiais. Esse texto é apenas um modelo e não conecta ao banco sem uma senha válida. Não copie a senha real para o GitHub ou para o chat. O arquivo `.env.example` não é carregado pela aplicação: utilize variáveis no painel ou um `.env` privado no Application root.

O endereço HTTPS do servidor não confirma o endpoint MySQL. Se a aplicação estiver em outro servidor, solicite ao provedor o host MySQL, autorização de acesso remoto e certificado TLS; não substitua automaticamente `localhost` pelo endereço do painel.

Reinicie a aplicação após salvar a configuração e valide `/api/health` no domínio do sistema. Se o gerenciador ainda informar que não encontra a pasta `venv`, o cadastro do ambiente Node.js precisa ser reparado primeiro; essa falha ocorre antes da conexão com o banco.
