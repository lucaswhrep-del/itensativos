param(
    [string]$RepoName = "positivasim-app",

    [string]$RemoteUrl,

    [ValidateSet("public", "private")]
    [string]$Visibility = "private",

    [string]$CommitMessage = "Update POSITIVASIM app",

    [string]$GitUserName,

    [string]$GitUserEmail
)

$ErrorActionPreference = "Stop"

function Require-Command {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [string]$InstallHint
    )

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name nao encontrado. $InstallHint"
    }
}

function Resolve-Tool {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,

        [string[]]$FallbackPaths = @()
    )

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    foreach ($path in $FallbackPaths) {
        if (Test-Path -LiteralPath $path -PathType Leaf) {
            return $path
        }
    }

    return $null
}

$git = Resolve-Tool "git" @(
    "C:\Program Files\Git\cmd\git.exe",
    "C:\Program Files\Git\bin\git.exe",
    "C:\Program Files (x86)\Git\cmd\git.exe"
)

if (-not $git) {
    throw "Git nao encontrado. Abra pelo Git CMD/Git Bash ou instale com: winget install --id Git.Git -e"
}

$gh = Resolve-Tool "gh" @(
    "C:\Program Files\GitHub CLI\gh.exe",
    "C:\Program Files (x86)\GitHub CLI\gh.exe"
)

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

if (-not (Test-Path -LiteralPath ".git")) {
    & $git init
    & $git branch -M main
}

$configuredName = & $git config user.name
$configuredEmail = & $git config user.email

if (-not $configuredName -and $GitUserName) {
    & $git config user.name $GitUserName
    $configuredName = $GitUserName
}

if (-not $configuredEmail -and $GitUserEmail) {
    & $git config user.email $GitUserEmail
    $configuredEmail = $GitUserEmail
}

if (-not $configuredName -or -not $configuredEmail) {
    throw "Configure nome/e-mail do Git ou passe os parametros -GitUserName e -GitUserEmail. Exemplo: .\scripts\deploy-github.ps1 -RemoteUrl https://github.com/SEU-USUARIO/SEU-REPO.git -GitUserName 'Seu Nome' -GitUserEmail 'seu-email@exemplo.com'"
}

& $git add .

$hasChanges = & $git status --porcelain
if ($hasChanges) {
    & $git commit -m $CommitMessage
} else {
    Write-Host "Nenhuma alteracao nova para commit."
}

$hasOrigin = $null
try {
    $hasOrigin = & $git remote get-url origin 2>$null
} catch {
    $hasOrigin = $null
}

if (-not $hasOrigin) {
    if ($RemoteUrl) {
        & $git remote add origin $RemoteUrl
        & $git push -u origin main
    } elseif ($gh) {
        $authStatus = & $gh auth status 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Login do GitHub necessario. Abrindo fluxo de login..."
            & $gh auth login
        }

        if ($Visibility -eq "private") {
            & $gh repo create $RepoName --source . --remote origin --private --push
        } else {
            & $gh repo create $RepoName --source . --remote origin --public --push
        }
    } else {
        throw "GitHub CLI nao encontrado. Instale com 'winget install --id GitHub.cli -e' ou rode passando -RemoteUrl https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git"
    }
} else {
    & $git push -u origin main
}

Write-Host "Deploy para GitHub concluido."
