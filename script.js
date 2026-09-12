/**
 * LÓGICA INTERACTIVA - CONTRATOS Y PROFORMAS COMERCIALES HOME LINE (V4 + GOOGLE DRIVE)
 * Integración con Google Drive de la empresa vía Google Apps Script,
 * reordenamiento de items (▲ / ▼), foto al costado derecho,
 * saludo sin flecha con ancho dinámico y flujo continuo estilo Word.
 */

(() => {
  'use strict';

  const STORAGE_KEY = 'homeline_contract_data_v4';
  const DRIVE_KEY = 'homeline_drive_webhook_url';
  const todayStr = new Date().toISOString().split('T')[0];

  // URL permanente pre-vinculada de Google Apps Script (Empresa Home Line)
  const DEFAULT_DRIVE_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzegupwLcqbv7mrAts8yJAJLDVfEHVDreeueGjuelwSevpuQaQ-XLdkE9mIH-JhYUoB/exec';

  function getDriveWebhookUrl() {
    const saved = localStorage.getItem(DRIVE_KEY);
    if (saved && saved.trim() && !saved.includes('/edit') && saved.includes('/exec')) {
      return saved.trim();
    }
    return DEFAULT_DRIVE_WEBHOOK_URL;
  }

  // Plantilla limpia inicial
  const BLANK_TEMPLATE = {
    docType: 'contrato', // 'contrato' | 'proforma'
    contractTitle: 'CONTRATO A132 - 2026',
    clientCompany: '',
    clientDoc: '',
    clientAttention: '',
    clientAddress: '',
    clientService: '',
    clientIssueDate: todayStr,
    clientContact: '',
    clientDeliveryDate: '',
    greetingTitle: 'Sr.',
    greetingName: '',
    items: [
      {
        title: '',
        description: '',
        qty: '1',
        price: '',
        image: null
      }
    ],
    movilidad: {
      type: 'incluye', // incluye | costo | no_incluye
      label: 'Incluye Movilidad',
      qty: '1',
      price: '0.00'
    },
    noIncluye: {
      items: ['Cables', 'Tomacorrientes', 'Canaleta para punto de energía'],
      customText: ''
    },
    discountEnabled: false,
    discountAmount: '0.00',
    adelantoAmount: '0.00',
    condAdelantoPct: '20%',
    notaTecnica: ''
  };

  let contractData = loadContractData();

  // ==========================================================
  // ELEMENTOS DEL DOM
  // ==========================================================
  const btnTypeContrato = document.getElementById('btnTypeContrato');
  const btnTypeProforma = document.getElementById('btnTypeProforma');

  const contractTitle = document.getElementById('contractTitle');
  const clientCompany = document.getElementById('clientCompany');
  const clientDoc = document.getElementById('clientDoc');
  const clientAttention = document.getElementById('clientAttention');
  const clientAddress = document.getElementById('clientAddress');
  const clientService = document.getElementById('clientService');
  const clientIssueDate = document.getElementById('clientIssueDate');
  const clientContact = document.getElementById('clientContact');
  const clientDeliveryDate = document.getElementById('clientDeliveryDate');

  const greetingTitle = document.getElementById('greetingTitle');
  const greetingName = document.getElementById('greetingName');

  const tbodyItems = document.getElementById('tbodyItems');
  const btnAddItem = document.getElementById('btnAddItem');

  // Movilidad
  const numMovilidad = document.getElementById('numMovilidad');
  const labelMovilidad = document.getElementById('labelMovilidad');
  const qtyMovilidad = document.getElementById('qtyMovilidad');
  const priceMovilidad = document.getElementById('priceMovilidad');
  const optMovilidadRadios = document.querySelectorAll('input[name="optMovilidad"]');

  // No Incluye
  const numNoIncluye = document.getElementById('numNoIncluye');
  const textNoIncluye = document.getElementById('textNoIncluye');
  const chkNoIncBoxes = document.querySelectorAll('.chk-no-inc');
  // Nota Técnica / Horario de Instalación
  const rowNotaTecnica = document.getElementById('rowNotaTecnica');
  const textNotaTecnica = document.getElementById('textNotaTecnica');
  const btnInsertHorarioInstalacion = document.getElementById('btnInsertHorarioInstalacion');
  const btnClearNotaTecnica = document.getElementById('btnClearNotaTecnica');
  const TEXTO_HORARIO_ESTANDAR = 'La instalación tendrá una duración aproximada de 1-2 días, en un horario de 10:00 a. m. a 5:00 p. m. durante cada jornada.';

  function updateNotaTecnicaState() {
    if (!textNotaTecnica || !rowNotaTecnica) return;
    const val = textNotaTecnica.value.trim();
    if (val) {
      rowNotaTecnica.classList.remove('is-empty-print');
      if (btnClearNotaTecnica) btnClearNotaTecnica.style.display = 'inline-block';
    } else {
      rowNotaTecnica.classList.add('is-empty-print');
      if (btnClearNotaTecnica) btnClearNotaTecnica.style.display = 'none';
    }
  }

  // Totales
  const valSubtotal = document.getElementById('valSubtotal');
  const rowDescuento = document.getElementById('rowDescuento');
  const inputDescuento = document.getElementById('inputDescuento');
  const chkDescuento = document.getElementById('chkDescuento');
  const chkEnableDiscount = document.getElementById('chkEnableDiscount');
  const rowToggleDescuento = document.getElementById('rowToggleDescuento');
  const rowTotalSinIgv = document.getElementById('rowTotalSinIgv');
  const valTotalSinIgv = document.getElementById('valTotalSinIgv');
  const inputAdelanto = document.getElementById('inputAdelanto');
  const valSaldo = document.getElementById('valSaldo');

  // Condiciones
  const condAdelantoPct = document.getElementById('condAdelantoPct');

  // Toolbar & Drive
  const btnPrintPdf = document.getElementById('btnPrintPdf');
  const btnSaveDrive = document.getElementById('btnSaveDrive');
  const btnConfigDrive = document.getElementById('btnConfigDrive');
  const btnClearContract = document.getElementById('btnClearContract');
  const saveIndicator = document.getElementById('saveIndicator');

  // Historial y Actualizado
  const btnHistoryContracts = document.getElementById('btnHistoryContracts');
  const lblContractUpdated = document.getElementById('lblContractUpdated');
  const chkContractUpdated = document.getElementById('chkContractUpdated');
  const btnUploadContract = document.getElementById('btnUploadContract');
  const inputUploadContract = document.getElementById('inputUploadContract');
  const historyModal = document.getElementById('historyModal');
  const btnCloseHistoryModal = document.getElementById('btnCloseHistoryModal');
  const btnCloseHistoryModalBtn = document.getElementById('btnCloseHistoryModalBtn');
  const inputSearchHistory = document.getElementById('inputSearchHistory');
  const btnRefreshHistory = document.getElementById('btnRefreshHistory');
  const historyListContainer = document.getElementById('historyListContainer');
  const historyCounterText = document.getElementById('historyCounterText');
  const chkSimultaneousDownload = document.getElementById('chkSimultaneousDownload');

  // Modal Google Drive
  const driveModal = document.getElementById('driveModal');
  const btnCloseDriveModal = document.getElementById('btnCloseDriveModal');
  const btnCancelDriveModal = document.getElementById('btnCancelDriveModal');
  const btnSaveDriveConfig = document.getElementById('btnSaveDriveConfig');
  const inputDriveWebhookUrl = document.getElementById('inputDriveWebhookUrl');
  const btnTestDriveConnection = document.getElementById('btnTestDriveConnection');
  const testConnectionStatus = document.getElementById('testConnectionStatus');
  const driveUploadForm = document.getElementById('drive_upload_form');
  const driveUploadData = document.getElementById('drive_upload_data');
  const driveUploadIframe = document.getElementById('drive_upload_iframe');

  // ==========================================================
  // PERSISTENCIA
  // ==========================================================
  function loadContractData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return Object.assign({}, BLANK_TEMPLATE, JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Error cargando contrato guardado:', e);
    }
    return JSON.parse(JSON.stringify(BLANK_TEMPLATE));
  }

  function saveContractData() {
    contractData.contractTitle = contractTitle.value;
    contractData.clientCompany = clientCompany.value;
    contractData.clientDoc = clientDoc.value;
    contractData.clientAttention = clientAttention.value;
    contractData.clientAddress = clientAddress.value;
    contractData.clientService = clientService.value;
    contractData.clientIssueDate = clientIssueDate.value;
    contractData.clientContact = clientContact.value;
    contractData.clientDeliveryDate = clientDeliveryDate.value;

    contractData.greetingTitle = greetingTitle.value;
    contractData.greetingName = greetingName.textContent.trim();

    contractData.movilidad.qty = qtyMovilidad.value;
    contractData.movilidad.price = formatTwoDecimals(priceMovilidad.value);

    if (textNotaTecnica) {
      contractData.notaTecnica = textNotaTecnica.value;
    }
    contractData.discountAmount = formatTwoDecimals(inputDescuento.value);
    contractData.adelantoAmount = formatTwoDecimals(inputAdelanto.value);
    contractData.condAdelantoPct = condAdelantoPct.textContent.trim();

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(contractData));
      saveIndicator.textContent = '💾 Guardado automático';
      saveIndicator.style.opacity = '1';
    } catch (e) {
      console.warn('Error guardando en localStorage:', e);
    }
  }

  // ==========================================================
  // SELECTOR: CONTRATO VS PROFORMA
  // ==========================================================
  function setDocType(type) {
    contractData.docType = type;
    if (type === 'proforma') {
      btnTypeProforma.classList.add('active');
      btnTypeContrato.classList.remove('active');
      contractTitle.value = 'PROFORMA';
      contractTitle.readOnly = true;
    } else {
      btnTypeContrato.classList.add('active');
      btnTypeProforma.classList.remove('active');
      if (contractTitle.value === 'PROFORMA' || !contractTitle.value.trim()) {
        contractTitle.value = 'CONTRATO A132 - 2026';
      }
      contractTitle.readOnly = false;
    }
  }

  btnTypeContrato.addEventListener('click', () => {
    setDocType('contrato');
    saveContractData();
  });
  btnTypeProforma.addEventListener('click', () => {
    setDocType('proforma');
    saveContractData();
  });

  // ==========================================================
  // INICIALIZACIÓN DEL FORMULARIO
  // ==========================================================
  function initForm() {
    setDocType(contractData.docType || 'contrato');

    contractTitle.value = contractData.contractTitle || 'CONTRATO A132 - 2026';
    clientCompany.value = contractData.clientCompany || '';
    clientDoc.value = contractData.clientDoc || '';
    clientAttention.value = contractData.clientAttention || '';
    clientAddress.value = contractData.clientAddress || '';
    clientService.value = contractData.clientService || '';
    clientIssueDate.value = contractData.clientIssueDate || todayStr;
    clientContact.value = contractData.clientContact || '';
    clientDeliveryDate.value = contractData.clientDeliveryDate || '';

    greetingTitle.value = contractData.greetingTitle || 'Sr.';
    greetingName.textContent = contractData.greetingName || '';

    // Movilidad
    const currentMovType = contractData.movilidad.type || 'incluye';
    optMovilidadRadios.forEach(r => {
      r.checked = (r.value === currentMovType);
    });
    qtyMovilidad.value = contractData.movilidad.qty || '1';
    priceMovilidad.value = formatTwoDecimals(contractData.movilidad.price || '0.00');
    updateMovilidadDisplay(currentMovType);

    // No Incluye
    const savedNoInc = contractData.noIncluye.items || [];
    chkNoIncBoxes.forEach(chk => {
      chk.checked = savedNoInc.includes(chk.value);
    });
    if (inputNoIncluyeExtra) {
      inputNoIncluyeExtra.value = contractData.noIncluye.customText || '';
    }
    updateNoIncluyeText();

    // Nota técnica
    if (textNotaTecnica) {
      textNotaTecnica.value = contractData.notaTecnica || '';
      autoResizeTextarea(textNotaTecnica);
      updateNotaTecnicaState();
    }

    // Descuento
    const hasDiscount = !!contractData.discountEnabled;
    chkEnableDiscount.checked = hasDiscount;
    chkDescuento.checked = hasDiscount;
    inputDescuento.value = formatTwoDecimals(contractData.discountAmount || '0.00');

    // Recuperar adelanto asegurando compatibilidad con cualquier variante
    const rawAdelanto = (contractData.adelantoAmount !== undefined && contractData.adelantoAmount !== null && contractData.adelantoAmount !== '')
      ? contractData.adelantoAmount
      : (contractData.adelanto ?? contractData.inputAdelanto ?? contractData.montoAdelanto ?? contractData.valAdelanto ?? '0.00');
    contractData.adelantoAmount = formatTwoDecimals(rawAdelanto);
    if (inputAdelanto) {
      inputAdelanto.value = contractData.adelantoAmount;
    }

    // Condiciones comerciales (% de adelanto) antes de guardar o recalcular
    condAdelantoPct.textContent = contractData.condAdelantoPct || '20%';

    // Renderizar tabla de items primero para que los precios estén en el DOM
    renderItemsTable();

    // Actualizar visibilidad de descuento y recalcular totales con todos los datos presentes
    updateDiscountVisibility(hasDiscount);
    recalculateTotals();

    // Registrar eventos estáticos una sola vez
    if (!window._formListenersAttached) {
      window._formListenersAttached = true;

      // Eventos de Nota Técnica / Horario
      if (btnInsertHorarioInstalacion) {
        btnInsertHorarioInstalacion.addEventListener('click', () => {
          if (textNotaTecnica) {
            textNotaTecnica.value = TEXTO_HORARIO_ESTANDAR;
            autoResizeTextarea(textNotaTecnica);
            updateNotaTecnicaState();
            saveContractData();
          }
        });
      }

      if (btnClearNotaTecnica) {
        btnClearNotaTecnica.addEventListener('click', () => {
          if (textNotaTecnica) {
            textNotaTecnica.value = '';
            autoResizeTextarea(textNotaTecnica);
            updateNotaTecnicaState();
            saveContractData();
          }
        });
      }

      if (textNotaTecnica) {
        textNotaTecnica.addEventListener('input', () => {
          autoResizeTextarea(textNotaTecnica);
          updateNotaTecnicaState();
          saveContractData();
        });
      }

      // Sincronización automática del primer nombre en el saludo ("Estimado Sr. [PrimerNombre]")
      function autoSyncGreetingName() {
        let nameVal = (clientAttention.value.trim() || clientCompany.value.trim());
        nameVal = nameVal.replace(/^(Sr\.|Sra\.|Srta\.|Ing\.|Arq\.|Lic\.|Dr\.|Dra\.|Don|Doña)\s+/i, '').trim();
        const firstName = nameVal ? nameVal.split(/\s+/)[0] : '';
        greetingName.textContent = firstName;
        contractData.greetingName = firstName;
        saveContractData();
      }

      clientAttention.addEventListener('input', autoSyncGreetingName);

      clientCompany.addEventListener('input', () => {
        if (!clientAttention.value.trim()) {
          autoSyncGreetingName();
        }
      });

      greetingName.addEventListener('input', () => {
        contractData.greetingName = greetingName.textContent;
        saveContractData();
      });

      greetingTitle.addEventListener('change', () => {
        contractData.greetingTitle = greetingTitle.value;
        saveContractData();
      });

      // Formatear a 2 decimales en inputs al salir (blur)
      [priceMovilidad, inputDescuento, inputAdelanto].forEach(inp => {
        if (inp) {
          inp.addEventListener('blur', () => {
            inp.value = formatTwoDecimals(inp.value);
            recalculateTotals();
            saveContractData();
          });
        }
      });

      // Eventos en campos principales
      [
        contractTitle, clientCompany, clientDoc, clientAttention,
        clientAddress, clientService, clientIssueDate, clientContact,
        clientDeliveryDate, greetingTitle,
        qtyMovilidad, priceMovilidad, inputDescuento, inputAdelanto
      ].forEach(input => {
        if (input) {
          input.addEventListener('input', () => {
            recalculateTotals();
            saveContractData();
          });
        }
      });

      if (condAdelantoPct) {
        condAdelantoPct.addEventListener('input', saveContractData);
      }
    }

    // Cargar URL guardada en el modal de Drive
    const savedDriveUrl = localStorage.getItem(DRIVE_KEY);
    if (savedDriveUrl) {
      inputDriveWebhookUrl.value = savedDriveUrl;
    }
  }

  // ==========================================================
  // GESTIÓN DE TABLA DE ITEMS: SUBIR (▲), BAJAR (▼), FOTO DERECHA
  // ==========================================================
  function renderItemsTable() {
    tbodyItems.innerHTML = '';

    if (!contractData.items || contractData.items.length === 0) {
      contractData.items = [{ title: '', description: '', qty: '1', price: '', image: null }];
    }

    const totalItems = contractData.items.length;

    contractData.items.forEach((item, index) => {
      const itemNum = index + 1;
      const tr = document.createElement('tr');

      // Columna de imagen al costado derecho de la descripción
      let imgColHtml = '';
      if (item.image) {
        imgColHtml = `
          <div class="item-img-col">
            <div class="item-img-card">
              <img src="${item.image}" alt="Foto ${itemNum}" class="item-side-img">
              <button type="button" class="btn-del-img-badge no-print" data-idx="${index}" title="Quitar foto">&times;</button>
            </div>
          </div>
        `;
      } else {
        imgColHtml = `
          <div class="item-img-col no-print">
            <label class="btn-upload-img-side" title="Subir foto o boceto de este mueble">
              <span style="font-size: 13px;">📷</span>
              <span>Subir Foto</span>
              <input type="file" accept="image/*" class="file-img-input" data-idx="${index}" style="display: none;">
            </label>
          </div>
        `;
      }

      // Botones Subir (▲) y Bajar (▼)
      const isFirst = (index === 0);
      const isLast = (index === totalItems - 1);

      tr.innerHTML = `
        <td class="col-item">${itemNum}</td>
        <td class="col-detalle">
          <input type="text" class="item-title-input" data-idx="${index}" data-field="title" value="${escapeHtml(item.title)}" placeholder="Nombre del Mueble / Servicio (Ej. Mueble TV)">
          <div class="item-desc-and-img-row">
            <textarea class="item-desc-textarea" data-idx="${index}" data-field="description" placeholder="- Colores:\n- Medidas:\n- Características detalladas...">${escapeHtml(item.description)}</textarea>
            ${imgColHtml}
          </div>
        </td>
        <td class="col-cantidad">
          <input type="text" class="item-qty-input" data-idx="${index}" data-field="qty" value="${escapeHtml(item.qty || '1')}">
        </td>
        <td class="col-precio">
          <input type="text" class="item-price-input" data-idx="${index}" data-field="price" value="${item.price ? formatTwoDecimals(item.price) : ''}" placeholder="0.00">
        </td>
        <td class="col-actions no-print">
          <div class="row-actions-group">
            <button type="button" class="btn-reorder btn-move-up" data-idx="${index}" title="Subir posición" ${isFirst ? 'disabled' : ''}>▲</button>
            <button type="button" class="btn-reorder btn-move-down" data-idx="${index}" title="Bajar posición" ${isLast ? 'disabled' : ''}>▼</button>
            <button type="button" class="btn-mini-del" data-idx="${index}" title="Eliminar este item">&times;</button>
          </div>
        </td>
      `;

      tbodyItems.appendChild(tr);
    });

    // Auto-ajuste de altura de textareas
    tbodyItems.querySelectorAll('.item-desc-textarea').forEach(textarea => {
      autoResizeTextarea(textarea);
      textarea.addEventListener('input', () => autoResizeTextarea(textarea));
    });

    // Numeración de filas especiales finales (Movilidad y No Incluye)
    numMovilidad.textContent = totalItems + 1;
    numNoIncluye.textContent = totalItems + 2;

    attachItemEvents();
  }

  function autoResizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = (el.scrollHeight + 2) + 'px';
  }

  function attachItemEvents() {
    tbodyItems.querySelectorAll('[data-field]').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        const field = e.target.dataset.field;
        if (contractData.items[idx]) {
          contractData.items[idx][field] = e.target.value;
          if (field === 'price' || field === 'qty') {
            recalculateTotals();
          }
          saveContractData();
        }
      });

      if (input.dataset.field === 'price') {
        input.addEventListener('blur', (e) => {
          const idx = parseInt(e.target.dataset.idx, 10);
          if (contractData.items[idx] && e.target.value.trim()) {
            const formatted = formatTwoDecimals(e.target.value);
            e.target.value = formatted;
            contractData.items[idx].price = formatted;
            recalculateTotals();
            saveContractData();
          }
        });
      }
    });

    // Subir imagen
    tbodyItems.querySelectorAll('.file-img-input').forEach(fileInp => {
      fileInp.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        const file = e.target.files[0];
        if (file && contractData.items[idx]) {
          const reader = new FileReader();
          reader.onload = (event) => {
            contractData.items[idx].image = event.target.result;
            renderItemsTable();
            saveContractData();
          };
          reader.readAsDataURL(file);
        }
      });
    });

    // Quitar imagen
    tbodyItems.querySelectorAll('.btn-del-img-badge').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.idx, 10);
        if (contractData.items[idx]) {
          contractData.items[idx].image = null;
          renderItemsTable();
          saveContractData();
        }
      });
    });

    // Botón Subir (▲)
    tbodyItems.querySelectorAll('.btn-move-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.idx, 10);
        if (idx > 0) {
          const temp = contractData.items[idx];
          contractData.items[idx] = contractData.items[idx - 1];
          contractData.items[idx - 1] = temp;
          renderItemsTable();
          recalculateTotals();
          saveContractData();
        }
      });
    });

    // Botón Bajar (▼)
    tbodyItems.querySelectorAll('.btn-move-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.idx, 10);
        if (idx < contractData.items.length - 1) {
          const temp = contractData.items[idx];
          contractData.items[idx] = contractData.items[idx + 1];
          contractData.items[idx + 1] = temp;
          renderItemsTable();
          recalculateTotals();
          saveContractData();
        }
      });
    });

    // Eliminar Item
    tbodyItems.querySelectorAll('.btn-mini-del').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.idx, 10);
        if (contractData.items.length === 1) {
          contractData.items[0] = { title: '', description: '', qty: '1', price: '', image: null };
        } else {
          contractData.items.splice(idx, 1);
        }
        renderItemsTable();
        recalculateTotals();
        saveContractData();
      });
    });
  }

  // Agregar nuevo item
  btnAddItem.addEventListener('click', () => {
    contractData.items.push({
      title: '',
      description: '',
      qty: '1',
      price: '',
      image: null
    });
    renderItemsTable();
    recalculateTotals();
    saveContractData();
  });

  // ==========================================================
  // OPCIONES DE MOVILIDAD
  // ==========================================================
  optMovilidadRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const type = e.target.value;
      contractData.movilidad.type = type;
      updateMovilidadDisplay(type);
      recalculateTotals();
      saveContractData();
    });
  });

  function updateMovilidadDisplay(type) {
    if (type === 'incluye') {
      labelMovilidad.textContent = 'Incluye Movilidad';
      priceMovilidad.value = '0.00';
      priceMovilidad.readOnly = true;
    } else if (type === 'costo') {
      labelMovilidad.textContent = 'Movilidad';
      priceMovilidad.readOnly = false;
      if (priceMovilidad.value === '0.00' || !priceMovilidad.value) {
        priceMovilidad.value = '50.00';
      }
    } else if (type === 'no_incluye') {
      labelMovilidad.textContent = 'No incluye Movilidad';
      priceMovilidad.value = '0.00';
      priceMovilidad.readOnly = true;
    }
  }

  // ==========================================================
  // OPCIONES DE "NO INCLUYE"
  // ==========================================================
  chkNoIncBoxes.forEach(chk => {
    chk.addEventListener('change', updateNoIncluyeText);
  });

  if (inputNoIncluyeExtra) {
    inputNoIncluyeExtra.addEventListener('input', updateNoIncluyeText);
  }

  function updateNoIncluyeText() {
    const selected = [];
    chkNoIncBoxes.forEach(chk => {
      if (chk.checked) selected.push(chk.value);
    });

    const extra = inputNoIncluyeExtra ? inputNoIncluyeExtra.value.trim() : '';
    if (extra) selected.push(extra);

    contractData.noIncluye.items = selected;
    contractData.noIncluye.customText = extra;

    if (selected.length > 0) {
      textNoIncluye.textContent = `No incluye ${selected.join(', ')},`;
    } else {
      textNoIncluye.textContent = 'No incluye accesorios adicionales ni puntos de energía,';
    }

    saveContractData();
  }

  // ==========================================================
  // CÁLCULO DE TOTALES (SIEMPRE 2 DECIMALES)
  // ==========================================================
  function updateDiscountVisibility(enabled) {
    contractData.discountEnabled = enabled;
    if (enabled) {
      rowDescuento.style.display = '';
      rowTotalSinIgv.style.display = '';
      chkEnableDiscount.checked = true;
      chkDescuento.checked = true;
    } else {
      rowDescuento.style.display = 'none';
      rowTotalSinIgv.style.display = 'none';
      chkEnableDiscount.checked = false;
      chkDescuento.checked = false;
    }
    recalculateTotals();
    saveContractData();
  }

  chkEnableDiscount.addEventListener('change', (e) => {
    updateDiscountVisibility(e.target.checked);
  });

  chkDescuento.addEventListener('change', (e) => {
    updateDiscountVisibility(e.target.checked);
  });

  function recalculateTotals() {
    let subtotal = 0;

    contractData.items.forEach(item => {
      const price = parseFloat(item.price);
      if (!isNaN(price)) subtotal += price;
    });

    const movPrice = parseFloat(priceMovilidad.value);
    if (!isNaN(movPrice)) {
      subtotal += movPrice;
    }

    valSubtotal.textContent = formatTwoDecimals(subtotal);

    let total = subtotal;
    if (contractData.discountEnabled) {
      const discount = parseFloat(inputDescuento.value) || 0;
      total = Math.max(0, subtotal - discount);
      valTotalSinIgv.textContent = formatTwoDecimals(total);
    }

    const adelanto = parseFloat(inputAdelanto.value) || 0;
    const saldo = Math.max(0, total - adelanto);
    valSaldo.textContent = formatTwoDecimals(saldo);
  }

  function formatTwoDecimals(val) {
    const num = parseFloat(val);
    if (isNaN(num)) return '0.00';
    return num.toFixed(2);
  }

  // ==========================================================
  // FUNCIONES DE NOMENCLATURA ESTÁNDAR Y CÓDIGO
  // ==========================================================
  function extractCurrentContractCode() {
    const isProforma = (contractData.docType === 'proforma') || contractTitle.value.toUpperCase().includes('PROFORMA');
    if (isProforma) return 'PROFORMA';

    const titleVal = contractTitle.value.trim().toUpperCase();
    const match = titleVal.match(/([LA]\d+[\-_ ]*\d{4}|[LA]\d+|[A-Z]*\d+[\-_ ]*\d{4})/i);
    if (match) {
      let code = match[1].replace(/\s+/g, '').replace(/_/g, '-');
      if (/^[LA]\d{7,}$/.test(code)) {
        code = code.slice(0, 4) + '-' + code.slice(4);
      }
      return code;
    }
    return 'L' + new Date().getFullYear();
  }

  function generateStandardFileName() {
    const isUpdated = chkContractUpdated && chkContractUpdated.checked;
    const isProforma = (contractData.docType === 'proforma') || contractTitle.value.toUpperCase().includes('PROFORMA');

    // 1. Extraer o normalizar código (ej. L126-2026 o A156-2026)
    const code = extractCurrentContractCode();

    // 2. Extraer nombre y apellido del cliente (primeras 2 palabras significativas)
    let rawClient = (clientAttention.value.trim() || clientCompany.value.trim() || greetingName.textContent.trim() || 'CLIENTE');
    // Limpiar títulos de tratamiento
    rawClient = rawClient.replace(/^(Sr\.|Sra\.|Srta\.|Ing\.|Arq\.|Lic\.|Dr\.|Dra\.|Don|Doña)\s+/i, '');
    // Quitar acentos y caracteres especiales
    const cleanClient = rawClient
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .trim();

    const words = cleanClient.split(/\s+/).filter(w => w.length > 0);
    let clientFormatted = 'CLIENTE';
    if (words.length >= 2) {
      clientFormatted = `${words[0].toUpperCase()}_${words[1].toUpperCase()}`;
    } else if (words.length === 1) {
      clientFormatted = words[0].toUpperCase();
    }

    // 3. Estructura exacta requerida:
    // Contrato normal:       CONTRATO_L126-2026_FREDDY_RAMOS.pdf
    // Contrato actualizado:  CONTRATO_ACTUALIZADO_L126-2026_FREDDY_RAMOS.pdf
    // Proforma normal:       PROFORMA_FREDDY_RAMOS.pdf
    // Proforma actualizada:  PROFORMA_ACTUALIZADA_FREDDY_RAMOS.pdf
    if (isProforma) {
      const prefix = isUpdated ? 'PROFORMA_ACTUALIZADA' : 'PROFORMA';
      return `${prefix}_${clientFormatted}.pdf`;
    } else {
      const prefix = isUpdated ? 'CONTRATO_ACTUALIZADO' : 'CONTRATO';
      return `${prefix}_${code}_${clientFormatted}.pdf`;
    }
  }

  // Evento para el interruptor de Contrato Actualizado
  if (chkContractUpdated && lblContractUpdated) {
    chkContractUpdated.addEventListener('change', (e) => {
      if (e.target.checked) {
        lblContractUpdated.classList.add('active');
      } else {
        lblContractUpdated.classList.remove('active');
      }
    });
  }



  // ==========================================================
  // GUARDAR AUTOMÁTICAMENTE EN GOOGLE DRIVE DE LA EMPRESA
  // ==========================================================
  btnSaveDrive.addEventListener('click', async () => {
    const webhookUrl = getDriveWebhookUrl();

    saveContractData();

    const fileName = generateStandardFileName().replace(/\.pdf$/i, '.json');
    const contractCode = extractCurrentContractCode();
    const isUpdated = !!(chkContractUpdated && chkContractUpdated.checked);

    saveIndicator.textContent = '⏳ Guardando información en Google Drive...';
    btnSaveDrive.disabled = true;

    try {
      // Empaquetar exclusivamente la información editable (.json)
      const payload = {
        fileName: fileName,
        contractCode: contractCode,
        contractTitle: contractTitle.value,
        docType: contractData.docType || 'contrato',
        clientName: (clientAttention.value.trim() || clientCompany.value.trim() || 'Cliente'),
        totalAmount: valSaldo.textContent,
        isUpdated: isUpdated,
        contractData: contractData
      };

      // Envío infalible mediante Formulario oculto + Iframe
      const form = document.getElementById('drive_upload_form');
      const inputData = document.getElementById('drive_upload_data');
      const iframe = document.getElementById('drive_upload_iframe');

      if (form && inputData && iframe) {
        inputData.value = JSON.stringify(payload);
        form.action = webhookUrl;

        let completed = false;

        const notifySuccess = (details) => {
          if (completed) return;
          completed = true;
          btnSaveDrive.disabled = false;
          saveIndicator.textContent = `✅ ¡Guardado en Google Drive! (${fileName})`;

          const subfolder = (details && details.subfolder) ? details.subfolder : (contractCode.startsWith('A') ? 'Contratos Arequipa' : (contractCode.startsWith('PROFORMA') ? 'Proformas' : 'Contratos Lima'));
          const fileUrl = (details && details.fileUrl) ? details.fileUrl : null;

          // Guardar en historial local del navegador
          saveToLocalHistory({
            code: contractCode,
            title: contractTitle.value,
            client: (clientAttention.value.trim() || clientCompany.value.trim() || 'Cliente'),
            date: new Date().toLocaleDateString('es-PE') + ' ' + new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
            subfolder: subfolder,
            fileName: fileName,
            fileUrl: fileUrl,
            isUpdated: isUpdated,
            contractData: JSON.parse(JSON.stringify(contractData))
          });

          let msg = `¡La información del contrato "${fileName}" ha sido guardada exitosamente en Google Drive!\n\n📁 Subcarpeta: ${subfolder}\n📚 Quedó registrado en el historial (.json) para que cualquiera del equipo pueda reabrirlo con [📚 Mis Contratos].`;

          if (fileUrl) {
            msg += `\n\n¿Deseas abrir el archivo guardado en Google Drive ahora?`;
            if (confirm(msg)) {
              window.open(fileUrl, '_blank');
            }
          } else {
            alert(msg);
          }

          setTimeout(() => {
            saveIndicator.textContent = '💾 Guardado automático';
          }, 5000);
        };

        // Escuchar postMessage enviado desde Apps Script
        const onMessage = (event) => {
          if (event.data && (event.data.status === 'success' || event.data.fileName)) {
            window.removeEventListener('message', onMessage);
            notifySuccess(event.data);
          }
        };
        window.addEventListener('message', onMessage);

        // Cuando el iframe termina de cargar
        iframe.onload = () => {
          setTimeout(() => {
            if (!completed) {
              notifySuccess(null);
            }
          }, 1000);
        };

        form.submit();

        // Tiempo límite de seguridad (20 seg)
        setTimeout(() => {
          if (!completed) {
            notifySuccess(null);
          }
        }, 20000);

      } else {
        throw new Error('No se encontró el elemento formulario de subida.');
      }

    } catch (err) {
      console.error('Error guardando en Google Drive:', err);
      alert('Ocurrió un error al guardar en Google Drive: ' + err.message);
      saveIndicator.textContent = '❌ Error al subir a Drive';
      btnSaveDrive.disabled = false;
    }
  });

  // Función para archivar en memoria local (para acceso inmediato y modo offline)
  function saveToLocalHistory(entry) {
    try {
      let history = JSON.parse(localStorage.getItem('homeline_local_history') || '[]');
      const idx = history.findIndex(h => h.code === entry.code);
      if (idx >= 0) {
        history[idx] = Object.assign({}, history[idx], entry);
      } else {
        history.unshift(entry);
      }
      if (history.length > 100) history = history.slice(0, 100);
      localStorage.setItem('homeline_local_history', JSON.stringify(history));
    } catch (e) {
      console.warn('Error guardando en historial local:', e);
    }
  }

  // ==========================================================
  // DESCARGA MANUAL EN PDF (IMPRESIÓN LIMPIA CON CONFIGURACIONES COMPLETAS)
  // ==========================================================
  btnPrintPdf.addEventListener('click', () => {
    saveContractData();
    const fileName = generateStandardFileName();
    const contractCode = extractCurrentContractCode();
    const isUpdated = !!(chkContractUpdated && chkContractUpdated.checked);

    // Archivar en historial local al descargar
    saveToLocalHistory({
      code: contractCode,
      title: contractTitle.value,
      client: (clientAttention.value.trim() || clientCompany.value.trim() || 'Cliente'),
      date: new Date().toLocaleDateString('es-PE') + ' ' + new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
      subfolder: (contractCode.startsWith('A') ? 'Contratos Arequipa' : (contractCode.startsWith('PROFORMA') ? 'Proformas' : 'Contratos Lima')),
      fileName: fileName,
      fileUrl: null,
      isUpdated: isUpdated,
      contractData: JSON.parse(JSON.stringify(contractData))
    });

    // Configurar temporalmente el título para que al "Guardar como PDF" el navegador sugiera el nombre de archivo exacto
    const oldTitle = document.title;
    document.title = fileName.replace(/\.pdf$/i, '');

    // Disparar ventana de impresión nativa (estilo Word con marco amarillo de 1cm, sin botones ni opciones ajenas)
    window.print();

    setTimeout(() => {
      document.title = oldTitle;
    }, 2000);
  });

  // ==========================================================
  // HISTORIAL COMPARTIDO EN LA NUBE (GOOGLE DRIVE)
  // ==========================================================
  let cachedContractsList = [];
  let currentHistoryFilter = 'all'; // 'all' | 'lima' | 'arequipa' | 'proforma'
  let isCurrentHistoryLocalOnly = false;

  const btnUseNextLima = document.getElementById('btnUseNextLima');
  const btnUseNextAreq = document.getElementById('btnUseNextAreq');
  const nextLimaCode = document.getElementById('nextLimaCode');
  const nextAreqCode = document.getElementById('nextAreqCode');

  // Calcular y mostrar en pantalla el número más alto de contrato para Lima y Arequipa
  function updateHighestContractStats(contractsList) {
    let maxLima = 0;
    let maxLimaYr = new Date().getFullYear();
    let maxAreq = 0;
    let maxAreqYr = new Date().getFullYear();
    const currentYear = new Date().getFullYear();

    function evaluateText(str) {
      if (!str) return;
      str = String(str).toUpperCase();

      // Lima: Buscar L seguido de números (ej. L263-2026, L132, etc.)
      const matchL = str.match(/(?:^|[^a-zA-Z0-9])L\s*(\d+)(?:[\-_ ]*(\d{4}))?/i);
      if (matchL) {
        const num = parseInt(matchL[1], 10);
        if (num > maxLima) {
          maxLima = num;
          if (matchL[2]) maxLimaYr = matchL[2];
        }
      }

      // Arequipa: Buscar A seguido de números (ej. A156-2026, A132, etc.)
      const matchA = str.match(/(?:^|[^a-zA-Z0-9])A\s*(\d+)(?:[\-_ ]*(\d{4}))?/i);
      if (matchA) {
        const num = parseInt(matchA[1], 10);
        if (num > maxAreq) {
          maxAreq = num;
          if (matchA[2]) maxAreqYr = matchA[2];
        }
      }
    }

    // 1. Evaluar lista de contratos activos
    if (contractsList && Array.isArray(contractsList)) {
      contractsList.forEach(c => {
        evaluateText(c.code);
        evaluateText(c.fileName);
        evaluateText(c.title);
      });
    } else {
      // 2. Si no hay lista de Drive, evaluar historial local como respaldo
      try {
        const local = JSON.parse(localStorage.getItem('homeline_local_history') || '[]');
        local.forEach(c => {
          evaluateText(c.code);
          evaluateText(c.fileName);
          evaluateText(c.title);
        });
      } catch (e) {}
    }

    const elHighestLima = document.getElementById('highestLimaCode');
    const elNextLima = document.getElementById('nextLimaCode');
    const elHighestAreq = document.getElementById('highestAreqCode');
    const elNextAreq = document.getElementById('nextAreqCode');

    const highestLimaStr = maxLima > 0 ? `L${maxLima}-${maxLimaYr}` : 'Sin registros';
    const nextLimaStr = `L${maxLima > 0 ? (maxLima + 1) : 1}-${currentYear}`;

    const highestAreqStr = maxAreq > 0 ? `A${maxAreq}-${maxAreqYr}` : 'Sin registros';
    const nextAreqStr = `A${maxAreq > 0 ? (maxAreq + 1) : 1}-${currentYear}`;

    if (elHighestLima) elHighestLima.textContent = highestLimaStr;
    if (elNextLima) elNextLima.textContent = nextLimaStr;
    if (elHighestAreq) elHighestAreq.textContent = highestAreqStr;
    if (elNextAreq) elNextAreq.textContent = nextAreqStr;
  }

  // Botón para asignar directamente el siguiente número de Lima
  if (btnUseNextLima) {
    btnUseNextLima.addEventListener('click', () => {
      const code = (nextLimaCode ? nextLimaCode.textContent : '').trim();
      if (!code || code.includes('...')) return;
      setDocType('contrato');
      const match = code.match(/^([LA]\d+)\-(\d{4})$/i);
      contractTitle.value = match ? `CONTRATO ${match[1]} - ${match[2]}` : `CONTRATO ${code}`;
      closeHistoryModal();
      saveContractData();
      saveIndicator.textContent = `✅ Número asignado: ${contractTitle.value}`;
      setTimeout(() => { saveIndicator.textContent = '💾 Guardado automático'; }, 4000);
    });
  }

  // Botón para asignar directamente el siguiente número de Arequipa
  if (btnUseNextAreq) {
    btnUseNextAreq.addEventListener('click', () => {
      const code = (nextAreqCode ? nextAreqCode.textContent : '').trim();
      if (!code || code.includes('...')) return;
      setDocType('contrato');
      const match = code.match(/^([LA]\d+)\-(\d{4})$/i);
      contractTitle.value = match ? `CONTRATO ${match[1]} - ${match[2]}` : `CONTRATO ${code}`;
      closeHistoryModal();
      saveContractData();
      saveIndicator.textContent = `✅ Número asignado: ${contractTitle.value}`;
      setTimeout(() => { saveIndicator.textContent = '💾 Guardado automático'; }, 4000);
    });
  }

  function openHistoryModal() {
    if (historyModal) {
      historyModal.style.display = 'flex';
      updateHighestContractStats(cachedContractsList);
      loadSharedContractsHistory();
    }
  }

  function closeHistoryModal() {
    if (historyModal) {
      historyModal.style.display = 'none';
    }
  }

  if (btnHistoryContracts) btnHistoryContracts.addEventListener('click', openHistoryModal);
  if (btnCloseHistoryModal) btnCloseHistoryModal.addEventListener('click', closeHistoryModal);
  if (btnCloseHistoryModalBtn) btnCloseHistoryModalBtn.addEventListener('click', closeHistoryModal);
  if (inputSearchHistory) inputSearchHistory.addEventListener('input', () => filterAndRenderHistory());

  // Eventos para botones de filtro (Todos, Lima, Arequipa, Proformas)
  document.querySelectorAll('.history-filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const filter = e.currentTarget.dataset.filter || 'all';
      setHistoryCategoryFilter(filter);
    });
  });

  const btnClearHistoryData = document.getElementById('btnClearHistoryData');
  if (btnClearHistoryData) {
    btnClearHistoryData.addEventListener('click', async () => {
      const confirmClear = confirm(
        '⚠️ ¿Estás seguro de vaciar el historial de contratos?\n\n' +
        '• Se eliminarán los registros de la lista de Google Drive y de este navegador.\n' +
        '• Esto reiniciará el historial a 0 contratos para comenzar desde limpio.'
      );

      if (!confirmClear) return;

      saveIndicator.textContent = '⏳ Vaciando historial...';
      const webhookUrl = getDriveWebhookUrl();

      // Limpiar memoria local inmediatamente
      cachedContractsList = [];
      localStorage.setItem('homeline_local_history', '[]');
      renderHistoryList([], false);

      // Notificar a Google Apps Script para vaciar el índice en la nube
      try {
        const clearUrl = `${webhookUrl.trim()}${webhookUrl.includes('?') ? '&' : '?'}action=clear`;
        await fetch(clearUrl, { method: 'GET', mode: 'no-cors' });
      } catch (err) {
        const probe = new Image();
        probe.src = `${webhookUrl.trim()}${webhookUrl.includes('?') ? '&' : '?'}action=clear&t=` + Date.now();
      }

      saveIndicator.textContent = '🗑️ Historial de contratos vaciado con éxito';
      historyCounterText.textContent = '0 contratos encontrados';
      setTimeout(() => { saveIndicator.textContent = '💾 Guardado automático'; }, 3000);
    });
  }

  // Consultar historial en la nube (soporta Fetch directo con fallback a JSONP y copia local)
  async function loadSharedContractsHistory() {
    const webhookUrl = getDriveWebhookUrl();
    historyListContainer.innerHTML = '<div class="history-empty-msg">⏳ Conectando con Google Drive y cargando contratos del equipo...</div>';
    historyCounterText.textContent = 'Cargando...';

    const localHistory = JSON.parse(localStorage.getItem('homeline_local_history') || '[]');

    // 1. Intentar primero con fetch() directo
    try {
      const fetchUrl = `${webhookUrl.trim()}${webhookUrl.includes('?') ? '&' : '?'}action=list`;
      const response = await fetch(fetchUrl, { method: 'GET', redirect: 'follow' });
      const text = await response.text();

      try {
        const resp = JSON.parse(text);
        if (resp && resp.status === 'success') {
          cachedContractsList = resp.contracts || [];
          // Sincronizar memoria local estrictamente con lo que existe en Drive
          localStorage.setItem('homeline_local_history', JSON.stringify(cachedContractsList));
          renderHistoryList(cachedContractsList, false);
          return;
        }
      } catch (jsonErr) {
        // Si el script devolvió texto plano de versión vieja
        if (text.includes("Servicio de Google Drive") || text.includes("Home Line")) {
          showScriptOutdatedNotice(localHistory);
          return;
        }
      }
    } catch (fetchErr) {
      console.warn('Fetch GET falló, intentando con JSONP...', fetchErr);
    }

    // 2. Fallback: JSONP
    const callbackName = 'onDriveHistory_' + Date.now();
    const script = document.createElement('script');

    let finished = false;
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      cleanup();
      handleHistoryError(localHistory);
    }, 10000);

    function cleanup() {
      clearTimeout(timer);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = function(resp) {
      if (finished) return;
      finished = true;
      cleanup();

      if (resp && resp.status === 'success') {
        const driveContracts = resp.contracts || [];
        const existingLocal = JSON.parse(localStorage.getItem('homeline_local_history') || '[]');

        // Conservar contractData local si ya lo tenemos guardado
        cachedContractsList = driveContracts.map(dc => {
          const localMatch = existingLocal.find(el => el.code === dc.code && el.contractData);
          if (localMatch) {
            return Object.assign({}, dc, { contractData: localMatch.contractData });
          }
          return dc;
        });

        localStorage.setItem('homeline_local_history', JSON.stringify(cachedContractsList));
        renderHistoryList(cachedContractsList, false);
      } else {
        handleHistoryError(localHistory, resp ? resp.message : null);
      }
    };

    script.src = `${webhookUrl.trim()}${webhookUrl.includes('?') ? '&' : '?'}action=list&callback=${callbackName}`;
    script.onerror = function() {
      if (finished) return;
      finished = true;
      cleanup();
      handleHistoryError(localHistory);
    };

    document.body.appendChild(script);
  }

  function handleHistoryError(localHistory) {
    if (localHistory && localHistory.length > 0) {
      cachedContractsList = localHistory;
      historyListContainer.innerHTML = `
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 8px 12px; margin: 8px; font-size: 11px; color: #92400e;">
          ℹ️ Mostrando historial guardado en esta computadora. Para sincronizar los contratos de todo el equipo en la nube, asegúrate de haber implementado la última versión de <code>google_apps_script.js</code> en Google Apps Script.
        </div>
      `;
      renderHistoryItems(localHistory, true);
      historyCounterText.textContent = `${localHistory.length} contrato(s) locales`;
      return;
    }

    showScriptOutdatedNotice(localHistory);
  }

  function showScriptOutdatedNotice(localHistory) {
    let noticeHtml = `
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px 16px; margin: 10px; font-size: 11.5px; color: #92400e; line-height: 1.6;">
        <div style="font-weight: bold; font-size: 12.5px; margin-bottom: 6px; color: #b45309;">
          ⚠️ Tu Google Apps Script necesita actualizarse a la nueva versión
        </div>
        <div>Para que el historial compartido en la nube funcione para todo el equipo, publica los últimos cambios en Google:</div>
        <ol style="padding-left: 18px; margin: 6px 0;">
          <li>Abre tu proyecto en <a href="https://script.google.com" target="_blank" style="color: #1a73e8; font-weight: bold; text-decoration: underline;">script.google.com</a>.</li>
          <li>Reemplaza el código por el contenido actualizado de <code>google_apps_script.js</code> y guarda (Ctrl+S).</li>
          <li>Haz clic en el botón azul superior: <strong>Implementar > Administrar implementaciones</strong>.</li>
          <li>Haz clic en el <strong>icono del lápiz ✏️ (Editar)</strong> a la derecha.</li>
          <li>En <em>Versión</em> selecciona <strong>Nueva versión</strong> y haz clic en <strong>Implementar</strong>.</li>
        </ol>
      </div>
    `;

    if (localHistory && localHistory.length > 0) {
      cachedContractsList = localHistory;
      historyListContainer.innerHTML = noticeHtml + '<div style="font-weight:bold; font-size:11px; padding: 6px 12px; color:#475569;">Contratos guardados en esta computadora:</div>';
      renderHistoryItems(localHistory, true);
      historyCounterText.textContent = `${localHistory.length} contrato(s) locales`;
    } else {
      historyListContainer.innerHTML = noticeHtml;
      historyCounterText.textContent = 'Actualización requerida en Apps Script';
    }
  }

  // Extraer información numérica y de tipo para ordenar de mayor a menor
  function parseContractSortKey(item) {
    const code = String(item.code || item.fileName || item.title || '').trim().toUpperCase();
    const sub = String(item.subfolder || '').toUpperCase();

    // 1. Detectar Lima (L seguido de números)
    const matchL = code.match(/(?:^|[^a-zA-Z0-9])L\s*(\d+)(?:[\-_ ]*(\d{4}))?/i);
    if (matchL) {
      const num = parseInt(matchL[1], 10);
      const yr = matchL[2] ? parseInt(matchL[2], 10) : 2026;
      return { type: 'lima', num: num, year: yr, raw: code, date: item.date || '' };
    }

    // 2. Detectar Arequipa (A seguido de números)
    const matchA = code.match(/(?:^|[^a-zA-Z0-9])A\s*(\d+)(?:[\-_ ]*(\d{4}))?/i);
    if (matchA) {
      const num = parseInt(matchA[1], 10);
      const yr = matchA[2] ? parseInt(matchA[2], 10) : 2026;
      return { type: 'arequipa', num: num, year: yr, raw: code, date: item.date || '' };
    }

    // 3. Proformas o sin número
    const isProf = code.includes('PROFORMA') || sub.includes('PROFORMA');
    return { type: isProf ? 'proforma' : 'other', num: 0, year: 0, raw: code, date: item.date || '' };
  }

  // Ordenar lista de mayor a menor
  function sortContractsDescending(list) {
    return [...list].sort((a, b) => {
      const keyA = parseContractSortKey(a);
      const keyB = parseContractSortKey(b);

      // Si ambos tienen número de contrato (ej. L263 vs L132, o A157 vs A50)
      if (keyA.num > 0 && keyB.num > 0) {
        if (keyA.year !== keyB.year) {
          return keyB.year - keyA.year; // Año más reciente primero
        }
        return keyB.num - keyA.num; // Número más alto primero (de mayor a menor)
      }

      // Los que tienen número van antes que los que no tienen
      if (keyA.num > 0 && keyB.num === 0) return -1;
      if (keyA.num === 0 && keyB.num > 0) return 1;

      // Si ninguno tiene número (ej. Proformas), ordenar por fecha más reciente
      if (keyA.date && keyB.date) {
        const cmp = keyB.date.localeCompare(keyA.date);
        if (cmp !== 0) return cmp;
      }

      return keyB.raw.localeCompare(keyA.raw);
    });
  }

  // Determinar categoría para filtros
  function getItemCategory(item) {
    const code = String(item.code || item.fileName || item.title || '').trim().toUpperCase();
    const sub = String(item.subfolder || '').toUpperCase();

    if (sub.includes('AREQUIPA') || /(?:^|[^a-zA-Z0-9])A\s*\d+/i.test(code) || code.startsWith('A')) {
      return 'arequipa';
    }
    if (sub.includes('LIMA') || /(?:^|[^a-zA-Z0-9])L\s*\d+/i.test(code) || code.startsWith('L')) {
      return 'lima';
    }
    if (sub.includes('PROFORMA') || code.includes('PROFORMA')) {
      return 'proforma';
    }
    return 'other';
  }

  // Actualizar conteos de los botones de filtro
  function updateFilterCounts(list) {
    if (!list) list = [];
    let countLima = 0, countAreq = 0, countProf = 0;

    list.forEach(item => {
      const cat = getItemCategory(item);
      if (cat === 'lima') countLima++;
      else if (cat === 'arequipa') countAreq++;
      else if (cat === 'proforma') countProf++;
    });

    const elAll = document.getElementById('countFilterAll');
    const elLima = document.getElementById('countFilterLima');
    const elAreq = document.getElementById('countFilterAreq');
    const elProf = document.getElementById('countFilterProf');

    if (elAll) elAll.textContent = list.length > 0 ? `(${list.length})` : '';
    if (elLima) elLima.textContent = countLima > 0 ? `(${countLima})` : '';
    if (elAreq) elAreq.textContent = countAreq > 0 ? `(${countAreq})` : '';
    if (elProf) elProf.textContent = countProf > 0 ? `(${countProf})` : '';
  }

  // Cambiar categoría activa de filtro
  function setHistoryCategoryFilter(category) {
    currentHistoryFilter = category;
    document.querySelectorAll('.history-filter-btn').forEach(btn => {
      if (btn.dataset.filter === category) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    filterAndRenderHistory();
  }

  function renderHistoryList(list, isLocalOnly) {
    cachedContractsList = list || [];
    isCurrentHistoryLocalOnly = !!isLocalOnly;
    updateHighestContractStats(cachedContractsList);
    updateFilterCounts(cachedContractsList);
    filterAndRenderHistory();
  }

  function filterAndRenderHistory() {
    const query = (inputSearchHistory ? inputSearchHistory.value : '').trim().toLowerCase();

    // 1. Filtrar por categoría seleccionada (Todos, Lima, Arequipa, Proforma)
    let filtered = cachedContractsList.filter(item => {
      if (currentHistoryFilter === 'all') return true;
      const cat = getItemCategory(item);
      return cat === currentHistoryFilter;
    });

    // 2. Filtrar por texto de búsqueda
    if (query) {
      filtered = filtered.filter(item => {
        const code = (item.code || '').toLowerCase();
        const client = (item.client || '').toLowerCase();
        const date = (item.date || '').toLowerCase();
        const sub = (item.subfolder || '').toLowerCase();
        return code.includes(query) || client.includes(query) || date.includes(query) || sub.includes(query);
      });
    }

    // 3. Ordenar siempre de mayor a menor
    filtered = sortContractsDescending(filtered);

    // 4. Renderizar contenido
    if (filtered.length === 0) {
      let emptyMsg = '📭 No se encontraron documentos con los filtros aplicados.';
      if (cachedContractsList.length === 0) {
        emptyMsg = '📭 Aún no hay contratos guardados.<br>Cuando guardes tu primer contrato aparecerá aquí automáticamente.';
      } else if (currentHistoryFilter === 'lima') {
        emptyMsg = '📭 No hay contratos registrados para Lima aún.';
      } else if (currentHistoryFilter === 'arequipa') {
        emptyMsg = '📭 No hay contratos registrados para Arequipa aún.';
      } else if (currentHistoryFilter === 'proforma') {
        emptyMsg = '📭 No hay proformas registradas aún.';
      }
      historyListContainer.innerHTML = `<div class="history-empty-msg">${emptyMsg}</div>`;
      historyCounterText.textContent = '0 contratos encontrados';
      return;
    }

    const originText = isCurrentHistoryLocalOnly ? '(Guardados localmente)' : 'en Google Drive';
    let filterLabel = '';
    if (currentHistoryFilter === 'lima') filterLabel = ' • Lima (L)';
    else if (currentHistoryFilter === 'arequipa') filterLabel = ' • Arequipa (A)';
    else if (currentHistoryFilter === 'proforma') filterLabel = ' • Proformas';

    historyCounterText.textContent = `${filtered.length} de ${cachedContractsList.length} documento(s)${filterLabel} ${originText} (Mayor a menor)`;
    historyListContainer.innerHTML = '';
    renderHistoryItems(filtered, isCurrentHistoryLocalOnly);
  }

  function renderHistoryItems(list, isLocalOnly) {
    let itemsHtml = '';

    list.forEach((item, index) => {
      const code = item.code || 'DOC';
      let badgeClass = 'badge-lima';
      let cityLabel = 'LIMA';

      if (code.startsWith('A') || (item.subfolder && item.subfolder.includes('Arequipa'))) {
        badgeClass = 'badge-arequipa';
        cityLabel = 'AREQUIPA';
      } else if (code.startsWith('PROFORMA') || (item.subfolder && item.subfolder.includes('Proformas'))) {
        badgeClass = 'badge-proforma';
        cityLabel = 'PROFORMA';
      }

      const isUpdatedBadge = item.isUpdated ? '<span class="badge-updated">Actualizado</span>' : '';

      itemsHtml += `
        <div class="history-item-row" data-index="${index}">
          <div class="history-item-info">
            <div class="history-item-header">
              <span class="history-code-badge ${badgeClass}">${escapeHtml(code)}</span>
              <span class="history-client-name">${escapeHtml(item.client || 'Cliente')}</span>
              ${isUpdatedBadge}
            </div>
            <div class="history-meta-sub">
              <span>📅 ${escapeHtml(item.date || 'Sin fecha')}</span>
              <span>📁 ${escapeHtml(item.subfolder || cityLabel)}</span>
            </div>
          </div>
          <div class="history-actions">
            <button type="button" class="btn-load-contract" data-code="${escapeHtml(code)}" title="Rellenar el formulario con todos los datos de este contrato">
              📥 Cargar
            </button>
          </div>
        </div>
      `;
    });

    historyListContainer.innerHTML = itemsHtml;

    // Asignar eventos de clic a los botones de Cargar
    historyListContainer.querySelectorAll('.btn-load-contract').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const code = e.currentTarget.dataset.code;
        loadContractByCode(code);
      });
    });
  }

  // Cargar contrato específico (busca en Google Drive primero como fuente oficial, con fallback a memoria local)
  async function loadContractByCode(code) {
    saveIndicator.textContent = `⏳ Descargando contrato ${code} desde Google Drive...`;

    const webhookUrl = getDriveWebhookUrl();

    // 1. Consultar PRIMERO en Google Drive (fuente de verdad oficial y actualizada)
    if (webhookUrl) {
      try {
        const getUrl = `${webhookUrl.trim()}${webhookUrl.includes('?') ? '&' : '?'}action=get&code=${encodeURIComponent(code)}&_t=${Date.now()}`;
        const response = await fetch(getUrl, { method: 'GET', redirect: 'follow' });
        const resp = await response.json();
        if (resp && resp.status === 'success' && resp.contractData) {
          applyLoadedContractData(resp.contractData, code);
          return;
        }
      } catch (fetchErr) {
        console.warn('Fetch GET contrato falló, probando con JSONP...', fetchErr);
      }

      // Fallback con JSONP anti-caché
      const callbackName = 'onContractGet_' + Date.now();
      const script = document.createElement('script');

      let finished = false;
      const timer = setTimeout(() => {
        if (finished) return;
        finished = true;
        cleanup();
        fallbackToLocal(code);
      }, 10000);

      function cleanup() {
        clearTimeout(timer);
        delete window[callbackName];
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[callbackName] = function(resp) {
        if (finished) return;
        finished = true;
        cleanup();

        if (resp && resp.status === 'success' && resp.contractData) {
          applyLoadedContractData(resp.contractData, code);
        } else {
          fallbackToLocal(code);
        }
      };

      script.src = `${webhookUrl.trim()}${webhookUrl.includes('?') ? '&' : '?'}action=get&code=${encodeURIComponent(code)}&callback=${callbackName}&_t=${Date.now()}`;
      document.body.appendChild(script);
      return;
    }

    // 2. Si no hay webhook configurado, recurrir a historial local
    fallbackToLocal(code);
  }

  function fallbackToLocal(code) {
    const localHistory = JSON.parse(localStorage.getItem('homeline_local_history') || '[]');
    const localMatch = localHistory.find(h => h.code === code && h.contractData);
    if (localMatch && localMatch.contractData) {
      applyLoadedContractData(localMatch.contractData, code);
      return;
    }
    alert(`No se pudo descargar la información editable del contrato ${code} desde Google Drive.`);
  }

  // Aplicar datos cargados al formulario y activar modo Actualizado
  function applyLoadedContractData(loadedData, codeIdentifier) {
    try {
      let realData = loadedData;
      if (loadedData && loadedData.contractData && typeof loadedData.contractData === 'object') {
        realData = Object.assign({}, loadedData, loadedData.contractData);
      }

      // Normalizar adelantoAmount desde cualquier propiedad previa
      let rawAdelanto = '0.00';
      if (realData.adelantoAmount !== undefined && realData.adelantoAmount !== null && realData.adelantoAmount !== '') {
        rawAdelanto = realData.adelantoAmount;
      } else if (realData.adelanto !== undefined && realData.adelanto !== null && realData.adelanto !== '') {
        rawAdelanto = realData.adelanto;
      } else if (realData.inputAdelanto !== undefined && realData.inputAdelanto !== null && realData.inputAdelanto !== '') {
        rawAdelanto = realData.inputAdelanto;
      } else if (realData.montoAdelanto !== undefined && realData.montoAdelanto !== null && realData.montoAdelanto !== '') {
        rawAdelanto = realData.montoAdelanto;
      } else if (realData.valAdelanto !== undefined && realData.valAdelanto !== null && realData.valAdelanto !== '') {
        rawAdelanto = realData.valAdelanto;
      }
      realData.adelantoAmount = formatTwoDecimals(rawAdelanto);

      // Preservar nota técnica
      realData.notaTecnica = realData.notaTecnica || '';

      // Preservar porcentaje de adelanto
      realData.condAdelantoPct = realData.condAdelantoPct || '20%';

      contractData = Object.assign({}, BLANK_TEMPLATE, realData);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(contractData));

      // Cachear en el historial local para futuras aperturas
      const localHistory = JSON.parse(localStorage.getItem('homeline_local_history') || '[]');
      const hIdx = localHistory.findIndex(h => h.code === codeIdentifier);
      if (hIdx >= 0) {
        localHistory[hIdx].contractData = JSON.parse(JSON.stringify(contractData));
        localStorage.setItem('homeline_local_history', JSON.stringify(localHistory));
      }

      // Activar automáticamente el modo "Contrato Actualizado"
      if (chkContractUpdated) {
        chkContractUpdated.checked = true;
      }
      if (lblContractUpdated) {
        lblContractUpdated.classList.add('active');
      }

      initForm();
      closeHistoryModal();

      // Forzar explícitamente el valor en el input y recalcular totales en el DOM
      if (inputAdelanto) {
        inputAdelanto.value = contractData.adelantoAmount;
      }
      recalculateTotals();

      saveIndicator.textContent = `🔄 Contrato ${codeIdentifier || ''} cargado (Modo Actualizado)`;

      const clientNameDisp = contractData.clientAttention || contractData.clientCompany || 'Cliente';
      const adelantoDisp = contractData.adelantoAmount;
      const saldoDisp = valSaldo ? valSaldo.textContent : '0.00';

      alert(`¡Contrato "${codeIdentifier || ''}" cargado con éxito!\n\n• Cliente: ${clientNameDisp}\n• Adelanto registrado: S/ ${adelantoDisp}\n• Saldo pendiente: S/ ${saldoDisp}\n• Se activó el modo "🔄 Contrato Actualizado".`);

      setTimeout(() => {
        saveIndicator.textContent = '💾 Guardado automático';
      }, 5000);

    } catch (e) {
      console.error('Error aplicando datos de contrato:', e);
      alert('Ocurrió un error al aplicar los datos del contrato al formulario.');
    }
  }

  // Subir contrato desde archivo local (.json)
  if (btnUploadContract && inputUploadContract) {
    btnUploadContract.addEventListener('click', () => {
      inputUploadContract.click();
    });

    inputUploadContract.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (parsed && (parsed.items || parsed.contractTitle || parsed.clientCompany)) {
            applyLoadedContractData(parsed, file.name.replace(/\.json$/i, ''));
          } else {
            alert('El archivo seleccionado no tiene el formato válido de un contrato Home Line.');
          }
        } catch (err) {
          alert('Error al leer el archivo JSON: ' + err.message);
        }
      };
      reader.readAsText(file);
      inputUploadContract.value = '';
    });
  }

  // ==========================================================
  // MODAL DE CONFIGURACIÓN DE DRIVE
  // ==========================================================
  function openDriveModal() {
    inputDriveWebhookUrl.value = getDriveWebhookUrl();
    testConnectionStatus.textContent = '';
    driveModal.style.display = 'flex';
  }

  function closeDriveModal() {
    driveModal.style.display = 'none';
  }

  btnConfigDrive.addEventListener('click', openDriveModal);
  btnCloseDriveModal.addEventListener('click', closeDriveModal);
  btnCancelDriveModal.addEventListener('click', closeDriveModal);

  // Cargar preferencia de descarga simultánea
  if (chkSimultaneousDownload) {
    const pref = localStorage.getItem('homeline_simultaneous_download');
    if (pref !== null) {
      chkSimultaneousDownload.checked = (pref === 'true');
    }
    chkSimultaneousDownload.addEventListener('change', (e) => {
      localStorage.setItem('homeline_simultaneous_download', e.target.checked);
    });
  }

  // Botón Probar Conexión
  if (btnTestDriveConnection) {
    btnTestDriveConnection.addEventListener('click', () => {
      const url = inputDriveWebhookUrl.value.trim();
      testConnectionStatus.textContent = '';

      if (!url) {
        testConnectionStatus.style.color = '#ef4444';
        testConnectionStatus.textContent = '❌ Ingresa una URL primero';
        return;
      }

      if (url.includes('/edit') || url.includes('/projects/')) {
        testConnectionStatus.style.color = '#ef4444';
        testConnectionStatus.textContent = '❌ Error: URL de editor (/edit). Debe terminar en /exec';
        alert('⚠️ Estás pegando la URL de edición del código.\n\nPara obtener la URL correcta:\n1. En Google Apps Script haz clic en el botón azul "Implementar" > "Nueva implementación".\n2. Tipo: "Aplicación web".\n3. Quién tiene acceso: "Cualquiera".\n4. Copia la URL que termina en /exec.');
        return;
      }

      if (!url.startsWith('https://script.google.com/macros/s/') || !url.includes('/exec')) {
        testConnectionStatus.style.color = '#f59e0b';
        testConnectionStatus.textContent = '⚠️ Debe comenzar con https://script.google.com/macros/s/... y terminar en /exec';
        return;
      }

      testConnectionStatus.style.color = '#0d9488';
      testConnectionStatus.textContent = '⏳ Comprobando enlace...';

      const probe = new Image();
      probe.src = url + (url.includes('?') ? '&' : '?') + 'ping=' + Date.now();
      probe.onload = probe.onerror = () => {
        testConnectionStatus.style.color = '#10b981';
        testConnectionStatus.textContent = '✅ URL válida de Aplicación Web';
      };
    });
  }

  btnSaveDriveConfig.addEventListener('click', () => {
    const url = inputDriveWebhookUrl.value.trim();
    if (!url) {
      alert('Por favor ingresa la URL de la aplicación web de Google Apps Script.');
      return;
    }

    if (url.includes('/edit') || url.includes('/projects/')) {
      alert('⚠️ La URL ingresada es del editor de código (termina en /edit).\n\nDebes hacer clic en "Implementar" > "Nueva implementación" > Seleccionar "Aplicación web" > Quién tiene acceso: "Cualquiera", y copiar la URL que termina en /exec.');
      return;
    }

    if (!url.startsWith('https://script.google.com/macros/s/')) {
      const confirmAnyway = confirm('La URL no tiene el formato estándar de una Aplicación Web publicada de Google Apps Script ("https://script.google.com/macros/s/.../exec").\n\n¿Deseas guardarla de todas formas?');
      if (!confirmAnyway) return;
    }

    localStorage.setItem(DRIVE_KEY, url);
    closeDriveModal();
    saveIndicator.textContent = '✅ Conexión con Google Drive configurada';
    alert('¡Conexión configurada con éxito!\n\nAhora cualquier colaborador puede presionar [☁️ Guardar en Drive] para guardar automáticamente el contrato en el Google Drive de la empresa.');
    setTimeout(() => {
      saveIndicator.textContent = '💾 Guardado automático';
    }, 4000);
  });

  // ==========================================================
  // LIMPIAR FORMULARIO
  // ==========================================================
  btnClearContract.addEventListener('click', () => {
    const confirmClear = confirm(
      '¿Estás seguro de limpiar todo el formulario?\n\n' +
      '• Se reiniciarán todos los campos a una plantilla limpia para un nuevo documento.'
    );

    if (confirmClear) {
      // 1. Limpiar manualmente todos los campos del cliente en pantalla
      clientCompany.value = '';
      clientDoc.value = '';
      clientAttention.value = '';
      clientAddress.value = '';
      clientService.value = '';
      clientIssueDate.value = new Date().toISOString().split('T')[0];
      clientContact.value = '';
      clientDeliveryDate.value = '';
      greetingTitle.value = 'Sr.';
      greetingName.textContent = '';

      // Resetear tipo de documento y título
      setDocType('contrato');
      contractTitle.value = 'CONTRATO A132 - 2026';

      // Resetear estructura de datos en memoria
      contractData = JSON.parse(JSON.stringify(BLANK_TEMPLATE));
      contractData.clientIssueDate = clientIssueDate.value;
      contractData.greetingName = '';

      // Resetear items a 1 fila vacía
      renderItemsTable();

      // Resetear movilidad
      qtyMovilidad.value = '1';
      priceMovilidad.value = '0.00';
      optMovilidadRadios.forEach(r => { r.checked = (r.value === 'incluye'); });
      updateMovilidadDisplay('incluye');

      // Resetear no incluye
      chkNoIncBoxes.forEach(chk => {
        chk.checked = ['Cables', 'Tomacorrientes', 'Canaleta para punto de energía'].includes(chk.value);
      });
      if (inputNoIncluyeExtra) inputNoIncluyeExtra.value = '';
      updateNoIncluyeText();

      // Resetear descuentos y saldos
      chkEnableDiscount.checked = false;
      chkDescuento.checked = false;
      inputDescuento.value = '0.00';
      inputAdelanto.value = '0.00';
      updateDiscountVisibility(false);
      condAdelantoPct.textContent = '20%';

      // Resetear nota técnica
      if (textNotaTecnica) {
        textNotaTecnica.value = '';
        autoResizeTextarea(textNotaTecnica);
        updateNotaTecnicaState();
      }

      // Resetear modo actualizado
      if (chkContractUpdated) chkContractUpdated.checked = false;
      if (lblContractUpdated) lblContractUpdated.classList.remove('active');

      recalculateTotals();

      // Persistir el estado completamente limpio en localStorage
      saveContractData();

      saveIndicator.textContent = '🧹 Formulario limpio para nuevo documento';
      setTimeout(() => {
        saveIndicator.textContent = '💾 Guardado automático';
      }, 3000);
    }
  });

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Inicializar formulario al cargar
  initForm();

})();
