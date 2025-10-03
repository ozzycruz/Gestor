// backend/models/servicoModel.js
const { dbAll, dbRun, dbGet } = require('../database/database'); // <-- CORRIGIDO

const searchByName = (termo) => {
    const sql = `
        SELECT * FROM Servicos 
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
    return dbAll('SELECT * FROM Servicos ORDER BY nome');
};
const findById = (id) => {
    return dbGet('SELECT * FROM Servicos WHERE id = ?', [id]);
};

const create = (servico) => {
    const { nome, descricao, preco } = servico;
    return dbRun(
        'INSERT INTO Servicos (nome, descricao, preco) VALUES (?, ?, ?)',
        [nome, descricao, preco]
    );
};

const update = (id, servico) => {
    const { nome, descricao, preco } = servico;
    return dbRun(
        'UPDATE Servicos SET nome = ?, descricao = ?, preco = ? WHERE id = ?',
        [nome, descricao, preco, id]
    );
};

const remove = (id) => {
    return dbRun('DELETE FROM Servicos WHERE id = ?', [id]);
};

module.exports = {
    findAll,
    findById,
    create,
    update,
    remove,
    searchByName
};