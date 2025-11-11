// backend/models/vendaModel.js (Versão Final com Taxa de 5%)
const { dbRun, dbGet } = require('../database/database');

const create = (vendaData) => {
    const { 
        cliente_id, os_id, itens, total, 
        desconto_tipo, desconto_valor,
        FormaPagamentoID, ContaCaixaID, DataVencimento,
        numParcelas 
    } = vendaData;

    return new Promise(async (resolve, reject) => {
        let connection; // Vamos usar uma conexão explícita para transações
        try {
            // A sua biblioteca (node-sqlite3) não suporta transações fáceis
            // no objeto 'db' partilhado. Vamos usar o dbRun para isto.
            await dbRun('BEGIN TRANSACTION');

            const vendaResult = await dbRun(
                'INSERT INTO Vendas (cliente_id, os_id, total, desconto_tipo, desconto_valor, FormaPagamentoID, DataVencimento) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [cliente_id, os_id, total, desconto_tipo, desconto_valor, FormaPagamentoID, DataVencimento]
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
                    await dbRun(
                        'INSERT INTO Servicos_Venda (venda_id, servico_id, valor, quantidade) VALUES (?, ?, ?, ?)',
                        [vendaId, item.id, item.precoUnitario, item.quantidade]
                    );
                }
            }
            
            // --- LÓGICA DE LANÇAMENTO FINANCEIRO (COM TAXA) ---
            const formaPag = await dbGet('SELECT * FROM FormasPagamento WHERE id = ?', [FormaPagamentoID]);
            if (!formaPag) throw new Error('Forma de Pagamento inválida.');

            const hoje = new Date();
            const hojeSQL = hoje.toISOString().split('T')[0];
            const categoriaIdVenda = itens.some(item => item.tipo === 'produto') ? 1 : 2; // 1=Produto, 2=Serviço

            // --- CENÁRIO 1: Pagamento "Fiado" (A_PRAZO) ---
            if (formaPag.TipoLancamento === 'A_PRAZO') {
                const lancamento = {
                    Descricao: `Venda de Balcão #${vendaId}`, Valor: total, Tipo: 'RECEITA',
                    Status: 'PENDENTE', DataVencimento: DataVencimento, DataPagamento: null,
                    ClienteID: cliente_id, VendaID: vendaId, FormaPagamentoID: FormaPagamentoID,
                    CategoriaID: categoriaIdVenda, ContaCaixaID: null
                };
                await dbRun(
                    `INSERT INTO Lancamentos (Descricao, Valor, Tipo, Status, DataVencimento, DataPagamento, ClienteID, VendaID, FormaPagamentoID, CategoriaID, ContaCaixaID) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    Object.values(lancamento)
                );
            } 
            // --- CENÁRIO 2: Pagamento "À Vista" (A_VISTA) ---
            else {
                // Se for parcelado (ex: 3x) E for A_VISTA (Cartão de Crédito)
                if (numParcelas && numParcelas > 1 && formaPag.aceitaParcelas === 1) {
                    
                    const TAXA_PARCELAMENTO = 0.05; // 5%
                    const valorTaxa = parseFloat((total * TAXA_PARCELAMENTO).toFixed(2));
                    const valorLiquido = total - valorTaxa;
                    const valorParcela = parseFloat((valorLiquido / numParcelas).toFixed(2));
                    const valorUltimaParcela = valorLiquido - (valorParcela * (numParcelas - 1));

                    // 1. LANÇAR A DESPESA DA TAXA (IMEDIATA)
                    // (Vamos assumir que a Categoria "Taxas de Cartão" tem o ID 10, ajuste se for diferente)
                    const categoriaTaxa = await dbGet("SELECT id FROM CategoriasFinanceiras WHERE Nome = 'Taxas de Cartão'");
                    const categoriaTaxaId = categoriaTaxa ? categoriaTaxa.id : null; // Devemos ter uma categoria "Outras Despesas" como fallback
                    
                    const lancamentoTaxa = {
                        Descricao: `Taxa Cartão Venda #${vendaId}`, Valor: valorTaxa, Tipo: 'DESPESA',
                        Status: 'PAGO', DataVencimento: hojeSQL, DataPagamento: hojeSQL,
                        ClienteID: null, VendaID: vendaId, FormaPagamentoID: FormaPagamentoID,
                        CategoriaID: categoriaTaxaId, ContaCaixaID: ContaCaixaID // Sai da conta da máquina
                    };
                    await dbRun(
                        `INSERT INTO Lancamentos (Descricao, Valor, Tipo, Status, DataVencimento, DataPagamento, ClienteID, VendaID, FormaPagamentoID, CategoriaID, ContaCaixaID) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        Object.values(lancamentoTaxa)
                    );

                    // 2. LANÇAR AS PARCELAS (PENDENTES)
                    for (let i = 1; i <= numParcelas; i++) {
                        const dataVencParcela = new Date(hoje);
                        dataVencParcela.setMonth(hoje.getMonth() + i); 
                        
                        const lancamentoParcela = {
                            Descricao: `Parcela ${i}/${numParcelas} - Venda #${vendaId}`,
                            Valor: (i === numParcelas) ? valorUltimaParcela : valorParcela,
                            Tipo: 'RECEITA', Status: 'PENDENTE', 
                            DataVencimento: dataVencParcela.toISOString().split('T')[0],
                            DataPagamento: null,
                            ClienteID: cliente_id, VendaID: vendaId, FormaPagamentoID: FormaPagamentoID,
                            CategoriaID: categoriaIdVenda, ContaCaixaID: ContaCaixaID 
                        };
                        await dbRun(
                            `INSERT INTO Lancamentos (Descricao, Valor, Tipo, Status, DataVencimento, DataPagamento, ClienteID, VendaID, FormaPagamentoID, CategoriaID, ContaCaixaID) 
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            Object.values(lancamentoParcela)
                        );
                    }
                }
                // Se for A_VISTA e 1x (Pix, Dinheiro, ou Crédito 1x)
                else {
                    // (Aqui não há taxa, porque já está embutida no preço, como você disse)
                    const lancamento = {
                        Descricao: `Venda de Balcão #${vendaId}`, Valor: total, Tipo: 'RECEITA',
                        Status: 'PAGO', DataVencimento: hojeSQL, DataPagamento: hojeSQL,
                        ClienteID: cliente_id, VendaID: vendaId, FormaPagamentoID: FormaPagamentoID,
                        CategoriaID: categoriaIdVenda, ContaCaixaID: ContaCaixaID
                    };
                    await dbRun(
                        `INSERT INTO Lancamentos (Descricao, Valor, Tipo, Status, DataVencimento, DataPagamento, ClienteID, VendaID, FormaPagamentoID, CategoriaID, ContaCaixaID) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        Object.values(lancamento)
                    );
                }
            }
            // --- FIM DA LÓGICA DE LANÇAMENTO ---

            await dbRun('COMMIT');
            resolve(vendaResult);

        } catch (err) {
            await dbRun('ROLLBACK');
            console.error('Erro na transação de venda:', err.message);
            reject(err);
        }
    });
};

module.exports = { create };