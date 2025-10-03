// backend/routes/servicoRoutes.js
const express = require('express');
const router = express.Router();
const servicoController = require('../controllers/servicoController');

// Define as rotas para serviços
router.get('/servicos', servicoController.listarServicos);

// --- ROTAS ESPECÍFICAS PRIMEIRO ---
router.get('/servicos/search', servicoController.buscarServicosPorNome);

// --- ROTAS COM PARÂMETROS DEPOIS ---
router.get('/servicos/:id', servicoController.buscarServicoPorId);

router.post('/servicos', servicoController.criarServico);
router.put('/servicos/:id', servicoController.atualizarServico);
router.delete('/servicos/:id', servicoController.removerServico);

module.exports = router;