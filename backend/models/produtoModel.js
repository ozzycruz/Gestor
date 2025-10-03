// backend/models/produtoModel.js
const { dbAll, dbGet, dbRun } = require('../database/database');

// --- FUNÇÃO DE BUSCA COM LIKE ---
const searchByName = (termo) => {
    const sql = `
        SELECT * FROM Produtos 
        WHERE nome LIKE ? 
        ORDER BY 
            CASE 
                WHEN nome LIKE ? THEN 1
                ELSE 2 
            END, 
            nome
    `;
    const params = [`%${termo}%`, `${termo}%`];
    return dbAll(sql, params);
};

const findAll = () => {
    return dbAll('SELECT * FROM Produtos ORDER BY nome');
};

const findById = (id) => {
    return dbGet('SELECT * FROM Produtos WHERE id = ?', [id]);
};

// ... (resto das funções criar, atualizar, remover ficam iguais) ...

const create = (produto) => {
    const { nome, descricao, quantidade_em_estoque, preco_unitario } = produto;
    return dbRun(
        'INSERT INTO Produtos (nome, descricao, quantidade_em_estoque, preco_unitario) VALUES (?, ?, ?, ?)',
        [nome, descricao, quantidade_em_estoque, preco_unitario]
    );
};

const update = (id, produto) => {
    const { nome, descricao, quantidade_em_estoque, preco_unitario } = produto;
    return dbRun(
        'UPDATE Produtos SET nome = ?, descricao = ?, quantidade_em_estoque = ?, preco_unitario = ? WHERE id = ?',
        [nome, descricao, quantidade_em_estoque, preco_unitario, id]
    );
};

const remove = (id) => {
    return dbRun('DELETE FROM Produtos WHERE id = ?', [id]);
};

module.exports = {
    findAll,
    findById,
    create,
    update,
    remove,
    searchByName // <-- EXPORTAR A NOVA FUNÇÃO
};