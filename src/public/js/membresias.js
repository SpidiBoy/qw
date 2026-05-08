
//  CARGAR (AJAX) 
async function loadMembresias() {
  document.getElementById('listadoMembresias').innerHTML =
    '<div style="text-align:center;padding:40px;color:#aaa">Cargando...</div>';
  const estado = document.getElementById('filtroMembEstado').value;
  const idPlan = document.getElementById('filtroMembPlan').value;
  try {
    let url = '/api/membresias?';
    if (estado !== 'todos') url += `estado=${estado}&`;
    if (idPlan !== 'todos') url += `id_plan=${idPlan}&`;
    dataMembresias = await api('GET', url);
    const el = document.getElementById('countMembresias');
    if (el) el.textContent = dataMembresias.length;
    renderMembresias(dataMembresias);
  } catch (e) {
    document.getElementById('listadoMembresias').innerHTML =
      `<div style="text-align:center;padding:40px;color:#c62828">${e.message}</div>`;
  }
}

function filtrarMembresias() {
  const q = document.getElementById('searchMembresias').value.toLowerCase();
  document.querySelectorAll('.memb-card').forEach(card => {
    card.style.display = card.dataset.search.toLowerCase().includes(q) ? '' : 'none';
  });
}

//  RENDER CARDS 
function renderMembresias(data) {
  const cont = document.getElementById('listadoMembresias');
  if (!data.length) {
    cont.innerHTML = `<div style="text-align:center;padding:40px;color:#bbb">
      <i class="bi bi-card-checklist" style="font-size:40px;display:block;margin-bottom:10px"></i>
      Sin membresías con ese filtro</div>`;
    return;
  }
  cont.innerHTML = data.map(m => {
    const iniciales = (m.nombre_cliente || '?').split(' ').map(w => w[0]).slice(0, 2).join('');
    const saldoHtml = m.saldo_pendiente > 0
      ? `<div class="memb-saldo">Saldo: S/ ${parseFloat(m.saldo_pendiente).toFixed(2)}</div>` : '';
    const tipoLabel = m.tipo_ingreso === 'nuevo' ? 'Nuevo' : 'Renov.';
    const tipoColor = m.tipo_ingreso === 'nuevo' ? '#2e7d32' : '#e65100';
    return `<div class="memb-card ${m.estado}" data-search="${m.nombre_cliente} ${m.dni}">
      <div class="memb-avatar">${iniciales}</div>
      <div class="memb-info">
        <div class="memb-nombre">${m.nombre_cliente}</div>
        <div class="memb-plan"><span class="tag-plan">${m.nombre_plan}</span></div>
        <div class="memb-fechas">
          <i class="bi bi-calendar3 me-1"></i>${formatFechaCorta(m.fecha_inicio)} → ${formatFechaCorta(m.fecha_fin)}
          &nbsp;·&nbsp; <span style="color:${tipoColor};font-weight:700;font-size:11px">${tipoLabel}</span>
          &nbsp;·&nbsp; <span class="asesor-tag">${m.asesor}</span>
        </div>
      </div>
      <div class="memb-monto">
        <div class="memb-precio">S/ ${parseFloat(m.monto_total).toFixed(2)}</div>
        ${saldoHtml}
        <div style="margin-top:4px">${estadoBadgeMini(m.estado, m.saldo_pendiente)}</div>
      </div>
      <div class="memb-actions">
        <button class="btn-icon perm" title="Actualizar estado"
          onclick="openMembEstado(${m.id_membresia},'${m.estado}',${m.saldo_pendiente},'${m.observaciones || ''}')">
          <i class="bi bi-pencil-square"></i>
        </button>
      </div>
    </div>`;
  }).join('');
}

function estadoBadgeMini(estado, saldo) {
  if (saldo > 0) return '<span class="tag-estado-pendiente">Saldo pend.</span>';
  if (estado === 'activa') return '<span class="tag-estado-activa">Activa</span>';
  if (estado === 'vencida') return '<span class="tag-estado-vencida">Vencida</span>';
  return `<span class="tag-estado-anulada">${estado}</span>`;
}

// ─── MODAL ESTADO ─────────────────────────────────────────────────────────────
function openMembEstado(id, estado, saldo, obs) {
  document.getElementById('membEstadoId').value = id;
  document.getElementById('membEstadoVal').value = estado;
  document.getElementById('membSaldoUpdate').value = parseFloat(saldo).toFixed(2);
  document.getElementById('membObsUpdate').value = obs;
  document.getElementById('membSaldoUpdateGroup').style.display = saldo > 0 ? 'block' : 'none';
  document.getElementById('alertMembEstado').className = 'alert-msg';
  document.getElementById('modalMembEstado').classList.add('open');
}

async function saveMembEstado() {
  const id = document.getElementById('membEstadoId').value;
  const estado = document.getElementById('membEstadoVal').value;
  const saldo = document.getElementById('membSaldoUpdate').value;
  const obs = document.getElementById('membObsUpdate').value;
  try {
    await api('PUT', `/api/membresias/${id}`,
      { estado, observaciones: obs || null, saldo_pendiente: parseFloat(saldo) || 0 });
    closeModal('modalMembEstado');
    loadMembresias();
  } catch (e) { showAlert('alertMembEstado', e.message); }
}

//  RESET FORMULARIO 
function resetMembresiaForm() {
  ['membresiaId', 'membClienteBuscar', 'membObservaciones'].forEach(id =>
    document.getElementById(id).value = '');
  document.getElementById('membClienteId').value = '';
  document.getElementById('membClienteSeleccionado').style.display = 'none';
  document.getElementById('membClienteSeleccionado').textContent = '';
  document.getElementById('membClienteSugerencias').innerHTML = '';
  document.getElementById('membMonto').value = '';
  document.getElementById('membSaldo').value = '0';
  document.getElementById('membInfo').style.display = 'none';
  document.getElementById('membSaldoGroup').style.display = 'none';
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('membFechaInicio').value = hoy;
  document.getElementById('membFechaInicio').addEventListener('change', calcularFechaFin);
  document.getElementById('alertMembresia').className = 'alert-msg';
  document.getElementById('modalMembresiaTitle').textContent = 'Nueva Membresía';
}

//  AUTOCOMPLETE CLIENTE 
let _buscarTimer = null;
function buscarClienteMemb(q) {
  clearTimeout(_buscarTimer);
  const cont = document.getElementById('membClienteSugerencias');
  if (q.length < 2) { cont.innerHTML = ''; return; }
  _buscarTimer = setTimeout(() => {
    const matches = dataClientes.filter(c =>
      `${c.nombre} ${c.apellido}`.toLowerCase().includes(q.toLowerCase()) ||
      c.dni.includes(q)
    ).slice(0, 6);
    if (!matches.length) {
      cont.innerHTML = '<div style="padding:8px 14px;font-size:12px;color:#aaa;background:#fff;border-radius:8px;box-shadow:0 4px 12px #0001">Sin resultados</div>';
      return;
    }
    cont.innerHTML = `<div style="position:absolute;z-index:100;width:100%;background:#fff;border-radius:8px;box-shadow:0 4px 12px #0002;overflow:hidden">
      ${matches.map(c =>
      `<div onclick="seleccionarClienteMemb(${c.id_cliente},'${c.nombre} ${c.apellido}','${c.dni}')"
          style="padding:10px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid #f5f5f5;transition:background .1s"
          onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='#fff'">
            <strong>${c.nombre} ${c.apellido}</strong>
            <span style="color:#888;font-size:11px">${c.dni}</span>
            ${c.memb_estado === 'activa'
        ? '<span style="float:right;color:#c62828;font-size:10px">⚠ Memb. activa</span>' : ''}
        </div>`).join('')}
    </div>`;
  }, 200);
}

function seleccionarClienteMemb(id, nombre, dni) {
  document.getElementById('membClienteId').value = id;
  document.getElementById('membClienteBuscar').value = `${nombre} — ${dni}`;
  document.getElementById('membClienteSugerencias').innerHTML = '';
  const info = document.getElementById('membClienteSeleccionado');
  const c = dataClientes.find(x => x.id_cliente === id);
  info.textContent = `✓ ${nombre} | DNI: ${dni}`;
  if (c && c.memb_estado === 'activa') info.textContent += ' ⚠️ Ya tiene membresía activa';
  info.style.display = 'block';
}

//  SELECTS AUXILIARES 
async function cargarPlanesSelect() {
  const sel = document.getElementById('membPlan');
  sel.innerHTML = '<option value="">Seleccionar plan...</option>';
  try {
    const planes = dataPlanes.length
      ? dataPlanes.filter(p => p.activo)
      : await api('GET', '/api/planes/activos');
    planes.forEach(p => {
      sel.innerHTML += `<option value="${p.id_plan}"
        data-precio="${p.precio}" data-meses="${p.duracion_meses}"
        data-fraccion="${p.permite_fraccion}" data-dias="${p.dias_limite_fraccion}">
        ${p.nombre} — S/ ${p.precio}
      </option>`;
    });
  } catch (e) { }
}

async function cargarAsesoresSelect() {
  const sel = document.getElementById('membAsesor');
  sel.innerHTML = '<option value="">Seleccionar asesor...</option>';
  try {
    const usuarios = dataUsuarios.length ? dataUsuarios : await api('GET', '/api/usuarios');
    usuarios.filter(u => u.estado === 1).forEach(u => {
      const alias = u.alias_asesor || u.nombre;
      const esSelf = u.id_usuario === JSON.parse(atob(TOKEN.split('.')[1])).id;
      sel.innerHTML += `<option value="${u.id_usuario}" ${esSelf ? 'selected' : ''}>${alias}</option>`;
    });
  } catch (e) { }
}

//  LÓGICA PLAN / FECHA FIN 
function onPlanChange() {
  const sel = document.getElementById('membPlan');
  const opt = sel.options[sel.selectedIndex];
  if (!opt || !opt.value) { document.getElementById('membInfo').style.display = 'none'; return; }
  const precio = parseFloat(opt.dataset.precio);
  const meses = parseInt(opt.dataset.meses);
  const fraccion = opt.dataset.fraccion === 'true';
  document.getElementById('membMonto').value = precio.toFixed(2);
  document.getElementById('membSaldoGroup').style.display = fraccion ? 'block' : 'none';
  if (!fraccion) document.getElementById('membSaldo').value = '0';
  document.getElementById('mbDuracion').textContent = `${meses} mes${meses > 1 ? 'es' : ''}`;
  document.getElementById('mbPrecio').textContent = `S/ ${precio.toFixed(2)}`;
  calcularFechaFin();
  document.getElementById('membInfo').style.display = 'block';
}

function calcularFechaFin() {
  const sel = document.getElementById('membPlan');
  const opt = sel.options[sel.selectedIndex];
  const fi = document.getElementById('membFechaInicio').value;
  if (!opt || !opt.value || !fi) { document.getElementById('mbFin').textContent = '—'; return; }
  const d = new Date(fi);
  d.setMonth(d.getMonth() + parseInt(opt.dataset.meses));
  document.getElementById('mbFin').textContent = formatFechaCorta(d.toISOString().split('T')[0]);
}

// GUARDAR MEMBRESÍA (AJAX POST) 
async function saveMembresia() {
  const id_cliente = document.getElementById('membClienteId').value;
  const id_plan = document.getElementById('membPlan').value;
  const fecha_inicio = document.getElementById('membFechaInicio').value;
  const monto = document.getElementById('membMonto').value;
  const saldo = document.getElementById('membSaldo').value || '0';
  const metodo = document.getElementById('membMetodoPago').value;
  const id_asesor = document.getElementById('membAsesor').value;
  const obs = document.getElementById('membObservaciones').value;
  if (!id_cliente) { showAlert('alertMembresia', 'Selecciona un cliente'); return; }
  if (!id_plan) { showAlert('alertMembresia', 'Selecciona un plan'); return; }
  if (!monto || !fecha_inicio) { showAlert('alertMembresia', 'Completa todos los campos requeridos'); return; }
  try {
    await api('POST', '/api/membresias', {
      id_cliente: Number(id_cliente), id_plan: Number(id_plan),
      fecha_inicio, monto_total: parseFloat(monto),
      saldo_pendiente: parseFloat(saldo), metodo_pago: metodo,
      id_asesor: id_asesor ? Number(id_asesor) : null,
      observaciones: obs || null
    });
    closeModal('modalMembresia');
    loadMembresias();
    loadClientes();
  } catch (e) { showAlert('alertMembresia', e.message); }
}
