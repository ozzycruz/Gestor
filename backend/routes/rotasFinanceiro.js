// backend/routes/rotasFinanceiro.js
const express = require('express'); // <<< ADICIONEI
const router = express.Router(); // <<< ADICIONEI
const { db } = require('../database/database'); // <<< ADICIONEI (Ajuste o caminho se necessário)

// --- No seu arquivo de rotas (ex: rotasFinanceiro.js) ---

// Define a rota GET para /categorias (o prefixo /api/financeiro virá do server.js)
router.get('/categorias', async (req, res) => {
    
    // Pega o filtro "tipo" da URL (query string)
    // Ex: /categorias?tipo=RECEITA
    const tipo = req.query.tipo; 

    try {
        // 1. Monta a consulta SQL básica
        let sqlQuery = "SELECT * FROM CategoriasFinanceiras";

        // 2. Prepara os parâmetros da consulta
        let params = [];

        // 3. Adiciona o filtro (WHERE) se ele foi fornecido
        if (tipo) {
            // Adiciona a cláusula WHERE para filtrar por 'RECEITA' ou 'DESPESA'
            sqlQuery += " WHERE Tipo = ?";
            params.push(tipo);
        }

        // 4. Executa a consulta no banco de dados
        // (Estou usando 'db.query' como um exemplo genérico)
        const [categorias] = await db.query(sqlQuery, params);

        // 5. Retorna a lista de categorias em formato JSON
        res.status(200).json(categorias);

    } catch (error) {
        // 6. Em caso de erro, informa o frontend
        console.error("Erro ao buscar categorias:", error);
        res.status(500).json({ message: "Erro interno ao buscar categorias." });
    }
});

// Define a rota GET para /contascaixa
router.get('/contascaixa', async (req, res) => {
    
    try {
        // 1. Monta a consulta SQL
        const sqlQuery = "SELECT id, Nome, SaldoInicial FROM ContasCaixa";

        // 2. Executa a consulta
        const [contas] = await db.query(sqlQuery);

        // 3. Retorna a lista de contas em formato JSON
        res.status(200).json(contas);

    } catch (error) {
        // 4. Em caso de erro
        console.error("Erro ao buscar contas/caixa:", error);
        res.status(500).json({ message: "Erro interno ao buscar contas." });
    }
});

// Define a rota POST para /lancamento
router.post('/lancamento', async (req, res) => {
    
    // 1. Pega os dados do corpo (body) da requisição
    const { 
        Descricao, 
        Valor, 
        Tipo, // 'RECEITA' ou 'DESPESA'
        DataPagamento, // Data que o usuário informou
        CategoriaID, 
        ContaCaixaID 
    } = req.body;

    // 2. Validação básica (essencial)
    if (!Descricao || !Valor || !Tipo || !DataPagamento || !CategoriaID || !ContaCaixaID) {
        return res.status(400).json({ message: "Todos os campos são obrigatórios." });
    }

    try {
        // 3. Monta a consulta SQL para INSERIR
        const sqlInsert = `
            INSERT INTO Lancamentos 
            (Descricao, Valor, Tipo, Status, DataPagamento, DataVencimento, CategoriaID, ContaCaixaID)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        // 4. Define os parâmetros
        const params = [
            Descricao,
            Valor,
            Tipo,
            'PAGO', // Lançamentos manuais já entram como pagos
            DataPagamento,
            DataPagamento, // DataVencimento = DataPagamento
            CategoriaID,
            ContaCaixaID
        ];

        // 5. Executa a inserção no banco
        const [result] = await db.query(sqlInsert, params);
        
        const novoLancamentoId = result.insertId;

        // 6. Retorna o novo lançamento criado (boa prática)
        res.status(201).json({ 
            id: novoLancamentoId, 
            Descricao, 
            Valor, 
            Status: 'PAGO' 
        });

    } catch (error) {
        // 7. Em caso de erro
        console.error("Erro ao criar lançamento:", error);
        res.status(500).json({ message: "Erro interno ao criar lançamento." });
    }
});

// Define a rota GET para /dashboard/resumo
router.get('/dashboard/resumo', async (req, res) => {
    
    const hoje = new Date(); // Data de hoje
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

    const hojeSQL = hoje.toISOString().split('T')[0];
    const inicioMesSQL = inicioMes.toISOString().split('T')[0];
    const fimMesSQL = fimMes.toISOString().split('T')[0];

    try {
        const querySaldoAtual = `
            SELECT 
                (SELECT COALESCE(SUM(Valor), 0) FROM Lancamentos WHERE Tipo = 'RECEITA' AND Status = 'PAGO') - 
                (SELECT COALESCE(SUM(Valor), 0) FROM Lancamentos WHERE Tipo = 'DESPESA' AND Status = 'PAGO') 
            AS SaldoAtualTotal
        `;
        const queryEntradasMes = `
            SELECT COALESCE(SUM(Valor), 0) AS EntradasMes 
            FROM Lancamentos 
            WHERE Tipo = 'RECEITA' AND Status = 'PAGO' 
            AND DataPagamento BETWEEN ? AND ?
        `; 
        const querySaidasMes = `
            SELECT COALESCE(SUM(Valor), 0) AS SaidasMes 
            FROM Lancamentos 
            WHERE Tipo = 'DESPESA' AND Status = 'PAGO' 
            AND DataPagamento BETWEEN ? AND ?
        `; 
        const queryReceberVencido = `
            SELECT COALESCE(SUM(Valor), 0) AS ContasReceberVencido 
            FROM Lancamentos 
            WHERE Tipo = 'RECEITA' AND Status = 'PENDENTE' 
            AND DataVencimento < ?
        `; 
        const queryPagarHoje = `
            SELECT COALESCE(SUM(Valor), 0) AS ContasPagarHoje 
            FROM Lancamentos 
            WHERE Tipo = 'DESPESA' AND Status = 'PENDENTE' 
            AND DataVencimento = ?
        `; 
        const [
            [saldoResult],    
            [entradasResult], 
            [saidasResult],   
            [vencidoResult],  
            [pagarHojeResult] 
        ] = await Promise.all([
            db.query(querySaldoAtual),
            db.query(queryEntradasMes, [inicioMesSQL, fimMesSQL]),
            db.query(querySaidasMes, [inicioMesSQL, fimMesSQL]),
            db.query(queryReceberVencido, [hojeSQL]),
            db.query(queryPagarHoje, [hojeSQL])
        ]);

        const resumo = {
            SaldoAtualTotal: saldoResult.SaldoAtualTotal,
            EntradasMes: entradasResult.EntradasMes,
            SaidasMes: saidasResult.SaidasMes,
            ContasReceberVencido: vencidoResult.ContasReceberVencido,
            ContasPagarHoje: pagarHojeResult.ContasPagarHoje
        };
        res.status(200).json(resumo);

    } catch (error) {
        console.error("Erro ao buscar resumo do dashboard:", error);
        res.status(500).json({ message: "Erro interno ao buscar resumo." });
    }
});

// Define a rota GET para /movimentocaixa
router.get('/movimentocaixa', async (req, res) => {
    
    const { data_inicio, data_fim, conta_id } = req.query;

    try {
        let params = [];
        let sqlQuery = `
            SELECT 
                l.id,
                l.Descricao,
                l.Valor,
                l.Tipo,
                l.DataPagamento,
                c.Nome AS CategoriaNome,
                cc.Nome AS ContaCaixaNome
            FROM Lancamentos l
            LEFT JOIN CategoriasFinanceiras c ON l.CategoriaID = c.id
            LEFT JOIN ContasCaixa cc ON l.ContaCaixaID = cc.id
            WHERE l.Status = 'PAGO'
        `;

        if (data_inicio && data_fim) {
            sqlQuery += " AND l.DataPagamento BETWEEN ? AND ?";
            params.push(data_inicio, data_fim);
        }
        if (conta_id) {
            sqlQuery += " AND l.ContaCaixaID = ?";
            params.push(conta_id);
        }
        sqlQuery += " ORDER BY l.DataPagamento DESC";
        const [movimentos] = await db.query(sqlQuery, params);
        res.status(200).json(movimentos);

    } catch (error) {
        console.error("Erro ao buscar movimento de caixa:", error);
        res.status(500).json({ message: "Erro interno ao buscar movimentos." });
    }
});

// Define a rota GET para /contasareceber/resumo
router.get('/contasareceber/resumo', async (req, res) => {
    
    const hoje = new Date();
    const hojeSQL = hoje.toISOString().split('T')[0]; 

    try {
        const queryTotalAReceber = `
            SELECT COALESCE(SUM(Valor), 0) AS TotalAReceber
            FROM Lancamentos
            WHERE Tipo = 'RECEITA' AND Status = 'PENDENTE'
        `;
        const queryTotalVencido = `
            SELECT COALESCE(SUM(Valor), 0) AS TotalVencido
            FROM Lancamentos
            WHERE Tipo = 'RECEITA' AND Status = 'PENDENTE'
              AND DataVencimento < ?
        `; 
        const queryReceberHoje = `
            SELECT COALESCE(SUM(Valor), 0) AS ReceberHoje
            FROM Lancamentos
            WHERE Tipo = 'RECEITA' AND Status = 'PENDENTE'
              AND DataVencimento = ?
        `; 
        const [
            [totalResult],
            [vencidoResult],
            [hojeResult]
        ] = await Promise.all([
            db.query(queryTotalAReceber),
            db.query(queryTotalVencido, [hojeSQL]),
            db.query(queryReceberHoje, [hojeSQL])
        ]);

        const resumo = {
            TotalAReceber: totalResult.TotalAReceber,
            TotalVencido: vencidoResult.TotalVencido,
            ReceberHoje: hojeResult.ReceberHoje
        };
        res.status(200).json(resumo);

    } catch (error) {
        console.error("Erro ao buscar resumo de contas a receber:", error);
        res.status(500).json({ message: "Erro interno ao buscar resumo." });
    }
});

// Define a rota GET para /contasareceber
router.get('/contasareceber', async (req, res) => {
    
    const { cliente_id, status, data_inicio, data_fim } = req.query;
    const hojeSQL = new Date().toISOString().split('T')[0];

    try {
        let params = [];
        let sqlQuery = `
            SELECT 
                l.id,
                l.Descricao,
                l.Valor,
                l.DataVencimento,
                l.VendaID,
                c.Nome AS ClienteNome
            FROM Lancamentos l
            LEFT JOIN Clientes c ON l.ClienteID = c.id
            WHERE l.Tipo = 'RECEITA' AND l.Status = 'PENDENTE'
        `;
        
        if (cliente_id) {
            sqlQuery += " AND l.ClienteID = ?";
            params.push(cliente_id);
        }
        if (data_inicio && data_fim) {
            sqlQuery += " AND l.DataVencimento BETWEEN ? AND ?";
            params.push(data_inicio, data_fim);
        }
        if (status === 'vencido') {
            sqlQuery += " AND l.DataVencimento < ?";
            params.push(hojeSQL);
        } else if (status === 'a_vencer') {
            sqlQuery += " AND l.DataVencimento >= ?";
            params.push(hojeSQL);
        }
        sqlQuery += " ORDER BY l.DataVencimento ASC";
        const [pendencias] = await db.query(sqlQuery, params);
        res.status(200).json(pendencias);

    } catch (error) {
        console.error("Erro ao buscar contas a receber:", error);
        res.status(500).json({ message: "Erro interno ao buscar pendências." });
    }
});

// Define a rota POST para /lancamento/{id}/baixar
router.post('/lancamento/:id/baixar', async (req, res) => {
    
    const { id } = req.params; 
    const { ValorRecebido, DataPagamento, ContaCaixaID } = req.body;
    const connection = await db.beginTransaction(); 

    try {
        const [dividaRows] = await connection.query(
            "SELECT * FROM Lancamentos WHERE id = ? AND Status = 'PENDENTE' AND Tipo = 'RECEITA' FOR UPDATE",
            [id]
        ); 

        if (dividaRows.length === 0) {
            await connection.rollback(); 
            return res.status(404).json({ message: "Dívida não encontrada ou já paga." });
        }

        const dividaOriginal = dividaRows[0];
        const valorOriginal = parseFloat(dividaOriginal.Valor);
        const valorRecebidoFloat = parseFloat(ValorRecebido);

        if (valorRecebidoFloat > valorOriginal) {
            await connection.rollback();
            return res.status(400).json({ message: "O valor recebido não pode ser maior que o valor da dívida." });
        }

        // Cenário 1: Pagamento TOTAL
        if (valorRecebidoFloat === valorOriginal) {
            const sqlUpdateTotal = `
                UPDATE Lancamentos
                SET Status = 'PAGO', DataPagamento = ?, ContaCaixaID = ?
                WHERE id = ?
            `;
            await connection.query(sqlUpdateTotal, [DataPagamento, ContaCaixaID, id]);

        } 
        // Cenário 2: Pagamento PARCIAL (Amortização)
        else { 
            const novoValorPendente = valorOriginal - valorRecebidoFloat;
            const sqlUpdateParcial = `
                UPDATE Lancamentos
                SET Valor = ?, Descricao = CONCAT(Descricao, ' (Pagto Parcial)')
                WHERE id = ?
            `;
            await connection.query(sqlUpdateParcial, [novoValorPendente, id]);

            const sqlInsertPago = `
                INSERT INTO Lancamentos
                (Descricao, Valor, Tipo, Status, DataPagamento, DataVencimento, 
                 CategoriaID, ContaCaixaID, ClienteID, VendaID)
                VALUES (?, ?, 'RECEITA', 'PAGO', ?, ?, ?, ?, ?, ?)
            `;
            await connection.query(sqlInsertPago, [
                `Pagto parcial ref. Lançamento #${id}`,
                valorRecebidoFloat,
                DataPagamento,
                DataPagamento, 
                dividaOriginal.CategoriaID,
                ContaCaixaID,
                dividaOriginal.ClienteID,
                dividaOriginal.VendaID
            ]);
        }

        await connection.commit(); 
        res.status(200).json({ message: "Pagamento registrado com sucesso!" });

    } catch (error) {
        await connection.rollback(); 
        console.error("Erro ao dar baixa em pagamento:", error);
        res.status(500).json({ message: "Erro interno ao processar pagamento." });
    }
});

// Define a rota GET para /relatorios/dre
router.get('/relatorios/dre', async (req, res) => {
    
    const { data_inicio, data_fim } = req.query;

    if (!data_inicio || !data_fim) {
        return res.status(400).json({ message: "As datas de início e fim são obrigatórias." });
    }

    try {
        const sqlQuery = `
            SELECT 
                c.Nome AS CategoriaNome,
                l.Tipo,
                COALESCE(SUM(l.Valor), 0) AS TotalPorCategoria
            FROM Lancamentos l
            JOIN CategoriasFinanceiras c ON l.CategoriaID = c.id
            WHERE 
                l.Status = 'PAGO'
                AND l.DataPagamento BETWEEN ? AND ?
            GROUP BY 
                l.CategoriaID, l.Tipo, c.Nome
            ORDER BY 
                l.Tipo, TotalPorCategoria DESC
        `;
        
        const [grupos] = await db.query(sqlQuery, [data_inicio, data_fim]);
        
        let TotalReceitas = 0;
        let TotalDespesas = 0;
        const ReceitasDetalhadas = [];
        const DespesasDetalhadas = [];

        for (const grupo of grupos) {
            const total = parseFloat(grupo.TotalPorCategoria);

            if (grupo.Tipo === 'RECEITA') {
                ReceitasDetalhadas.push({ categoria: grupo.CategoriaNome, total: total });
                TotalReceitas += total;
            } else if (grupo.Tipo === 'DESPESA') {
                DespesasDetalhadas.push({ categoria: grupo.CategoriaNome, total: total });
                TotalDespesas += total;
            }
        }

        const LucroPrejuizo = TotalReceitas - TotalDespesas;

        const dre = {
            TotalReceitas: TotalReceitas,
            TotalDespesas: TotalDespesas,
            LucroPrejuizo: LucroPrejuizo,
            Receitas: ReceitasDetalhadas, 
            Despesas: DespesasDetalhadas  
        };

        res.status(200).json(dre);

    } catch (error) {
        console.error("Erro ao gerar DRE:", error);
        res.status(500).json({ message: "Erro interno ao gerar relatório." });
    }
});


module.exports = router; // <<< ADICIONEI (A linha mais importante!)