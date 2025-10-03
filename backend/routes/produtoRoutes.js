// backend/routes/produtoRoutes.js
const express = require('express');
const router = express.Router();
const produtoController = require('../controllers/produtoController');

// Define as rotas para produtos
router.get('/produtos', produtoController.listarProdutos);

// --- CORREÇÃO: A ROTA ESPECÍFICA '/search' VEIO PARA CIMA ---
router.get('/produtos/search', produtoController.buscarProdutosPorNome);

router.get('/produtos/:id', produtoController.buscarProdutoPorId);
router.post('/produtos', produtoController.criarProduto);
router.put('/produtos/:id', produtoController.atualizarProduto);
router.delete('/produtos/:id', produtoController.removerProduto);

// A linha de console.log pode ser removida se quiser
console.log('✅ Ficheiro de rotas de PRODUTOS carregado e corrigido!');

module.exports = router;