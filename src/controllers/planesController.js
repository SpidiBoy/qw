import { pool } from '../config/bd.js';

// GET /api/planes
export const getPlanes = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id_plan, nombre, tipo_cliente, duracion_meses, precio,
                   permite_fraccion, dias_limite_fraccion, descripcion, activo, created_at
            FROM plan_membresia
            ORDER BY activo DESC, tipo_cliente, duracion_meses
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener planes' });
    }
};

// GET /api/planes/activos — solo activos (para selects)
export const getPlanesActivos = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id_plan, nombre, tipo_cliente, duracion_meses, precio,
                   permite_fraccion, dias_limite_fraccion, descripcion
            FROM plan_membresia
            WHERE activo = TRUE
            ORDER BY tipo_cliente, duracion_meses
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener planes activos' });
    }
};

// POST /api/planes
export const createPlan = async (req, res) => {
    const { nombre, tipo_cliente, duracion_meses, precio, permite_fraccion, dias_limite_fraccion, descripcion } = req.body;
    if (!nombre || !tipo_cliente || !duracion_meses || !precio)
        return res.status(400).json({ message: 'Nombre, tipo_cliente, duracion_meses y precio son requeridos' });

    const tiposValidos = ['nuevo', 'renovacion', 'interdiario'];
    if (!tiposValidos.includes(tipo_cliente))
        return res.status(400).json({ message: 'tipo_cliente inválido' });

    const fraccion = permite_fraccion ?? false;
    if (fraccion && Number(duracion_meses) < 3)
        return res.status(400).json({ message: 'El fraccionamiento solo aplica a planes de 3 meses o más' });

    try {
        const result = await pool.query(
            `INSERT INTO plan_membresia
             (nombre, tipo_cliente, duracion_meses, precio, permite_fraccion, dias_limite_fraccion, descripcion)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [nombre.trim(), tipo_cliente, Number(duracion_meses), Number(precio),
             fraccion, dias_limite_fraccion ?? 20, descripcion || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al crear plan' });
    }
};

// PUT /api/planes/:id
export const updatePlan = async (req, res) => {
    const { id } = req.params;
    const { nombre, tipo_cliente, duracion_meses, precio, permite_fraccion, dias_limite_fraccion, descripcion, activo } = req.body;

    const fraccion = permite_fraccion ?? false;
    if (fraccion && Number(duracion_meses) < 3)
        return res.status(400).json({ message: 'El fraccionamiento solo aplica a planes de 3 meses o más' });

    try {
        const result = await pool.query(
            `UPDATE plan_membresia SET
             nombre=$1, tipo_cliente=$2, duracion_meses=$3, precio=$4,
             permite_fraccion=$5, dias_limite_fraccion=$6, descripcion=$7, activo=$8
             WHERE id_plan=$9 RETURNING *`,
            [nombre, tipo_cliente, Number(duracion_meses), Number(precio),
             fraccion, dias_limite_fraccion ?? 20, descripcion || null, activo ?? true, id]
        );
        if (result.rowCount === 0) return res.status(404).json({ message: 'Plan no encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al actualizar plan' });
    }
};

// DELETE /api/planes/:id (soft: activo=false)
export const deletePlan = async (req, res) => {
    const { id } = req.params;
    try {
        // Verificar si tiene membresías activas
        const check = await pool.query(
            `SELECT COUNT(*) FROM membresia WHERE id_plan=$1 AND estado='activa'`, [id]
        );
        if (parseInt(check.rows[0].count) > 0)
            return res.status(409).json({ message: 'No se puede desactivar: hay membresías activas con este plan' });

        const result = await pool.query(
            `UPDATE plan_membresia SET activo=false WHERE id_plan=$1 RETURNING id_plan`, [id]
        );
        if (result.rowCount === 0) return res.status(404).json({ message: 'Plan no encontrado' });
        res.json({ message: 'Plan desactivado' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al desactivar plan' });
    }
};
