const SPREADSHEET_ID = '1nKyWcFSb2tCSwWUcEOtpxtr1ptThiBWzUGikw7px3_U';
const SHEET_NAME = 'base';
const SECRET = 'positiva-sim-2026';

function doGet(e) {
  const params = e.parameter || {};

  if (params.mode === 'jsonp') {
    return readBase(params);
  }

  return HtmlService.createHtmlOutput(getUploadHtml())
    .setTitle('Atualizador Central - Positiva Sim');
}

function doPost(e) {
  try {
    const payload = e.parameter && e.parameter.csvText
      ? e.parameter
      : JSON.parse((e.postData && e.postData.contents) || '{}');

    if (payload.secret !== SECRET) {
      return jsonResponse({ ok: false, error: 'Senha invalida.' });
    }

    return jsonResponse(updateBase(payload.csvText || ''));
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message });
  }
}

function startUpdate() {
  const sheet = getBaseSheet();
  sheet.clearContents();

  return {
    ok: true,
    startedAt: new Date().toISOString()
  };
}

function appendRows(rows) {
  if (!rows || !rows.length) {
    return { ok: true, rows: 0, columns: 0 };
  }

  const sheet = getBaseSheet();
  let width = 0;

  rows.forEach(function(row) {
    if (row.length > width) width = row.length;
  });

  const normalizedRows = rows.map(function(row) {
    const copy = row.slice();
    while (copy.length < width) copy.push('');
    return copy;
  });

  const startRow = Math.max(sheet.getLastRow() + 1, 1);
  sheet.getRange(startRow, 1, normalizedRows.length, width).setValues(normalizedRows);

  return {
    ok: true,
    rows: normalizedRows.length,
    columns: width
  };
}

function finishUpdate() {
  SpreadsheetApp.flush();

  const sheet = getBaseSheet();

  return {
    ok: true,
    rows: sheet.getLastRow(),
    columns: sheet.getLastColumn(),
    updatedAt: new Date().toISOString()
  };
}

function updateBase(csvText) {
  const delimiter = detectDelimiter(csvText || '');
  const rows = Utilities.parseCsv(csvText || '', delimiter);

  startUpdate();

  const batchSize = 1500;

  for (let i = 0; i < rows.length; i += batchSize) {
    appendRows(rows.slice(i, i + batchSize));
  }

  return finishUpdate();
}

function readBase(params) {
  if ((params.secret || '') !== SECRET) {
    return jsonpResponse(params.callback, {
      ok: false,
      error: 'Senha invalida.'
    });
  }

  const sheet = getBaseSheet();
  const values = sheet.getDataRange().getDisplayValues();

  if ((params.format || '') === 'compact') {
    return jsonpResponse(params.callback, buildCompactPayload(values));
  }

  const csvText = values.map(function(row) {
    return row.map(csvEscape).join(',');
  }).join('\n');

  return jsonpResponse(params.callback, {
    ok: true,
    csvText: csvText,
    rows: values.length,
    columns: values[0] ? values[0].length : 0,
    updatedAt: new Date().toISOString()
  });
}

function buildCompactPayload(values) {
  if (!values || values.length < 2) {
    return {
      ok: false,
      error: 'Aba base sem dados suficientes.'
    };
  }

  const headers = values[0].map(normalizeHeader);
  const getIdx = function(matches, excludes) {
    excludes = excludes || [];
    const normalizedMatches = matches.map(normalizeHeader);
    const normalizedExcludes = excludes.map(normalizeHeader);

    const exactIdx = headers.findIndex(function(header) {
      return normalizedMatches.indexOf(header) !== -1 &&
        !normalizedExcludes.some(function(exclude) { return header.indexOf(exclude) !== -1; });
    });

    if (exactIdx !== -1) return exactIdx;

    return headers.findIndex(function(header) {
      return normalizedMatches.some(function(match) { return header.indexOf(match) !== -1; }) &&
        !normalizedExcludes.some(function(exclude) { return header.indexOf(exclude) !== -1; });
    });
  };

  const sapIdx = getIdx(['sap', 'codigo emissor', 'código emissor', 'cod emissor']);
  const clientIdx = getIdx(['cliente emissor', 'razao social', 'razão social', 'nome fantasia', 'cliente', 'nome']);
  const sellerIdx = getIdx(['vendedor', 'nome vendedor', 'cod vendedor', 'codigo vendedor', 'código vendedor', 'representante', 'consultor', 'supervisor', 'rca', 'executivo', 'carteira', 'responsavel', 'responsável']);
  const redeIdx = getIdx(['rede', 'grupo']);
  const bairroIdx = getIdx(['bairro', 'bairros']);
  const cidadeIdx = getIdx(['cidade', 'municipio', 'município']);
  const dateIdx = getIdx(['dt faturamento', 'data da ordem', 'data faturamento', 'faturamento', 'data']);
  const typeIdx = getIdx(['tipo produto', 'tipo de produto', 'conservacao', 'conservação'], ['descricao', 'descrição', 'linha']);
  const materialIdx = getIdx(['material', 'codigo material', 'código material', 'material id'], ['descricao', 'descrição']);
  const descIdx = getIdx(['descricao material', 'descrição material', 'descricao produto', 'descrição produto', 'produto', 'item'], ['tipo produto', 'tipo de produto', 'conservacao', 'conservação']);
  const lineIdx = getIdx(['descricao linha', 'descrição linha', 'linha', 'familia', 'família'], ['material', 'produto']);
  const statusIdx = getIdx(['situacao item', 'situação item', 'status item', 'status produto', 'situacao produto', 'situação produto', 'ativo inativo', 'ativo/inativo', 'status', 'situacao', 'situação']);
  const priceIdx = getIdx(['preco', 'preço', 'valor', 'unitario', 'unitário']);
  const qtyIdx = getIdx(['total', 'quant. cx', 'quant', 'quantidade', 'qtd']);

  if (sapIdx === -1 || materialIdx === -1 || descIdx === -1) {
    return {
      ok: false,
      error: 'Mapeamento falhou. Certifique-se de incluir as colunas SAP, Material e Descrição material.'
    };
  }

  const clients = [];
  const products = [];
  const sales = [];
  const seenClients = {};
  const seenProducts = {};

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const sap = String(row[sapIdx] || '').trim();
    const material = String(row[materialIdx] || '').trim();

    if (!sap || !material) continue;

    const clientName = clientIdx !== -1 ? row[clientIdx] : '';
    const seller = sellerIdx !== -1 ? row[sellerIdx] : '';
    const rede = redeIdx !== -1 ? row[redeIdx] : '';
    const bairro = bairroIdx !== -1 ? row[bairroIdx] : '';
    const cidade = cidadeIdx !== -1 ? row[cidadeIdx] : '';
    const productName = descIdx !== -1 ? row[descIdx] : '';
    const type = typeIdx !== -1 ? row[typeIdx] : '';
    const line = lineIdx !== -1 ? row[lineIdx] : '';
    const status = statusIdx !== -1 ? row[statusIdx] : '';
    const price = priceIdx !== -1 ? parsePrice(row[priceIdx]) : 0;
    const quantity = qtyIdx !== -1 ? parseQuantity(row[qtyIdx]) : 1;
    const date = dateIdx !== -1 ? normalizeDateValue(row[dateIdx]) : '';

    if (!seenClients[sap]) {
      seenClients[sap] = true;
      clients.push([
        sap,
        clientName || 'CLIENTE SAP ' + sap,
        seller || 'SEM VENDEDOR',
        rede || 'SEM REDE',
        bairro || 'SEM BAIRRO',
        cidade || 'SEM CIDADE'
      ]);
    }

    if (!seenProducts[material]) {
      seenProducts[material] = true;
      products.push([
        material,
        productName || 'Produto Não Especificado',
        type || 'LINHA SECA',
        line || inferFamilyLine(productName || ''),
        normalizeItemStatus(status || 'ATIVO'),
        price || 10
      ]);
    }

    sales.push([sap, material, date, price, quantity || 1]);
  }

  return {
    ok: true,
    compact: true,
    clients: clients,
    products: products,
    sales: sales,
    rows: values.length,
    columns: values[0] ? values[0].length : 0,
    updatedAt: new Date().toISOString()
  };
}

function getBaseSheet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  return sheet;
}

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function detectDelimiter(csvText) {
  const firstLine = (csvText.split(/\r?\n/)[0] || '');
  const tabs = (firstLine.match(/\t/g) || []).length;
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;

  if (tabs >= semicolons && tabs >= commas && tabs > 0) return '\t';
  if (semicolons >= commas && semicolons > 0) return ';';
  return ',';
}

function parsePrice(value) {
  const text = String(value || '').trim();
  if (!text) return 0;

  const cleaned = text
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');

  const parsed = Number(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function parseQuantity(value) {
  const text = String(value || '').trim();
  if (!text) return 0;

  const cleaned = text
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');

  const parsed = Number(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function normalizeDateValue(rawDate) {
  if (!rawDate) return '';

  const value = String(rawDate).trim();
  const parts = value.split(/[./\-\sT:]+/).filter(Boolean);

  if (parts.length >= 3 && parts[0].length === 4) {
    return parts[0] + '-' + pad2(parts[1]) + '-' + pad2(parts[2]);
  }

  if (parts.length >= 3 && parts[2].length === 4) {
    const first = Number(parts[0]);
    const second = Number(parts[1]);
    const isGoogleMonthFirstDate = first >= 1 && first <= 12 && second > 12;
    const day = isGoogleMonthFirstDate ? parts[1] : parts[0];
    const month = isGoogleMonthFirstDate ? parts[0] : parts[1];

    return parts[2] + '-' + pad2(month) + '-' + pad2(day);
  }

  return value;
}

function pad2(value) {
  return String(value || '').padStart(2, '0');
}

function normalizeItemStatus(value) {
  const text = String(value || '').trim().toUpperCase();
  if (!text) return 'ATIVO';
  if (text.indexOf('INAT') !== -1) return 'INATIVO';
  return 'ATIVO';
}

function inferFamilyLine(productName) {
  const text = String(productName || '').toUpperCase();
  if (text.indexOf('CREME') !== -1) return 'CREME DE LEITE';
  if (text.indexOf('CONDENS') !== -1) return 'LEITE CONDENSADO';
  if (text.indexOf('PO ') !== -1 || text.indexOf('POUCH') !== -1) return 'LEITE EM PO';
  if (text.indexOf('DOCE') !== -1) return 'DOCE DE LEITE';
  if (text.indexOf('BEB') !== -1 || text.indexOf('UHT') !== -1) return 'BEBIDAS';
  return 'OUTROS';
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);

  if (/[",\n\r]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }

  return text;
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonpResponse(callback, payload) {
  const callbackName = callback || 'callback';

  return ContentService
    .createTextOutput(callbackName + '(' + JSON.stringify(payload) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function getUploadHtml() {
  return `
    <html>
      <head>
        <base target="_top">
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body style="font-family:Arial;padding:24px;max-width:760px;margin:auto">
        <h2>Atualizador Central - Positiva Sim</h2>
        <p>Selecione o CSV para atualizar a aba <b>base</b>.</p>

        <input type="file" id="file" accept=".csv,.txt,.tsv">
        <button onclick="send()" style="padding:10px 16px;margin-left:8px">Enviar</button>

        <pre id="out" style="white-space:pre-wrap;background:#f4f4f4;padding:12px;margin-top:16px"></pre>

        <script>
          const BATCH_SIZE = 1500;

          function send() {
            const fileInput = document.getElementById('file');
            const file = fileInput.files[0];

            if (!file) {
              alert('Selecione um arquivo.');
              return;
            }

            document.getElementById('out').textContent = 'Lendo arquivo...';

            const reader = new FileReader();

            reader.onload = async function () {
              try {
                const text = reader.result || '';
                const rows = parseCsvRows(text);

                if (rows.length < 2) {
                  throw new Error('Arquivo sem dados suficientes.');
                }

                document.getElementById('out').textContent =
                  'Iniciando atualização...\\nLinhas encontradas: ' + rows.length;

                await runServer('startUpdate');

                let sent = 0;

                for (let i = 0; i < rows.length; i += BATCH_SIZE) {
                  const batch = rows.slice(i, i + BATCH_SIZE);
                  await runServer('appendRows', batch);
                  sent += batch.length;

                  document.getElementById('out').textContent =
                    'Atualizando base...\\n' +
                    sent + ' de ' + rows.length + ' linhas enviadas.';
                }

                const result = await runServer('finishUpdate');

                document.getElementById('out').textContent =
                  'Atualização concluída!\\n\\n' + JSON.stringify(result, null, 2);
              } catch (error) {
                document.getElementById('out').textContent =
                  'Erro ao atualizar:\\n\\n' + (error && error.message ? error.message : error);
              }
            };

            reader.onerror = function () {
              document.getElementById('out').textContent = 'Erro ao ler o arquivo.';
            };

            reader.readAsText(file, 'UTF-8');
          }

          function runServer(functionName, arg) {
            return new Promise(function(resolve, reject) {
              const runner = google.script.run
                .withSuccessHandler(resolve)
                .withFailureHandler(reject);

              if (typeof arg === 'undefined') {
                runner[functionName]();
              } else {
                runner[functionName](arg);
              }
            });
          }

          function parseCsvRows(text) {
            const delimiter = detectDelimiter(text);
            const rows = [];
            let row = [];
            let cell = '';
            let insideQuotes = false;

            for (let i = 0; i < text.length; i++) {
              const char = text[i];
              const next = text[i + 1];

              if (char === '"') {
                if (insideQuotes && next === '"') {
                  cell += '"';
                  i++;
                } else {
                  insideQuotes = !insideQuotes;
                }
                continue;
              }

              if (char === delimiter && !insideQuotes) {
                row.push(cell.trim());
                cell = '';
                continue;
              }

              if ((char === '\\n' || char === '\\r') && !insideQuotes) {
                if (char === '\\r' && next === '\\n') i++;
                row.push(cell.trim());

                if (row.some(function(value) { return value !== ''; })) {
                  rows.push(row);
                }

                row = [];
                cell = '';
                continue;
              }

              cell += char;
            }

            row.push(cell.trim());

            if (row.some(function(value) { return value !== ''; })) {
              rows.push(row);
            }

            return rows;
          }

          function detectDelimiter(text) {
            const firstLine = (text.split(/\\r?\\n/)[0] || '');
            const tabs = (firstLine.match(/\\t/g) || []).length;
            const semicolons = (firstLine.match(/;/g) || []).length;
            const commas = (firstLine.match(/,/g) || []).length;

            if (tabs >= semicolons && tabs >= commas && tabs > 0) return '\\t';
            if (semicolons >= commas && semicolons > 0) return ';';
            return ',';
          }
        </script>
      </body>
    </html>
  `;
}
