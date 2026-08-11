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

## Usar Google Sheets como base central

1. Abra a planilha no Google Sheets.
2. Garanta que a primeira aba tenha os cabecalhos usados pelo app, por exemplo:

```text
SAP;Cliente Emissor;Vendedor;REDE;Bairro;CIDADE;Dt Faturamento;Tipo Produto;Material;Descricao material;Descricao Linha;Situacao Item;PRECO;Quant. CX
```

A coluna `Situacao Item` e opcional. Quando existir, use `Ativo` ou `Inativo`; quando nao existir, o app considera o item como ativo.
A coluna `Vendedor` tambem e opcional. Quando existir, o app libera o filtro por vendedor na carteira de clientes.

3. No Google Sheets, va em `Arquivo > Compartilhar > Publicar na Web`.
4. Em `Link`, selecione a aba correta.
5. Escolha o formato `Valores separados por virgula (.csv)`.
6. Clique em `Publicar` e copie o link CSV gerado.
7. No arquivo `index.html`, cole esse link em:

```js
const REMOTE_CSV_URL = 'COLE_AQUI_O_LINK_CSV_DO_GOOGLE_SHEETS';
```

8. Faca commit e push para o GitHub. O Netlify publicara a nova versao.

Tambem e possivel testar sem alterar codigo usando:

```text
https://SEU-SITE.netlify.app/?base=LINK_CSV_DO_GOOGLE_SHEETS
```

Depois de configurado, todos que abrirem o app carregarao a mesma base central.

## Atualizar Google Sheets pelo app

O app tambem pode enviar o CSV importado para uma planilha central usando Google Apps Script. Use este script na planilha:

```javascript
const SHEET_NAME = 'base';
const SECRET = 'positiva-sim-2026';

function doPost(e) {
  try {
    const payload = e.parameter && e.parameter.csvText
      ? e.parameter
      : JSON.parse(e.postData.contents || '{}');

    if (payload.secret !== SECRET) {
      return jsonResponse({ ok: false, error: 'Senha invalida.' });
    }

    if (!payload.csvText) {
      return jsonResponse({ ok: false, error: 'CSV vazio.' });
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName(SHEET_NAME);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(SHEET_NAME);
    }

    const rows = Utilities.parseCsv(payload.csvText);
    sheet.clearContents();

    if (rows.length) {
      const width = Math.max(...rows.map(row => row.length));
      const normalizedRows = rows.map(row => {
        while (row.length < width) row.push('');
        return row;
      });
      sheet.getRange(1, 1, normalizedRows.length, width).setValues(normalizedRows);
    }

    SpreadsheetApp.flush();

    return jsonResponse({
      ok: true,
      rows: rows.length,
      columns: rows[0] ? rows[0].length : 0,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message });
  }
}

function doGet(e) {
  const params = e.parameter || {};

  if (params.secret !== SECRET) {
    return outputByMode(params, { ok: false, error: 'Senha invalida.' });
  }

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      return outputByMode(params, { ok: false, error: 'Aba base nao encontrada.' });
    }

    const values = sheet.getDataRange().getDisplayValues();
    const csvText = values.map(row => row.map(csvEscape).join(',')).join('\n');

    return outputByMode(params, {
      ok: true,
      csvText,
      rows: values.length,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    return outputByMode(params, { ok: false, error: error.message });
  }
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function outputByMode(params, data) {
  if (params.mode === 'jsonp') {
    const callback = params.callback || 'callback';
    return ContentService
      .createTextOutput(`${callback}(${JSON.stringify(data)});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  if (params.mode === 'csv' && data.ok) {
    return ContentService
      .createTextOutput(data.csvText || '')
      .setMimeType(ContentService.MimeType.CSV);
  }

  return jsonResponse(data);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```

Depois de substituir o script, publique uma nova versao do Web App em `Implantar > Gerenciar implantacoes > Editar > Nova versao`.

## Cruzar clientes por produto

Na area de pesquisa da carteira, use `Selecionar Produto(s) para Consulta de Compra` para adicionar um ou mais itens do portfolio. Em `Resultado da Compra`, escolha:

- `Com todos`: clientes que compraram todos os itens selecionados.
- `Com algum`: clientes que compraram pelo menos um dos itens.
- `Falta algum`: clientes que ainda nao compraram um ou mais itens selecionados.
- `Sem compra`: clientes que nao compraram nenhum dos itens selecionados.

Os cards dos clientes mostram a contagem `comprados/selecionados` e sinalizam os codigos com compra ou sem compra.

## Filtrar por mes/ano e exportar Excel

Na area de pesquisa da carteira, use `Filtrar por Mes` e `Filtrar por Ano` para analisar apenas o periodo desejado. E possivel marcar um ou mais meses, por exemplo abril, maio e junho. Se nenhum mes estiver marcado, o app considera todos os meses. O filtro afeta os indicadores, a lista de clientes, a consulta por produtos e a matriz de positivacao.

O botao `Exportar Excel` baixa um arquivo `.xls` com:

- resumo dos filtros usados;
- clientes encontrados na pesquisa atual;
- matriz de produtos conforme os filtros ativos.

## Observacao

O app usa Tailwind CSS e Lucide Icons via CDN. Isso simplifica o deploy estatico; em uma evolucao futura, vale migrar para um build com Tailwind CLI ou Vite.
