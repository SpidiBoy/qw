
// ══════════════════════════════════════════════════════
//  MÓDULO: CATEGORÍAS
// ══════════════════════════════════════════════════════

let dataCategorias = [];

// ── CARGAR ────────────────────────────────────────────
async function loadCategorias() {
  document.getElementById('tbodyCategorias').innerHTML =
    '<tr class="loading-row"><td colspan="5">Cargando...</td></tr>';
  try {
    dataCategorias = await api('GET', '/api/categorias');
    renderCategorias(dataCategorias);
    const el = document.getElementById('countCategorias');
    if (el) el.textContent = dataCategorias.filter(c => c.estado === 1).length;
  } catch (e) {
    document.getElementById('tbodyCategorias').innerHTML =
      `<tr class="empty-row"><td colspan="5">${e.message}</td></tr>`;
  }
}

// ── RENDER ────────────────────────────────────────────
function renderCategorias(data) {
  const tbody = document.getElementById('tbodyCategorias');
  if (!data.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Sin categorías registradas</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(c => `
    <tr>
      <td>${c.id_categoria}</td>
      <td><strong>${c.nombre}</strong></td>
      <td style="color:#666">${c.descripcion || '—'}</td>
      <td>
        <span class="badge-estado ${c.estado === 1 ? 'badge-activo' : 'badge-inactivo'}">
          ${c.estado === 1 ? 'ACTIVO' : 'INACTIVO'}
        </span>
      </td>
      <td style="display:flex;gap:6px">
        <button class="btn-icon" title="Editar" onclick="editCategoria(${c.id_categoria})">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn-icon danger" title="Eliminar"
          onclick="confirmDelete('categoria', ${c.id_categoria}, '${c.nombre}')">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>`).join('');
}

// ── RESET FORMULARIO ──────────────────────────────────
function resetCategoriaForm() {
  document.getElementById('categoriaId').value = '';
  document.getElementById('categoriaNombre').value = '';
  document.getElementById('categoriaDescripcion').value = '';
  document.getElementById('categoriaEstadoGroup').style.display = 'none';
  document.getElementById('modalCategoriaTitle').textContent = 'Nueva Categoría';
  document.getElementById('alertCategoria').className = 'alert-msg';
}

// ── EDITAR ────────────────────────────────────────────
function editCategoria(id) {
  const c = dataCategorias.find(x => x.id_categoria === id);
  if (!c) return;
  document.getElementById('categoriaId').value = id;
  document.getElementById('categoriaNombre').value = c.nombre;
  document.getElementById('categoriaDescripcion').value = c.descripcion || '';
  document.getElementById('categoriaEstado').value = c.estado;
  document.getElementById('categoriaEstadoGroup').style.display = 'block';
  document.getElementById('modalCategoriaTitle').textContent = 'Editar Categoría';
  document.getElementById('alertCategoria').className = 'alert-msg';
  document.getElementById('modalCategoria').classList.add('open');
}

// ── GUARDAR ───────────────────────────────────────────
async function saveCategoria() {
  const id = document.getElementById('categoriaId').value;
  const nombre = document.getElementById('categoriaNombre').value.trim();
  const descripcion = document.getElementById('categoriaDescripcion').value.trim();
  const estado = document.getElementById('categoriaEstado').value;

  if (!nombre) { showAlert('alertCategoria', 'El nombre es requerido'); return; }
  try {
    if (id) {
      await api('PUT', `/api/categorias/${id}`, { nombre, descripcion, estado: Number(estado) });
    } else {
      await api('POST', '/api/categorias', { nombre, descripcion });
    }
    closeModal('modalCategoria');
    loadCategorias();
    // Actualizar select de categorías en productos si está cargado
    cargarCategoriasSelect();
  } catch (e) { showAlert('alertCategoria', e.message); }
}
