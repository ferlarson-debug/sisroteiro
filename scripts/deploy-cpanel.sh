#!/usr/bin/env bash
set -euo pipefail
# Recebe um pacote produzido pelo workflow ou por npm run package:cpanel.
archive=${1:?Informe o caminho do pacote .tar.gz}
app_root=${CPANEL_APP_ROOT:-"$HOME/apps/sisroteiro"}
if [[ -f "$HOME/.sisroteiro-app-root" && -z ${CPANEL_APP_ROOT:-} ]]; then
  IFS= read -r app_root < "$HOME/.sisroteiro-app-root"
fi
[[ "$app_root" = /* && "$app_root" != / && "$app_root" != "$HOME" ]] || { echo 'Application root inválido.' >&2; exit 1; }
case "$app_root" in */public_html|*/public_html/*) echo 'Use Application root fora de public_html.' >&2; exit 1;; esac
[[ -f "$archive" ]] || { echo 'Pacote não encontrado.' >&2; exit 1; }
stage=$(mktemp -d "${TMPDIR:-/tmp}/sisroteiro-deploy.XXXXXXXX")
trap 'rm -rf -- "$stage"' EXIT
# Pacotes são gerados pelo próprio pipeline. Rejeite caminhos externos e credenciais.
while IFS= read -r entry; do
 case "$entry" in /*|../*|*/../*|.env|./.env|*/.env) echo 'Pacote contém caminho não permitido.' >&2; exit 1;; esac
done < <(tar -tzf "$archive")
tar -xzf "$archive" -C "$stage"
[[ -f "$stage/app.cjs" && -f "$stage/package.json" && -f "$stage/dist/index.html" && -d "$stage/node_modules" ]] || { echo 'Pacote incompleto.' >&2; exit 1; }
mkdir -p "$app_root"
for folder in server dist scripts mysql supabase docs node_modules; do
 mkdir -p "$app_root/$folder"
 # O / final preserva o symlink node_modules criado pelo CloudLinux/cPanel.
 cp -a "$stage/$folder/." "$app_root/$folder/"
done
for file in app.cjs package.json package-lock.json .env.example README.md COMECE_AQUI.md; do
 cp "$stage/$file" "$app_root/$file"
done
# Não sobrescreve .env, Passenger/CloudLinux, uploads nem executa migrações.
mkdir -p "$app_root/tmp"
touch "$app_root/tmp/restart.txt"
echo 'Arquivos instalados; reinício solicitado ao Passenger. Valide /api/health.'
