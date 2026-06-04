const TABLES = {
  operators: "operators",
  measurements: "measurements"
};

const DEFAULT_ADMIN = {
  id: crypto.randomUUID(),
  full_name: "Administrador",
  employee_number: "admin",
  username: "admin",
  password: "admin",
  role: "administrador",
  created_at: new Date().toISOString()
};

const COMPONENTS = [
  "Motor aspiracion principal (M2) 60KW/110AMP",
  "Auxiliar de aspiracion ( M1) 4KW/7.6AMPS",
  "Motor de rotores derecho (M3) 55KW/108AMPS",
  "Motor de cardinas derecho (M6) 18.4KW/35AMPS",
  "Motor de rotores izquierdo (M4) 55KW/108AMPS",
  "Motor de cardinas izquierdo (M5) 18.4KW/35AMPS",
  "Motor de arrastre derecho (M60)",
  "Motor de arrastre izquierdo (M66)",
  "Motor generador",
  "Generador",
  "Alzada derecho (cabezal)",
  "Alzada izquierdo (cabezal)",
  "Alzada derecho (mandril)",
  "Alzada izquierdo (mandril)"
];

const state = {
  supabase: null,
  currentUser: null,
  operators: [],
  measurements: [],
  activeView: "home",
  pages: { home: 1, consult: 1 },
  filters: {
    home: { search: "", line: "", component: "", week: "", operator: "" },
    consult: { search: "", line: "", component: "", week: "", operator: "" },
    stats: { line: "", component: "", week: "", year: "", operator: "" }
  },
  editingOperatorId: null,
  editingMeasurementId: null,
  charts: {}
};

const navItems = [
  { id: "home", label: "Inicio", subtitle: "Registros del día y concentrado operativo", roles: ["administrador", "operador"] },
  { id: "operator", label: "Agregar operador", subtitle: "Alta y administración de usuarios", roles: ["administrador"] },
  { id: "measurement", label: "Nueva medición", subtitle: "Captura de registros de máquinas", roles: ["administrador", "operador"] },
  { id: "consult", label: "Consultar mediciones", subtitle: "Histórico completo de mediciones", roles: ["administrador", "operador"] },
  { id: "stats", label: "Estadísticas", subtitle: "Gráficas por línea, componente y semana", roles: ["administrador"] }
];

const dom = {};

document.addEventListener("DOMContentLoaded", async () => {
  cacheDom();
  initSupabase();
  bindGlobalEvents();
  await loadData();
  hydrateSession();
});

function cacheDom() {
  dom.loginScreen = document.getElementById("loginScreen");
  dom.appShell = document.getElementById("appShell");
  dom.loginForm = document.getElementById("loginForm");
  dom.navMenu = document.getElementById("navMenu");
  dom.logoutBtn = document.getElementById("logoutBtn");
  dom.mobileMenuBtn = document.getElementById("mobileMenuBtn");
  dom.sidebar = document.querySelector(".sidebar");
  dom.viewTitle = document.getElementById("viewTitle");
  dom.viewSubtitle = document.getElementById("viewSubtitle");
  dom.currentUserName = document.getElementById("currentUserName");
  dom.currentUserRole = document.getElementById("currentUserRole");
  dom.toast = document.getElementById("toast");
  dom.detailModal = document.getElementById("detailModal");
  dom.modalContent = document.getElementById("modalContent");
}

function initSupabase() {
  const config = window.APP_CONFIG || {};
  if (config.supabaseUrl && config.supabaseAnonKey && window.supabase) {
    state.supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  }
}

async function loadData() {
  if (state.supabase) {
    const [operatorsResult, measurementsResult] = await Promise.all([
      state.supabase.from(TABLES.operators).select("*").order("created_at", { ascending: true }),
      state.supabase.from(TABLES.measurements).select("*").order("created_at", { ascending: false })
    ]);

    if (!operatorsResult.error && Array.isArray(operatorsResult.data)) {
      state.operators = operatorsResult.data;
    }
    if (!measurementsResult.error && Array.isArray(measurementsResult.data)) {
      state.measurements = measurementsResult.data;
    }
    if (operatorsResult.error || measurementsResult.error) {
      showToast("No se pudo leer Supabase. Se usará el respaldo local.");
      loadLocalData();
    }
  } else {
    loadLocalData();
  }

  if (!state.operators.length) {
    state.operators = [DEFAULT_ADMIN];
    await persistOperators();
  }
}

function loadLocalData() {
  state.operators = JSON.parse(localStorage.getItem("hdy_operators") || "[]");
  state.measurements = JSON.parse(localStorage.getItem("hdy_measurements") || "[]");
}

function bindGlobalEvents() {
  dom.loginForm.addEventListener("submit", handleLogin);
  dom.logoutBtn.addEventListener("click", logout);
  dom.mobileMenuBtn.addEventListener("click", () => dom.sidebar.classList.toggle("open"));
}

function hydrateSession() {
  const session = JSON.parse(sessionStorage.getItem("hdy_session") || "null");
  if (session) {
    const user = state.operators.find((operator) => operator.id === session.id);
    if (user) {
      state.currentUser = user;
      renderApp();
      return;
    }
  }
  dom.loginScreen.classList.remove("hidden");
  dom.appShell.classList.add("hidden");
}

function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById("loginUser").value.trim();
  const password = document.getElementById("loginPassword").value.trim();
  const user = state.operators.find((operator) => operator.username === username && operator.password === password);

  if (!user) {
    showToast("Usuario o contraseña incorrectos.");
    return;
  }

  state.currentUser = user;
  sessionStorage.setItem("hdy_session", JSON.stringify({ id: user.id }));
  dom.loginForm.reset();
  renderApp();
}

function logout() {
  state.currentUser = null;
  sessionStorage.removeItem("hdy_session");
  dom.loginScreen.classList.remove("hidden");
  dom.appShell.classList.add("hidden");
}

function renderApp() {
  dom.loginScreen.classList.add("hidden");
  dom.appShell.classList.remove("hidden");
  dom.currentUserName.textContent = state.currentUser.full_name;
  dom.currentUserRole.textContent = roleLabel(state.currentUser.role);
  renderNav();
  if (!canAccess(state.activeView)) {
    state.activeView = "home";
  }
  renderView(state.activeView);
}

function renderNav() {
  dom.navMenu.innerHTML = navItems
    .filter((item) => item.roles.includes(state.currentUser.role))
    .map((item) => `<button class="nav-item ${state.activeView === item.id ? "active" : ""}" data-view="${item.id}" type="button">${item.label}</button>`)
    .join("");

  dom.navMenu.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeView = button.dataset.view;
      dom.sidebar.classList.remove("open");
      renderView(state.activeView);
      renderNav();
    });
  });
}

function canAccess(viewId) {
  const item = navItems.find((navItem) => navItem.id === viewId);
  return item && item.roles.includes(state.currentUser.role);
}

function renderView(viewId) {
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  const item = navItems.find((navItem) => navItem.id === viewId);
  dom.viewTitle.textContent = item.label;
  dom.viewSubtitle.textContent = item.subtitle;

  if (viewId === "home") renderMeasurementTableView("homeView", "home", true);
  if (viewId === "operator") renderOperatorView();
  if (viewId === "measurement") renderMeasurementFormView();
  if (viewId === "consult") renderMeasurementTableView("consultView", "consult", false);
  if (viewId === "stats") renderStatsView();

  document.getElementById(`${viewId}View`)?.classList.add("active");
}

function renderMeasurementTableView(containerId, filterKey, todayOnly) {
  const container = document.getElementById(containerId);
  const rows = getFilteredMeasurements(filterKey, todayOnly);
  const totalPages = Math.max(1, Math.ceil(rows.length / 10));
  state.pages[filterKey] = Math.min(state.pages[filterKey], totalPages);
  const page = state.pages[filterKey];
  const pageRows = rows.slice((page - 1) * 10, page * 10);
  const cards = getCards(rows);
  const showAdminTools = state.currentUser.role === "administrador" && filterKey === "consult";

  container.innerHTML = `
    <div class="dashboard-cards">
      ${infoCard("Registros", cards.total)}
      ${infoCard("Líneas activas", cards.lines)}
      ${infoCard("Componentes", cards.components)}
      ${infoCard("Operadores", cards.operators)}
    </div>
    <section class="panel">
      <div class="panel-header">
        <h3>${todayOnly ? "Registros del día" : "Todas las mediciones"}</h3>
        ${showAdminTools ? `<button id="downloadExcelBtn" class="secondary-action" type="button">Descargar Excel</button>` : ""}
      </div>
      ${renderFilters(filterKey)}
      ${renderTable(pageRows, showAdminTools)}
      <div class="pagination">
        <button class="secondary-action" id="${filterKey}Prev" type="button">Anterior</button>
        <span>Página ${page} de ${totalPages}</span>
        <button class="secondary-action" id="${filterKey}Next" type="button">Siguiente</button>
      </div>
    </section>
  `;

  bindFilters(filterKey, container);
  bindTableActions(showAdminTools, container);
  document.getElementById(`${filterKey}Prev`).addEventListener("click", () => {
    state.pages[filterKey] = Math.max(1, state.pages[filterKey] - 1);
    renderMeasurementTableView(containerId, filterKey, todayOnly);
  });
  document.getElementById(`${filterKey}Next`).addEventListener("click", () => {
    state.pages[filterKey] = Math.min(totalPages, state.pages[filterKey] + 1);
    renderMeasurementTableView(containerId, filterKey, todayOnly);
  });
  document.getElementById("downloadExcelBtn")?.addEventListener("click", downloadExcel);
}

function infoCard(label, value) {
  return `<article class="info-card"><span>${label}</span><strong>${value}</strong></article>`;
}

function getCards(rows) {
  return {
    total: rows.length,
    lines: new Set(rows.map((row) => row.line)).size,
    components: new Set(rows.map((row) => row.component)).size,
    operators: new Set(rows.map((row) => row.operator)).size
  };
}

function renderFilters(filterKey) {
  const filters = state.filters[filterKey];
  return `
    <div class="filters">
      <input data-filter="search" placeholder="Buscar por texto" value="${escapeAttr(filters.search)}" />
      ${selectHtml("line", "Línea", getLines(), filters.line, true)}
      ${selectHtml("component", "Componente", COMPONENTS, filters.component, true)}
      ${selectHtml("week", "Semana", weeks(), filters.week, true)}
      ${selectHtml("operator", "Operador", state.operators.map((operator) => operator.full_name), filters.operator, true)}
    </div>
  `;
}

function bindFilters(filterKey, container) {
  container.querySelectorAll(`[data-filter]`).forEach((field) => {
    field.addEventListener("input", () => {
      state.filters[filterKey][field.dataset.filter] = field.value;
      state.pages[filterKey] = 1;
      renderView(filterKey === "home" ? "home" : "consult");
    });
  });
}

function renderTable(rows, showAdminTools) {
  const empty = `<tr><td colspan="${showAdminTools ? 7 : 6}">No hay registros para mostrar.</td></tr>`;
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Fecha de captura</th>
            <th>Línea</th>
            <th>Componente</th>
            <th>Semana</th>
            <th>Operador</th>
            <th>Ver más</th>
            ${showAdminTools ? "<th>Acciones</th>" : ""}
          </tr>
        </thead>
        <tbody>
          ${rows.length ? rows.map((row) => tableRow(row, showAdminTools)).join("") : empty}
        </tbody>
      </table>
    </div>
  `;
}

function tableRow(row, showAdminTools) {
  return `
    <tr>
      <td>${formatDate(row.capture_date)}</td>
      <td>${row.line}</td>
      <td>${row.component}</td>
      <td>${row.week}</td>
      <td>${row.operator}</td>
      <td><button class="mini-action" data-detail="${row.id}" type="button">Ver más</button></td>
      ${showAdminTools ? `<td><div class="row-actions"><button class="mini-action edit" data-edit="${row.id}" type="button">Editar</button><button class="mini-action delete" data-delete="${row.id}" type="button">Eliminar</button></div></td>` : ""}
    </tr>
  `;
}

function bindTableActions(showAdminTools, container) {
  container.querySelectorAll("[data-detail]").forEach((button) => {
    button.addEventListener("click", () => showDetail(button.dataset.detail));
  });
  if (!showAdminTools) return;
  container.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => editMeasurement(button.dataset.edit));
  });
  container.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteMeasurement(button.dataset.delete));
  });
}

function showDetail(id) {
  const row = state.measurements.find((measurement) => measurement.id === id);
  if (!row) return;
  const fields = [
    ["Fecha de captura", formatDate(row.capture_date)],
    ["Operador", row.operator],
    ["Línea", row.line],
    ["Componente", row.component],
    ["Año", row.year],
    ["Semana", row.week],
    ["Temperatura", row.temperature],
    ["Vibración horizontal", row.vibration_horizontal],
    ["Vibración vertical", row.vibration_vertical],
    ["Vibración axial", row.vibration_axial],
    ["Vibración Rod delantero", row.vibration_rod_delantero],
    ["Amperaje L1", row.amperage_l1],
    ["Amperaje L2", row.amperage_l2],
    ["Amperaje L3", row.amperage_l3]
  ];
  dom.modalContent.innerHTML = `<h3>Detalle de medición</h3><div class="detail-grid">${fields.map(([label, value]) => `<div class="detail-item"><span>${label}</span><strong>${value ?? ""}</strong></div>`).join("")}</div>`;
  dom.detailModal.showModal();
}

function renderOperatorView() {
  const container = document.getElementById("operatorView");
  const editingOperator = state.operators.find((operator) => operator.id === state.editingOperatorId);
  container.innerHTML = `
    <section class="panel">
      <div class="panel-header"><h3>${editingOperator ? "Editar operador" : "Agregar operador"}</h3></div>
      <form id="operatorForm" class="form-grid two">
        <label>Nombre completo del operador<input id="operatorName" value="${escapeAttr(editingOperator?.full_name || "")}" required /></label>
        <label>Número de empleado<input id="employeeNumber" value="${escapeAttr(editingOperator?.employee_number || "")}" required /></label>
        <label>Usuario<input id="operatorUsername" value="${escapeAttr(editingOperator?.username || "")}" disabled /></label>
        <label>Contraseña<input id="operatorPassword" value="${escapeAttr(editingOperator?.password || "")}" disabled /></label>
        <label>Rol<select id="operatorRole" required><option value="administrador" ${editingOperator?.role === "administrador" ? "selected" : ""}>Administrador</option><option value="operador" ${editingOperator?.role === "operador" ? "selected" : ""}>Operador</option></select></label>
        <div class="form-actions">
          ${editingOperator ? `<button id="cancelOperatorEditBtn" class="ghost-action" type="button">Cancelar</button>` : ""}
          <button class="primary-action" type="submit">${editingOperator ? "Actualizar operador" : "Guardar operador"}</button>
        </div>
      </form>
    </section>
    <section class="panel">
      <div class="panel-header"><h3>Usuarios registrados</h3></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Nombre</th><th>Número de empleado</th><th>Usuario</th><th>Rol</th><th>Acciones</th></tr></thead>
          <tbody>${state.operators.map(operatorRow).join("")}</tbody>
        </table>
      </div>
    </section>
  `;

  const employee = document.getElementById("employeeNumber");
  employee.addEventListener("input", () => {
    document.getElementById("operatorUsername").value = employee.value.trim();
    document.getElementById("operatorPassword").value = employee.value.trim();
  });
  document.getElementById("operatorForm").addEventListener("submit", saveOperator);
  document.getElementById("cancelOperatorEditBtn")?.addEventListener("click", () => {
    state.editingOperatorId = null;
    renderOperatorView();
  });
  document.querySelectorAll("[data-edit-operator]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editingOperatorId = button.dataset.editOperator;
      renderOperatorView();
    });
  });
  document.querySelectorAll("[data-delete-operator]").forEach((button) => {
    button.addEventListener("click", () => deleteOperator(button.dataset.deleteOperator));
  });
}

function operatorRow(operator) {
  const protectedUser = operator.id === state.currentUser.id || operator.username === "admin";
  return `
    <tr>
      <td>${operator.full_name}</td>
      <td>${operator.employee_number}</td>
      <td>${operator.username}</td>
      <td>${roleLabel(operator.role)}</td>
      <td><div class="row-actions"><button class="mini-action edit" data-edit-operator="${operator.id}" type="button">Editar</button>${protectedUser ? "" : `<button class="mini-action delete" data-delete-operator="${operator.id}" type="button">Eliminar</button>`}</div></td>
    </tr>
  `;
}

async function saveOperator(event) {
  event.preventDefault();
  const employeeNumber = document.getElementById("employeeNumber").value.trim();
  if (state.operators.some((operator) => operator.id !== state.editingOperatorId && (operator.employee_number === employeeNumber || operator.username === employeeNumber))) {
    showToast("Ese número de empleado ya existe.");
    return;
  }
  const operator = {
    id: crypto.randomUUID(),
    full_name: document.getElementById("operatorName").value.trim(),
    employee_number: employeeNumber,
    username: employeeNumber,
    password: employeeNumber,
    role: document.getElementById("operatorRole").value,
    created_at: new Date().toISOString()
  };
  if (state.editingOperatorId) {
    const previous = state.operators.find((item) => item.id === state.editingOperatorId);
    operator.id = state.editingOperatorId;
    operator.created_at = previous?.created_at || operator.created_at;
    state.operators = state.operators.map((item) => (item.id === state.editingOperatorId ? operator : item));
    if (state.currentUser.id === state.editingOperatorId) {
      state.currentUser = operator;
      sessionStorage.setItem("hdy_session", JSON.stringify({ id: operator.id }));
      dom.currentUserName.textContent = operator.full_name;
      dom.currentUserRole.textContent = roleLabel(operator.role);
    }
    state.editingOperatorId = null;
    showToast("Operador actualizado.");
  } else {
    state.operators.push(operator);
    showToast("Operador guardado.");
  }
  await persistOperators();
  if (state.currentUser.role !== "administrador") {
    state.activeView = "home";
    renderApp();
    return;
  }
  renderOperatorView();
}

async function deleteOperator(id) {
  if (!confirm("¿Deseas eliminar este operador?")) return;
  state.operators = state.operators.filter((operator) => operator.id !== id);
  if (state.supabase) {
    await state.supabase.from(TABLES.operators).delete().eq("id", id);
  }
  await persistOperators();
  showToast("Operador eliminado.");
  renderOperatorView();
}

function renderMeasurementFormView(prefill = null) {
  const container = document.getElementById("measurementView");
  const row = prefill || {};
  const editing = Boolean(state.editingMeasurementId);
  container.innerHTML = `
    <section class="panel">
      <div class="panel-header"><h3>${editing ? "Editar medición" : "Nueva medición"}</h3></div>
      <form id="measurementForm" class="form-grid three">
        <label>Operador<input id="measureOperator" value="${escapeAttr(row.operator || state.currentUser.full_name)}" disabled /></label>
        <label>Línea${selectHtml("measureLine", "", getLines(), row.line || "", false)}</label>
        <label>Componente${selectHtml("measureComponent", "", COMPONENTS, row.component || "", false)}</label>
        <label>Año<input id="measureYear" type="number" min="2000" max="2100" value="${escapeAttr(row.year || new Date().getFullYear())}" required /></label>
        <label>Semana${selectHtml("measureWeek", "", weeks(), row.week || "", false)}</label>
        <label>Temperatura<input id="measureTemperature" type="number" step="0.01" value="${escapeAttr(row.temperature || "")}" required /></label>
        <label>Vibración horizontal<input id="measureVH" type="number" step="0.01" value="${escapeAttr(row.vibration_horizontal || "")}" required /></label>
        <label>Vibración vertical<input id="measureVV" type="number" step="0.01" value="${escapeAttr(row.vibration_vertical || "")}" required /></label>
        <label>Vibración axial<input id="measureVA" type="number" step="0.01" value="${escapeAttr(row.vibration_axial || "")}" required /></label>
        <label>Vibración Rod delantero<input id="measureVRD" type="number" step="0.01" value="${escapeAttr(row.vibration_rod_delantero || "")}" required /></label>
        <label>Amperaje L1<input id="measureA1" type="number" step="0.01" value="${escapeAttr(row.amperage_l1 || "")}" required /></label>
        <label>Amperaje L2<input id="measureA2" type="number" step="0.01" value="${escapeAttr(row.amperage_l2 || "")}" required /></label>
        <label>Amperaje L3<input id="measureA3" type="number" step="0.01" value="${escapeAttr(row.amperage_l3 || "")}" required /></label>
        <div class="form-actions">
          ${editing ? `<button id="cancelEditBtn" class="ghost-action" type="button">Cancelar</button>` : ""}
          <button class="primary-action" type="submit">${editing ? "Actualizar" : "Guardar medición"}</button>
        </div>
      </form>
    </section>
  `;
  document.getElementById("measurementForm").addEventListener("submit", saveMeasurement);
  document.getElementById("cancelEditBtn")?.addEventListener("click", () => {
    state.editingMeasurementId = null;
    renderMeasurementFormView();
  });
}

async function saveMeasurement(event) {
  event.preventDefault();
  const measurement = {
    id: state.editingMeasurementId || crypto.randomUUID(),
    capture_date: state.editingMeasurementId ? state.measurements.find((row) => row.id === state.editingMeasurementId)?.capture_date : new Date().toISOString(),
    operator: document.getElementById("measureOperator").value,
    operator_id: state.currentUser.id,
    line: document.getElementById("measureLine").value,
    component: document.getElementById("measureComponent").value,
    year: numberValue("measureYear"),
    week: document.getElementById("measureWeek").value,
    temperature: numberValue("measureTemperature"),
    vibration_horizontal: numberValue("measureVH"),
    vibration_vertical: numberValue("measureVV"),
    vibration_axial: numberValue("measureVA"),
    vibration_rod_delantero: numberValue("measureVRD"),
    amperage_l1: numberValue("measureA1"),
    amperage_l2: numberValue("measureA2"),
    amperage_l3: numberValue("measureA3"),
    created_at: new Date().toISOString()
  };

  if (state.editingMeasurementId) {
    state.measurements = state.measurements.map((row) => (row.id === state.editingMeasurementId ? measurement : row));
    state.editingMeasurementId = null;
    showToast("Medición actualizada.");
  } else {
    state.measurements.unshift(measurement);
    showToast("Medición guardada.");
  }
  await persistMeasurements();
  renderMeasurementFormView();
}

function editMeasurement(id) {
  const row = state.measurements.find((measurement) => measurement.id === id);
  if (!row) return;
  state.editingMeasurementId = id;
  state.activeView = "measurement";
  renderNav();
  renderView("measurement");
  renderMeasurementFormView(row);
}

async function deleteMeasurement(id) {
  if (!confirm("¿Deseas eliminar este registro?")) return;
  state.measurements = state.measurements.filter((measurement) => measurement.id !== id);
  if (state.supabase) {
    await state.supabase.from(TABLES.measurements).delete().eq("id", id);
  }
  await persistMeasurements();
  showToast("Registro eliminado.");
  renderView(state.activeView);
}

function renderStatsView() {
  const container = document.getElementById("statsView");
  container.innerHTML = `
    <section class="panel">
      <div class="panel-header"><h3>Filtros de estadísticas</h3></div>
      <div class="filters">
        ${selectHtml("statsLine", "Línea", getLines(), state.filters.stats.line, true)}
        ${selectHtml("statsComponent", "Componente", COMPONENTS, state.filters.stats.component, true)}
        ${selectHtml("statsWeek", "Semana", weeks(), state.filters.stats.week, true)}
        ${selectHtml("statsYear", "Año", [...new Set(state.measurements.map((row) => row.year).filter(Boolean))].sort(), state.filters.stats.year, true)}
        ${selectHtml("statsOperator", "Operador", state.operators.map((operator) => operator.full_name), state.filters.stats.operator, true)}
      </div>
    </section>
    <section class="chart-grid">
      ${chartPanel("chartBar", "Promedio de temperatura por línea")}
      ${chartPanel("chartPie", "Distribución por componente")}
      ${chartPanel("chartLine", "Temperatura por fecha")}
      ${chartPanel("chartScatter", "Temperatura vs vibración horizontal")}
    </section>
  `;
  ["Line", "Component", "Week", "Year", "Operator"].forEach((key) => {
    document.getElementById(`stats${key}`).addEventListener("change", (event) => {
      state.filters.stats[key.toLowerCase()] = event.target.value;
      drawCharts();
    });
  });
  drawCharts();
}

function chartPanel(id, title) {
  return `<article class="panel chart-box"><div class="panel-header"><h3>${title}</h3></div><canvas id="${id}"></canvas></article>`;
}

function drawCharts() {
  const rows = getStatsRows();
  Object.values(state.charts).forEach((chart) => chart.destroy());
  state.charts = {};

  const byLine = groupAverage(rows, "line", "temperature");
  state.charts.bar = new Chart(document.getElementById("chartBar"), {
    type: "bar",
    data: { labels: byLine.labels, datasets: [{ label: "Temperatura", data: byLine.values, backgroundColor: "#495057" }] },
    options: baseChartOptions()
  });

  const byComponent = groupCount(rows, "component");
  const pieOptions = baseChartOptions();
  pieOptions.plugins.legend.display = false;
  state.charts.pie = new Chart(document.getElementById("chartPie"), {
    type: "pie",
    data: { labels: byComponent.labels, datasets: [{ data: byComponent.values, backgroundColor: ["#212529", "#343a40", "#495057", "#6c757d", "#adb5bd", "#8fd3a2"] }] },
    options: pieOptions
  });

  const lineRows = [...rows].sort((a, b) => new Date(a.capture_date) - new Date(b.capture_date));
  state.charts.line = new Chart(document.getElementById("chartLine"), {
    type: "line",
    data: { labels: lineRows.map((row) => formatDate(row.capture_date)), datasets: [{ label: "Temperatura", data: lineRows.map((row) => row.temperature), borderColor: "#212529", backgroundColor: "rgba(73,80,87,.16)", tension: 0.3 }] },
    options: baseChartOptions()
  });

  state.charts.scatter = new Chart(document.getElementById("chartScatter"), {
    type: "scatter",
    data: { datasets: [{ label: "Mediciones", data: rows.map((row) => ({ x: row.vibration_horizontal, y: row.temperature })), backgroundColor: "#343a40" }] },
    options: scatterChartOptions()
  });
}

function scatterChartOptions() {
  const options = baseChartOptions();
  options.scales.x.title.display = true;
  options.scales.x.title.text = "Vibración horizontal";
  options.scales.y.title.display = true;
  options.scales.y.title.text = "Temperatura";
  return options;
}

function baseChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: 6 },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          boxWidth: 10,
          boxHeight: 10,
          color: "#212529",
          font: { family: "Arial", size: 12, weight: "normal" }
        }
      },
      tooltip: {
        titleFont: { family: "Arial", size: 12 },
        bodyFont: { family: "Arial", size: 12 }
      }
    },
    scales: {
      x: {
        ticks: {
          autoSkip: true,
          maxRotation: 0,
          color: "#495057",
          font: { family: "Arial", size: 12 }
        },
        title: { font: { family: "Arial", size: 12 } }
      },
      y: {
        ticks: {
          color: "#495057",
          font: { family: "Arial", size: 12 }
        },
        title: { font: { family: "Arial", size: 12 } }
      }
    }
  };
}

function getFilteredMeasurements(filterKey, todayOnly) {
  const filters = state.filters[filterKey];
  const today = localDateKey(new Date());
  return state.measurements.filter((row) => {
    const text = `${row.capture_date} ${row.line} ${row.component} ${row.week} ${row.operator}`.toLowerCase();
    return (!todayOnly || localDateKey(row.capture_date) === today)
      && (!filters.search || text.includes(filters.search.toLowerCase()))
      && (!filters.line || row.line === filters.line)
      && (!filters.component || row.component === filters.component)
      && (!filters.week || String(row.week) === String(filters.week))
      && (!filters.operator || row.operator === filters.operator);
  });
}

function localDateKey(date) {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getStatsRows() {
  const filters = state.filters.stats;
  return state.measurements.filter((row) => (
    (!filters.line || row.line === filters.line)
    && (!filters.component || row.component === filters.component)
    && (!filters.week || String(row.week) === String(filters.week))
    && (!filters.year || String(row.year) === String(filters.year))
    && (!filters.operator || row.operator === filters.operator)
  ));
}

function groupCount(rows, key) {
  const map = new Map();
  rows.forEach((row) => map.set(row[key], (map.get(row[key]) || 0) + 1));
  return { labels: [...map.keys()], values: [...map.values()] };
}

function groupAverage(rows, key, valueKey) {
  const map = new Map();
  rows.forEach((row) => {
    const item = map.get(row[key]) || { sum: 0, count: 0 };
    item.sum += Number(row[valueKey]) || 0;
    item.count += 1;
    map.set(row[key], item);
  });
  return {
    labels: [...map.keys()],
    values: [...map.values()].map((item) => Number((item.sum / item.count).toFixed(2)))
  };
}

function getLines() {
  return Array.from({ length: 21 }, (_, index) => `OE ${String(index + 1).padStart(2, "0")}`);
}

function weeks() {
  return Array.from({ length: 52 }, (_, index) => String(index + 1));
}

function selectHtml(id, label, options, value, includeAll) {
  const field = `
    <select id="${id}" data-filter="${id === "line" || id === "component" || id === "week" || id === "operator" ? id : ""}" required>
      ${includeAll ? `<option value="">${label || "Todos"}</option>` : `<option value="">Selecciona</option>`}
      ${options.map((option) => `<option value="${escapeAttr(option)}" ${String(value) === String(option) ? "selected" : ""}>${option}</option>`).join("")}
    </select>
  `;
  return label && id.startsWith("stats") ? `<label>${label}${field}</label>` : field;
}

function numberValue(id) {
  return Number(document.getElementById(id).value);
}

function formatDate(date) {
  if (!date) return "";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
}

function escapeAttr(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function roleLabel(role) {
  return role === "administrador" ? "Administrador" : "Operador";
}

async function persistOperators() {
  localStorage.setItem("hdy_operators", JSON.stringify(state.operators));
  if (state.supabase) {
    await state.supabase.from(TABLES.operators).upsert(state.operators);
  }
}

async function persistMeasurements() {
  localStorage.setItem("hdy_measurements", JSON.stringify(state.measurements));
  if (state.supabase) {
    await state.supabase.from(TABLES.measurements).upsert(state.measurements);
  }
}

async function downloadExcel() {
  const rows = state.measurements.map((row) => ({
    "Fecha de captura": formatDate(row.capture_date),
    Operador: row.operator,
    Línea: row.line,
    Componente: row.component,
    Año: row.year,
    Semana: row.week,
    Temperatura: row.temperature,
    "Vibración horizontal": row.vibration_horizontal,
    "Vibración vertical": row.vibration_vertical,
    "Vibración axial": row.vibration_axial,
    "Vibración Rod delantero": row.vibration_rod_delantero,
    "Amperaje L1": row.amperage_l1,
    "Amperaje L2": row.amperage_l2,
    "Amperaje L3": row.amperage_l3
  }));
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Mediciones");
  XLSX.writeFile(workbook, "hilos-de-yecapixtla-mediciones.xlsx");
}

function showToast(message) {
  dom.toast.textContent = message;
  dom.toast.classList.remove("hidden");
  setTimeout(() => dom.toast.classList.add("hidden"), 3200);
}
