// backend/models/clienteModel.js
const { dbAll, dbRun, dbGet } = require('../database/database');

// --- NOVA FUNÇÃO DE BUSCA ---
const searchByName = (termo) => {
    const sql = `
        SELECT * FROM Clientes
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
    // Esta nova consulta SQL usa uma sub-consulta (subquery) para
    // verificar se existe ALGUM lançamento VENCIDO para este cliente.
    const sql = `
        SELECT 
            c.*, 
            (EXISTS (
                SELECT 1 
                FROM Lancamentos l 
                WHERE l.ClienteID = c.id 
                  AND l.Status = 'PENDENTE' 
                  AND l.DataVencimento < DATE('now')
            )) AS temDebitoVencido
        FROM Clientes c
    `;
    return dbAll(sql);
};

const create = (cliente) => {
    const { nome, telefone, email, endereco } = cliente;
    return dbRun(
        'INSERT INTO Clientes (nome, telefone, email, endereco) VALUES (?, ?, ?, ?)',
        [nome, telefone, email, endereco]
    );
};

const update = (id, cliente) => {
    const { nome, telefone, email, endereco } = cliente;
    return dbRun(
        'UPDATE Clientes SET nome = ?, telefone = ?, email = ?, endereco = ? WHERE id = ?',
        [nome, telefone, email, endereco, id]
    );
};

// Ao remover um cliente, a base de dados está configurada para remover
// os seus veículos em cascata (ON DELETE CASCADE).
const remove = (id) => {
    return dbRun('DELETE FROM Clientes WHERE id = ?', [id]);
};

module.exports = {
    findAll,
    create,
    update,
    remove,
    searchByName // <-- Adicionar a nova função
};