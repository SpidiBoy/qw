import { pool } from '../config/bd.js';

// GET /api/membresias
export const getMembresias = async (req, res) => {
    try {
        const { estado, id_plan, asesor } = req.query;

        let where = ['c.deleted_at IS NULL'];
        let params = [];
        let i = 1;

        if (estado && estado !== 'todos') {
            where.push(`m.estado = $${i++}`);
            params.push(estado);
        }
        if (id_plan && id_plan !== 'todos') {
            where.push(`m.id_plan = $${i++}`);
            params.push(Number(id_plan));
        }
        if (asesor && asesor !== 'todos') {
            where.push(`u.id_usuario = $${i++}`);
            params.push(Number(asesor));
        }

        const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

        const result = await pool.query(`
            SELECT
                m.id_membresia,
                m.id_cliente,
                c.nombre || ' ' || c.apellido AS nombre_cliente,
                c.dni, c.telefono,
                p.id_plan, p.nombre AS nombre_plan, p.tipo_cliente,
                p.duracion_meses, p.permite_fraccion, p.dias_limite_fraccion,
                m.fecha_inicio, m.fecha_fin,
                m.tipo_ingreso, m.estado,
                m.monto_total, m.saldo_pendiente,
                m.observaciones,
                u.id_usuario AS id_asesor,
                COALESCE(u.alias_asesor, u.nombre) AS asesor,
                m.created_at
            FROM membresia m
            JOIN cliente c ON c.id_cliente = m.id_cliente
            JOIN plan_membresia p ON p.id_plan = m.id_plan
            JOIN usuarios u ON u.id_usuario = m.id_usuario_reg
            ${whereClause}
            ORDER BY m.created_at DESC
        `, params);

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener membresías' });
    }
};

// GET /api/membresias/stats — contadores para el header
export const getMembresiasStats = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                COUNT(*) FILTER (WHERE m.estado = 'activa') AS activas,
                COUNT(*) FILTER (WHERE m.estado = 'vencida') AS vencidas,
                COUNT(*) FILTER (WHERE DATE_TRUNC('month', m.created_at) = DATE_TRUNC('month', NOW())) AS este_mes
            FROM membresia m
            JOIN cliente c ON c.id_cliente = m.id_cliente
            WHERE c.deleted_at IS NULL
        `);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener estadísticas' });
    }
};

// GET /api/membresias/cliente/:id — membresías de un cliente
export const getMembresiasByCliente = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`
            SELECT
                m.id_membresia, m.fecha_inicio, m.fecha_fin,
                m.tipo_ingreso, m.estado, m.monto_total, m.saldo_pendiente,
                p.nombre AS nombre_plan, p.duracion_meses,
                COALESCE(u.alias_asesor, u.nombre) AS asesor
            FROM membresia m
            JOIN plan_membresia p ON p.id_plan = m.id_plan
            JOIN usuarios u ON u.id_usuario = m.id_usuario_reg
            WHERE m.id_cliente = $1
            ORDER BY m.created_at DESC
        `, [id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener membresías del cliente' });
    }
};

// POST /api/membresias
export const createMembresia = async (req, res) => {
    const {
        id_cliente, id_plan, fecha_inicio,
        monto_total, saldo_pendiente,
        metodo_pago, observaciones, id_asesor
    } = req.body;

    if (!id_cliente || !id_plan || !fecha_inicio || !monto_total || !metodo_pago)
        return res.status(400).json({ message: 'Faltan campos requeridos' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verificar membresía activa existente
        const activa = await client.query(
            `SELECT id_membresia FROM membresia
             WHERE id_cliente=$1 AND estado='activa'`, [id_cliente]
        );
        if (activa.rows.length > 0)
            return res.status(409).json({ message: 'El cliente ya tiene una membresía activa' });

        // Obtener plan
        const planRes = await client.query(
            `SELECT * FROM plan_membresia WHERE id_plan=$1 AND activo=TRUE`, [id_plan]
        );
        if (!planRes.rows.length)
            return res.status(404).json({ message: 'Plan no encontrado o inactivo' });

        const plan = planRes.rows[0];

        // Calcular fecha_fin
        const fInicio = new Date(fecha_inicio);
        const fFin = new Date(fInicio);
        fFin.setMonth(fFin.getMonth() + plan.duracion_meses);
        const fechaFin = fFin.toISOString().split('T')[0];

        // Determinar tipo_ingreso: verificar si tiene historial
        const historial = await client.query(
            `SELECT COUNT(*) FROM membresia WHERE id_cliente=$1`, [id_cliente]
        );
        const tipo_ingreso = parseInt(historial.rows[0].count) === 0 ? 'nuevo' : 'renovacion';

        // El id_usuario_reg es el asesor seleccionado (o el usuario logueado si no se especifica)
        const idUsuarioReg = id_asesor || req.usuario.id;
        const saldo = saldo_pendiente ?? 0;

        // Crear membresía
        const membRes = await client.query(
            `INSERT INTO membresia
             (id_cliente, id_plan, id_usuario_reg, fecha_inicio, fecha_fin,
              tipo_ingreso, estado, monto_total, saldo_pendiente, observaciones)
             VALUES ($1,$2,$3,$4,$5,$6,'activa',$7,$8,$9) RETURNING *`,
            [id_cliente, id_plan, idUsuarioReg, fecha_inicio, fechaFin,
             tipo_ingreso, Number(monto_total), Number(saldo), observaciones || null]
        );

        const membresia = membRes.rows[0];

        // Generar número de comprobante único
        const numComp = `MEM-${Date.now()}`;
        const montoPagado = Number(monto_total) - Number(saldo);

        // Registrar pago si hay monto pagado
        if (montoPagado > 0) {
            const fechaLimite = saldo > 0
                ? (() => {
                    const fl = new Date(fecha_inicio);
                    fl.setDate(fl.getDate() + plan.dias_limite_fraccion);
                    return fl.toISOString().split('T')[0];
                  })()
                : null;

            await client.query(
                `INSERT INTO pago
                 (id_membresia, id_usuario_reg, num_cuota, monto, fecha_pago,
                  fecha_limite, metodo_pago, num_comprobante, estado_cuota)
                 VALUES ($1,$2,1,$3,CURRENT_DATE,$4,$5,$6,'pagado')`,
                [membresia.id_membresia, idUsuarioReg, montoPagado,
                 fechaLimite, metodo_pago, numComp]
            );

            // Si hay saldo, registrar cuota pendiente
            if (saldo > 0) {
                const numComp2 = `MEM-${Date.now()}-2`;
                const fl2 = new Date(fecha_inicio);
                fl2.setDate(fl2.getDate() + plan.dias_limite_fraccion);
                await client.query(
                    `INSERT INTO pago
                     (id_membresia, id_usuario_reg, num_cuota, monto, fecha_pago,
                      fecha_limite, metodo_pago, num_comprobante, estado_cuota)
                     VALUES ($1,$2,2,$3,CURRENT_DATE,$4,$5,$6,'pendiente')`,
                    [membresia.id_membresia, idUsuarioReg, saldo,
                     fl2.toISOString().split('T')[0], metodo_pago, numComp2]
                );
            }
        }

        await client.query('COMMIT');
        res.status(201).json(membresia);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: err.message || 'Error al crear membresía' });
    } finally {
        client.release();
    }
};

// PUT /api/membresias/:id — actualizar estado u observaciones
export const updateMembresia = async (req, res) => {
    const { id } = req.params;
    const { estado, observaciones, saldo_pendiente } = req.body;
    try {
        const sets = [];
        const params = [];
        let i = 1;
        if (estado !== undefined) { sets.push(`estado=$${i++}`); params.push(estado); }
        if (observaciones !== undefined) { sets.push(`observaciones=$${i++}`); params.push(observaciones); }
        if (saldo_pendiente !== undefined) { sets.push(`saldo_pendiente=$${i++}`); params.push(Number(saldo_pendiente)); }
        if (!sets.length) return res.status(400).json({ message: 'Nada que actualizar' });
        params.push(id);
        const result = await pool.query(
            `UPDATE membresia SET ${sets.join(',')} WHERE id_membresia=$${i} RETURNING *`,
            params
        );
        if (result.rowCount === 0) return res.status(404).json({ message: 'Membresía no encontrada' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al actualizar membresía' });
    }
};
