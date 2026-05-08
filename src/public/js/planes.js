
//  CARGAR (AJAX) 
async function loadPlanes() {
  document.getElementById('gridPlanes').innerHTML =
    '<div style="text-align:center;padding:40px;color:#aaa">Cargando...</div>';
  try {
    dataPlanes = await api('GET', '/api/planes');
    const el = document.getElementById('countPlanes');
    if (el) el.textContent = dataPlanes.filter(p => p.activo).length;
    renderPlanes(dataPlanes);
    // Poblar filtro de membresías
    const sel = document.getElementById('filtroMembPlan');
    sel.innerHTML = '<option value="todos">Todos los planes</option>';
    dataPlanes.forEach(p =>
      sel.innerHTML += `<option value="${p.id_plan}">${p.nombre}</option>`);
  } catch (e) {
    document.getElementById('gridPlanes').innerHTML =
      `<div style="color:#c62828">${e.message}</div>`;
  }
}

// RENDER GRID 
function renderPlanes(data) {
  const grid = document.getElementById('gridPlanes');
  if (!data.length) {
    grid.innerHTML = '<div style="text-align:center;padding:40px;color:#bbb">Sin planes registrados</div>';
    return;
  }
  const tipoLabel = { nuevo: 'Nuevo', renovacion: 'Renovación', interdiario: 'Interdiario' };
  const tipoBadge = { nuevo: 'plan-badge-nuevo', renovacion: 'plan-badge-renov', interdiario: 'plan-badge-inter' };

  grid.innerHTML = data.map(p => `
    <div class="col-md-4 col-lg-3">
      <div class="plan-card ${p.activo ? '' : 'inactivo'}">
        <span class="plan-badge ${p.activo ? tipoBadge[p.tipo_cliente] : 'plan-badge-inact'}">
          ${p.activo ? tipoLabel[p.tipo_cliente] : 'Inactivo'}
        </span>
        <div class="plan-precio">S/ <span style="font-size:28px">${parseFloat(p.precio).toFixed(2)}</span></div>
        <div class="plan-nombre">${p.nombre}</div>
        <div class="plan-detalle">
          <i class="bi bi-clock me-1"></i>${p.duracion_meses} mes${p.duracion_meses > 1 ? 'es' : ''}
          ${p.permite_fraccion
      ? `&nbsp;·&nbsp; <i class="bi bi-credit-card-2-front me-1"></i>Fracciona (${p.dias_limite_fraccion}d)`
      : ''}
        </div>
        ${p.descripcion ? `<div style="font-size:11px;color:#888;margin-top:6px">${p.descripcion}</div>` : ''}
        <div style="margin-top:14px;display:flex;gap:6px">
          <button class="btn-icon" onclick="editPlan(${p.id_plan})"><i class="bi bi-pencil"></i></button>
          <button class="btn-icon danger" onclick="confirmDelete('plan',${p.id_plan},'${p.nombre}')">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    </div>`).join('');
}

//  RESET FORMULARIO
function resetPlanForm() {
  ['planId', 'planNombre', 'planDesc'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('planDuracion').value = '1';
  document.getElementById('planPrecio').value = '';
  document.getElementById('planTipo').value = 'nuevo';
  document.getElementById('planActivo').value = 'true';
  document.getElementById('planFraccion').checked = false;
  document.getElementById('planFraccionDias').style.display = 'none';
  document.getElementById('planDiasLimite').value = '20';
  document.getElementById('alertPlan').className = 'alert-msg';
  document.getElementById('modalPlanTitle').textContent = 'Nuevo Plan';
}

function toggleFraccion() {
  const checked = document.getElementById('planFraccion').checked;
  document.getElementById('planFraccionDias').style.display = checked ? 'block' : 'none';
}

//  EDITAR 
function editPlan(id) {
  const p = dataPlanes.find(x => x.id_plan === id);
  if (!p) return;
  document.getElementById('planId').value = id;
  document.getElementById('planNombre').value = p.nombre;
  document.getElementById('planTipo').value = p.tipo_cliente;
  document.getElementById('planDuracion').value = p.duracion_meses;
  document.getElementById('planPrecio').value = p.precio;
  document.getElementById('planActivo').value = String(p.activo);
  document.getElementById('planDesc').value = p.descripcion || '';
  document.getElementById('planFraccion').checked = p.permite_fraccion;
  document.getElementById('planFraccionDias').style.display = p.permite_fraccion ? 'block' : 'none';
  document.getElementById('planDiasLimite').value = p.dias_limite_fraccion;
  document.getElementById('modalPlanTitle').textContent = 'Editar Plan';
  document.getElementById('alertPlan').className = 'alert-msg';
  document.getElementById('modalPlan').classList.add('open');
}

//  GUARDAR (AJAX POST / PUT) 
async function savePlan() {
  const id = document.getElementById('planId').value;
  const nombre = document.getElementById('planNombre').value.trim();
  const tipo = document.getElementById('planTipo').value;
  const duracion = document.getElementById('planDuracion').value;
  const precio = document.getElementById('planPrecio').value;
  const activo = document.getElementById('planActivo').value === 'true';
  const desc = document.getElementById('planDesc').value.trim();
  const fraccion = document.getElementById('planFraccion').checked;
  const dias = document.getElementById('planDiasLimite').value;
  if (!nombre || !duracion || !precio) {
    showAlert('alertPlan', 'Completa todos los campos requeridos');
    return;
  }
  try {
    const body = {
      nombre, tipo_cliente: tipo, duracion_meses: Number(duracion),
      precio: parseFloat(precio), permite_fraccion: fraccion,
      dias_limite_fraccion: Number(dias), descripcion: desc || null, activo
    };
    if (id) await api('PUT', `/api/planes/${id}`, body);
    else await api('POST', '/api/planes', body);
    closeModal('modalPlan');
    loadPlanes();
  } catch (e) { showAlert('alertPlan', e.message); }
}
