// backend/routes/empresaRoutes.js
const express = require('express');
const router = express.Router();
const empresaController = require('../controllers/empresaController');

// Define a rota: GET /api/empresa
router.get('/empresa', empresaController.getEmpresa);

// Define a rota: PUT /api/empresa
router.put('/empresa', empresaController.updateEmpresa);

module.exports = router;