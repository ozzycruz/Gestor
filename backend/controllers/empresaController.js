// backend/controllers/empresaController.js
const Empresa = require('../models/empresaModel');

/**
 * Lida com a requisição GET para buscar os dados da empresa.
 */
const getEmpresa = async (req, res) => {
    try {
        const empresa = await Empresa.find();
        if (empresa) {
            res.json(empresa);
        } else {
            // Isto só deve acontecer se a base de dados falhar ao semear
            res.status(404).json({ message: 'Dados da empresa não encontrados.' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar dados da empresa.', error: err.message });
    }
};

/**
 * Lida com a requisição PUT para atualizar os dados da empresa.
 */
const updateEmpresa = async (req, res) => {
    try {
        await Empresa.update(req.body);
        res.json({ message: 'Dados da empresa atualizados com sucesso.' });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao atualizar dados da empresa.', error: err.message });
    }
};

module.exports = {
    getEmpresa,
    updateEmpresa
};