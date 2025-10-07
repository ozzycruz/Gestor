// backend/models/vendaModel.js (Final e Corrigido)
const { dbRun, dbGet } = require('../database/database');

const create = (vendaData) => {
    const { cliente_id, os_id, itens, total, desconto_tipo, desconto_valor } = vendaData;

    return new Promise(async (resolve, reject) => {
        await dbRun('BEGIN TRANSACTION');
        try {
            const vendaResult = await dbRun(
                'INSERT INTO Vendas (cliente_id, os_id, total, desconto_tipo, desconto_valor) VALUES (?, ?, ?, ?, ?)',
                [cliente_id, os_id, total, desconto_tipo, desconto_valor]
            );
            const vendaId = vendaResult.id;

            for (const item of itens) {
                if (item.tipo === 'produto') {
                    await dbRun(
                        'INSERT INTO Itens_Venda (venda_id, produto_id, quantidade, valor_unitario) VALUES (?, ?, ?, ?)',
                        [vendaId, item.id, item.quantidade, item.precoUnitario]
                    );
                    await dbRun(
                        'UPDATE Produtos SET quantidade_em_estoque = quantidade_em_estoque - ? WHERE id = ?',
                        [item.quantidade, item.id]
                    );
                } else if (item.tipo === 'serviço') {
                    // --- CORREÇÃO APLICADA AQUI ---
                    await dbRun(
                        'INSERT INTO Servicos_Venda (venda_id, servico_id, valor, quantidade) VALUES (?, ?, ?, ?)',
                        [vendaId, item.id, item.precoUnitario, item.quantidade]
                    );
                }
            }
            
            await dbRun('COMMIT');
            resolve(vendaResult);
        } catch (err) {
            await dbRun('ROLLBACK');
            reject(err);
        }
    });
};

module.exports = { create };