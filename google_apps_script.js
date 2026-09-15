/**
 * GOOGLE APPS SCRIPT - RECEPTOR E HISTORIAL DE CONTRATOS HOME LINE
 * Este script se instala en la cuenta de Google de la empresa (Gmail o Google Workspace).
 * - Guarda los PDFs organizados en 3 subcarpetas: Contratos Lima, Contratos Arequipa y Proformas.
 * - Mantiene una base de datos de contratos editables en la subcarpeta _Datos_Editables.
 * - Permite a cualquier colaborador con el link consultar el historial compartido y reabrir contratos.
 */

// Carpeta principal de la empresa en Google Drive
var NOMBRE_CARPETA_DESTINO = "Contratos y Proformas - Home Line";

// Nombres de las subcarpetas automáticas
var SUBFOLDER_LIMA = "Contratos Lima";
var SUBFOLDER_AREQUIPA = "Contratos Arequipa";
var SUBFOLDER_PROFORMAS = "Proformas";
var SUBFOLDER_DATOS = "_Datos_Editables";
var ARCHIVO_INDICE_HISTORIAL = "indice_contratos.json";

// =========================================================================
// RECEPCIÓN DE DOCUMENTOS (POST)
// =========================================================================
function doPost(e) {
  try {
    // 1. Extraer los datos enviados (soporta formulario oculto iframe y JSON directo)
    var rawData = "";
    if (e && e.parameter && e.parameter.data) {
      rawData = e.parameter.data;
    } else if (e && e.postData && e.postData.contents) {
      var contents = e.postData.contents;
      if (contents.indexOf("data=") === 0) {
        var encodedData = contents.substring(5);
        rawData = decodeURIComponent(encodedData.replace(/\+/g, " "));
      } else {
        rawData = contents;
      }
    } else {
      throw new Error("No se recibieron datos en la solicitud.");
    }

    var data = JSON.parse(rawData);

    // 2. Obtener o crear la carpeta principal y las subcarpetas en Google Drive
    var mainFolder = getOrCreateFolder(DriveApp.getRootFolder(), NOMBRE_CARPETA_DESTINO);
    var folderLima = getOrCreateFolder(mainFolder, SUBFOLDER_LIMA);
    var folderArequipa = getOrCreateFolder(mainFolder, SUBFOLDER_AREQUIPA);
    var folderProformas = getOrCreateFolder(mainFolder, SUBFOLDER_PROFORMAS);
    var folderDatos = getOrCreateFolder(mainFolder, SUBFOLDER_DATOS);

    // 3. Nombre del archivo (ej. CONTRATO_L126-2026_FREDDY_RAMOS.pdf)
    var fileName = data.fileName || ("CONTRATO_" + Utilities.formatDate(new Date(), "GMT-5", "yyyy-MM-dd_HH-mm") + ".json");
    if (!fileName.toLowerCase().endsWith(".json")) {
      fileName = fileName.replace(/\.pdf$/i, "") + ".json";
    }

    // 4. Determinar en qué subcarpeta debe guardarse según el código y tipo
    var targetFolder = folderProformas;
    var subfolderName = SUBFOLDER_PROFORMAS;
    var upperName = fileName.toUpperCase();
    var docType = (data.docType || "").toUpperCase();

    if (docType === "PROFORMA" || upperName.indexOf("PROFORMA") !== -1) {
      targetFolder = folderProformas;
      subfolderName = SUBFOLDER_PROFORMAS;
    } else if (upperName.indexOf("_L") !== -1 || upperName.indexOf("-L") !== -1 || /^L\d+/i.test(upperName) || /_L\d+/i.test(upperName)) {
      // Contratos de Lima (ej. CONTRATO_L126-2026...)
      targetFolder = folderLima;
      subfolderName = SUBFOLDER_LIMA;
    } else if (upperName.indexOf("_A") !== -1 || upperName.indexOf("-A") !== -1 || /^A\d+/i.test(upperName) || /_A\d+/i.test(upperName)) {
      // Contratos de Arequipa (ej. CONTRATO_A156-2026...)
      targetFolder = folderArequipa;
      subfolderName = SUBFOLDER_AREQUIPA;
    } else {
      // Si no tiene prefijo L ni A pero es contrato, asignar a Lima por defecto
      targetFolder = folderLima;
      subfolderName = SUBFOLDER_LIMA;
    }

    // 5. Guardar la ficha técnica editable (JSON) en la subcarpeta correspondiente y en _Datos_Editables
    var contractCode = data.contractCode || extractContractCode(fileName);
    var contractDataToSave = data.contractData || null;
    var jsonFile = null;

    if (contractDataToSave) {
      // Garantizar que la información del adelanto y saldo esté presente y explícita en el archivo .json
      var rawAdelanto = data.adelanto || data.adelantoAmount || data.montoAdelanto ||
                        contractDataToSave.adelantoAmount || contractDataToSave.adelanto ||
                        contractDataToSave.montoAdelanto || contractDataToSave.inputAdelanto ||
                        contractDataToSave.valAdelanto || "0.00";

      contractDataToSave.adelantoAmount = rawAdelanto;
      contractDataToSave.adelanto = rawAdelanto;
      contractDataToSave.montoAdelanto = rawAdelanto;
      contractDataToSave.inputAdelanto = rawAdelanto;
      contractDataToSave.valAdelanto = rawAdelanto;

      if (data.saldo || contractDataToSave.saldo) {
        contractDataToSave.saldo = data.saldo || contractDataToSave.saldo;
      }
      if (data.totalAmount || contractDataToSave.total || contractDataToSave.totalAmount) {
        contractDataToSave.total = data.totalAmount || contractDataToSave.total || contractDataToSave.totalAmount;
      }

      var jsonContent = JSON.stringify(contractDataToSave, null, 2);

      // Guardar en la subcarpeta correspondiente (Lima, Arequipa o Proformas)
      var existingInFolder = targetFolder.getFilesByName(fileName);
      if (existingInFolder.hasNext()) {
        jsonFile = existingInFolder.next();
        jsonFile.setContent(jsonContent);
      } else {
        jsonFile = targetFolder.createFile(fileName, jsonContent, "application/json");
      }

      // Guardar también copia identificada por código en _Datos_Editables para indexación rápida
      var internalCodeName = contractCode + ".json";
      var existingInDatos = folderDatos.getFilesByName(internalCodeName);
      if (existingInDatos.hasNext()) {
        existingInDatos.next().setContent(jsonContent);
      } else {
        folderDatos.createFile(internalCodeName, jsonContent, "application/json");
      }

      // Configurar permisos de lectura si es necesario
      try {
        jsonFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (sharingError) {
        console.warn("Permiso público omitido: " + sharingError);
      }

      // Actualizar el índice central de contratos para búsquedas ultra rápidas
      updateHistoryIndex(folderDatos, {
        code: contractCode,
        title: data.contractTitle || contractCode,
        client: data.clientName || "Cliente",
        fileName: fileName,
        fileUrl: jsonFile.getUrl(),
        subfolder: subfolderName,
        date: Utilities.formatDate(new Date(), "GMT-5", "yyyy-MM-dd HH:mm"),
        isUpdated: !!data.isUpdated,
        adelanto: rawAdelanto,
        saldo: contractDataToSave.saldo || "0.00",
        total: contractDataToSave.total || "0.00"
      });
    } else {
      throw new Error("No se recibieron datos de contrato válidos para guardar.");
    }

    // 6. Preparar respuesta
    var responseObj = {
      status: "success",
      message: "Ficha del contrato guardada exitosamente en Google Drive",
      fileName: fileName,
      fileUrl: jsonFile ? jsonFile.getUrl() : null,
      subfolder: subfolderName,
      code: contractCode
    };

    if (e && e.parameter && e.parameter.format === "json") {
      return ContentService.createTextOutput(JSON.stringify(responseObj)).setMimeType(ContentService.MimeType.JSON);
    }

    // Para iframe: postMessage
    var htmlSuccess = "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body>" +
      "<script>" +
      "  try { window.parent.postMessage(" + JSON.stringify(responseObj) + ", '*'); } catch(e){}" +
      "</script>" +
      "<div style='font-family:Arial;padding:20px;color:#0d9488;text-align:center;'>" +
      "  <h3>✅ Guardado en Google Drive</h3>" +
      "  <p><strong>" + fileName + "</strong></p>" +
      "  <p>Carpeta: " + subfolderName + "</p>" +
      "</div></body></html>";

    return HtmlService.createHtmlOutput(htmlSuccess);

  } catch (error) {
    var errorObj = { status: "error", message: error.toString() };
    var htmlError = "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body>" +
      "<script>" +
      "  try { window.parent.postMessage(" + JSON.stringify(errorObj) + ", '*'); } catch(e){}" +
      "</script>" +
      "<p style='color:red;'>Error: " + error.toString() + "</p>" +
      "</body></html>";

    return HtmlService.createHtmlOutput(htmlError);
  }
}

// =========================================================================
// CONSULTA DE HISTORIAL Y DATOS (GET / JSONP)
// =========================================================================
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "";
  var callback = (e && e.parameter && e.parameter.callback) ? e.parameter.callback : "";

  // Acción 1: Listar historial de contratos compartidos en la nube
  if (action === "list") {
    try {
      var mainFolder = getOrCreateFolder(DriveApp.getRootFolder(), NOMBRE_CARPETA_DESTINO);
      var folderDatos = getOrCreateFolder(mainFolder, SUBFOLDER_DATOS);
      var folderLima = getOrCreateFolder(mainFolder, SUBFOLDER_LIMA);
      var folderArequipa = getOrCreateFolder(mainFolder, SUBFOLDER_AREQUIPA);
      var indexFile = folderDatos.getFilesByName(ARCHIVO_INDICE_HISTORIAL);

      var list = [];
      if (indexFile.hasNext()) {
        var content = indexFile.next().getBlob().getDataAsString();
        try {
          list = JSON.parse(content || "[]");
        } catch (e) {
          list = [];
        }
      }

      // Filtrar contratos cuyos archivos realmente existan en Drive y no estén en la papelera
      var validList = [];
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        var fileStillExists = false;
        try {
          var code = c.code || "";
          if (code) {
            var files = folderDatos.getFilesByName(code + ".json");
            if (files.hasNext()) {
              var f = files.next();
              if (!f.isTrashed()) {
                fileStillExists = true;
              }
            }
          }
          if (!fileStillExists && c.fileName) {
            var filesByName = mainFolder.searchFiles("title = '" + c.fileName + "' and trashed = false");
            if (filesByName.hasNext()) {
              fileStillExists = true;
            }
          }
        } catch (checkErr) {
          fileStillExists = true;
        }

        if (fileStillExists) {
          validList.push(c);
        }
      }

      // Si se detectaron archivos borrados manualmente en Drive, actualizar el archivo índice automáticamente
      if (validList.length !== list.length) {
        list = validList;
        try {
          var idxFiles = folderDatos.getFilesByName(ARCHIVO_INDICE_HISTORIAL);
          if (idxFiles.hasNext()) {
            idxFiles.next().setContent(JSON.stringify(list));
          }
        } catch (updateErr) {}
      }

      var stats = calculateDriveHighestStats(list, folderLima, folderArequipa);

      var result = {
        status: "success",
        contracts: list,
        highestLima: stats.highestLima,
        highestArequipa: stats.highestArequipa
      };
      return outputJson(result, callback);
    } catch (err) {
      return outputJson({ status: "error", message: err.toString(), contracts: [] }, callback);
    }
  }

  // Acción 2: Vaciar el historial de contratos en Google Drive
  if (action === "clear") {
    try {
      var mainFolder = getOrCreateFolder(DriveApp.getRootFolder(), NOMBRE_CARPETA_DESTINO);
      var folderDatos = getOrCreateFolder(mainFolder, SUBFOLDER_DATOS);
      var idxFiles = folderDatos.getFilesByName(ARCHIVO_INDICE_HISTORIAL);
      if (idxFiles.hasNext()) {
        idxFiles.next().setContent("[]");
      }
      return outputJson({ status: "success", message: "Historial de Google Drive vaciado con éxito", contracts: [] }, callback);
    } catch (err) {
      return outputJson({ status: "error", message: err.toString() }, callback);
    }
  }

  // Acción 3: Obtener el contenido editable de un contrato por su código
  if (action === "get") {
    try {
      var code = e.parameter.code || "";
      var mainFolder = getOrCreateFolder(DriveApp.getRootFolder(), NOMBRE_CARPETA_DESTINO);
      var folderDatos = getOrCreateFolder(mainFolder, SUBFOLDER_DATOS);
      var targetFile = folderDatos.getFilesByName(code + ".json");

      if (targetFile.hasNext()) {
        var contractJson = JSON.parse(targetFile.next().getBlob().getDataAsString());
        return outputJson({ status: "success", contractData: contractJson }, callback);
      } else {
        // Búsqueda alternativa en todo el directorio por si el archivo fue guardado con nombre completo
        var searchFiles = mainFolder.searchFiles("title contains '" + code + "' and title contains '.json' and trashed = false");
        if (searchFiles.hasNext()) {
          var fallbackFile = searchFiles.next();
          var contractJson = JSON.parse(fallbackFile.getBlob().getDataAsString());
          return outputJson({ status: "success", contractData: contractJson }, callback);
        }
        return outputJson({ status: "not_found", message: "Contrato no encontrado en la nube" }, callback);
      }
    } catch (err) {
      return outputJson({ status: "error", message: err.toString() }, callback);
    }
  }

  // Respuesta por defecto: comprobación de salud del webhook en formato JSON
  return ContentService.createTextOutput(JSON.stringify({
    status: "active",
    message: "Servicio de Google Drive para Home Line activo y listo para recibir contratos."
  })).setMimeType(ContentService.MimeType.JSON);
}

// =========================================================================
// FUNCIONES AUXILIARES
// =========================================================================
function getOrCreateFolder(parent, folderName) {
  var folders = parent.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parent.createFolder(folderName);
}

function updateHistoryIndex(folderDatos, entry) {
  try {
    var indexFiles = folderDatos.getFilesByName(ARCHIVO_INDICE_HISTORIAL);
    var list = [];
    var file;

    if (indexFiles.hasNext()) {
      file = indexFiles.next();
      try {
        list = JSON.parse(file.getBlob().getDataAsString() || "[]");
      } catch (e) {
        list = [];
      }
    }

    // Si ya existe una entrada con el mismo código, actualizarla; sino agregarla al inicio
    var foundIndex = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].code === entry.code) {
        foundIndex = i;
        break;
      }
    }

    if (foundIndex >= 0) {
      list[foundIndex] = entry;
    } else {
      list.unshift(entry);
    }

    // Mantener los últimos 200 contratos
    if (list.length > 200) {
      list = list.slice(0, 200);
    }

    var jsonStr = JSON.stringify(list, null, 2);
    if (file) {
      file.setContent(jsonStr);
    } else {
      folderDatos.createFile(ARCHIVO_INDICE_HISTORIAL, jsonStr, "application/json");
    }
  } catch (err) {
    console.warn("Error actualizando índice de contratos:", err);
  }
}

function extractContractCode(fileName) {
  var clean = fileName.replace(/\.pdf$/i, "");
  var match = clean.match(/([LA]\d+[\-_]\d{4}|[LA]\d+|PROFORMA)/i);
  if (match) {
    return match[1].toUpperCase().replace("_", "-");
  }
  return "DOC_" + Utilities.formatDate(new Date(), "GMT-5", "yyyyMMdd_HHmm");
}

function outputJson(obj, callback) {
  var jsonStr = JSON.stringify(obj);
  if (callback && callback.trim()) {
    // JSONP para evitar 100% cualquier bloqueo CORS en navegadores
    var jsonp = callback.trim() + "(" + jsonStr + ");";
    return ContentService.createTextOutput(jsonp).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(jsonStr).setMimeType(ContentService.MimeType.JSON);
}

function calculateDriveHighestStats(list, folderLima, folderArequipa) {
  var maxLima = 0;
  var maxLimaYr = new Date().getFullYear();
  var maxAreq = 0;
  var maxAreqYr = new Date().getFullYear();
  var currentYear = new Date().getFullYear();

  function scanStr(str) {
    if (!str) return;
    str = String(str).toUpperCase();

    // Lima: Buscar L seguido de números (ej. L263-2026, L132, etc.)
    var matchL = str.match(/(?:^|[^a-zA-Z0-9])L\s*(\d+)(?:[\-_ ]*(\d{4}))?/i);
    if (matchL) {
      var numL = parseInt(matchL[1], 10);
      if (numL > maxLima) {
        maxLima = numL;
        if (matchL[2]) maxLimaYr = matchL[2];
      }
    }

    // Arequipa: Buscar A seguido de números (ej. A156-2026, A132, etc.)
    var matchA = str.match(/(?:^|[^a-zA-Z0-9])A\s*(\d+)(?:[\-_ ]*(\d{4}))?/i);
    if (matchA) {
      var numA = parseInt(matchA[1], 10);
      if (numA > maxAreq) {
        maxAreq = numA;
        if (matchA[2]) maxAreqYr = matchA[2];
      }
    }
  }

  // 1. Escanear contratos en el índice
  if (list && list.length) {
    for (var i = 0; i < list.length; i++) {
      scanStr(list[i].code);
      scanStr(list[i].fileName);
      scanStr(list[i].title);
    }
  }

  // 2. Escanear archivos físicos existentes en las subcarpetas de Google Drive
  try {
    if (folderLima) {
      var fLima = folderLima.getFiles();
      while (fLima.hasNext()) scanStr(fLima.next().getName());
    }
    if (folderArequipa) {
      var fAreq = folderArequipa.getFiles();
      while (fAreq.hasNext()) scanStr(fAreq.next().getName());
    }
  } catch (e) {}

  return {
    highestLima: {
      number: maxLima,
      code: maxLima > 0 ? ("L" + maxLima + "-" + maxLimaYr) : "Sin registros",
      nextCode: "L" + (maxLima > 0 ? (maxLima + 1) : 1) + "-" + currentYear
    },
    highestArequipa: {
      number: maxAreq,
      code: maxAreq > 0 ? ("A" + maxAreq + "-" + maxAreqYr) : "Sin registros",
      nextCode: "A" + (maxAreq > 0 ? (maxAreq + 1) : 1) + "-" + currentYear
    }
  };
}
