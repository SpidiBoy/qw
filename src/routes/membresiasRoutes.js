import { Router } from 'express';
import {
    getMembresias, getMembresiasStats, getMembresiasByCliente,
    createMembresia, updateMembresia
} from '../controllers/membresiasController.js';
import { verificarToken } from '../middlewares/verificarToken.js';

const router = Router();
router.use(verificarToken);

router.get('/',               getMembresias);
router.get('/stats',          getMembresiasStats);
router.get('/cliente/:id',    getMembresiasByCliente);
router.post('/',              createMembresia);
router.put('/:id',            updateMembresia);

export default router;
