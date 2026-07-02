# POSITIVASIM

Dashboard estatico para controle de positivacao comercial e mix de produtos Itambe.

## Estrutura

- `index.html`: aplicacao principal.
- `netlify.toml`: configuracao de deploy no Netlify.
- `_redirects`: fallback para servir o app em qualquer rota.

## Publicar no GitHub

1. Crie um repositorio vazio no GitHub.
2. Abra um terminal nesta pasta.
3. Rode:

```bash
git init
git add .
git commit -m "Initial POSITIVASIM app"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
git push -u origin main
```

## Publicar automaticamente com GitHub CLI

Se o Git ja aparece como "Git CMD" ou "Git Bash" no Windows, ele ja esta instalado. Caso o PowerShell comum nao reconheca `git`, abra o terminal pelo "Git CMD" ou use o script abaixo, que tenta localizar o Git em `C:\Program Files\Git`.

Para criar o repositorio automaticamente, instale tambem o GitHub CLI:

```powershell
winget install --id GitHub.cli -e
```

Depois feche e abra o terminal novamente, entre nesta pasta e rode:

```powershell
.\scripts\deploy-github.ps1 -RepoName positivasim-app -Visibility private
```

Na primeira execucao, o GitHub CLI vai pedir login. Depois disso, o mesmo comando cria o repositorio, faz commit e envia para o GitHub.

## Publicar sem GitHub CLI

Crie um repositorio vazio no GitHub pelo navegador e copie a URL HTTPS. Depois rode:

```powershell
.\scripts\deploy-github.ps1 -RemoteUrl https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
```

Nesse modo o script usa o Git instalado localmente, configura o `origin`, faz commit e envia para o GitHub.

Se for o primeiro commit nesse computador, informe nome e e-mail do Git no proprio comando:

```powershell
.\scripts\deploy-github.ps1 -RemoteUrl https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git -GitUserName "Seu Nome" -GitUserEmail "seu-email@exemplo.com"
```

## Publicar no Netlify

1. Entre em https://app.netlify.com/.
2. Clique em "Add new site" e escolha "Import an existing project".
3. Conecte o repositorio do GitHub.
4. Use estas configuracoes:

```text
Build command: deixe vazio
Publish directory: .
```

O arquivo `netlify.toml` ja deixa essa configuracao pronta para o Netlify.

## Observacao

O app usa Tailwind CSS e Lucide Icons via CDN. Isso simplifica o deploy estatico; em uma evolucao futura, vale migrar para um build com Tailwind CLI ou Vite.
