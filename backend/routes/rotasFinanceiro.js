// --- No seu arquivo de rotas (ex: rotasFinanceiro.js) ---

// Define a rota GET para /api/financeiro/categorias
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

// Define a rota GET para /api/financeiro/contascaixa
router.get('/contascaixa', async (req, res) => {
    
    try {
        // 1. Monta a consulta SQL
        // Além do nome, é útil incluir o saldo atual
        // (Isso é um pouco mais complexo, pode precisar de um JOIN ou subquery,
        // mas por agora vamos pegar o saldo inicial que definimos no modelo)
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

// Define a rota POST para /api/financeiro/lancamento
router.post('/lancamento', async (req, res) => {
    
    // 1. Pega os dados do corpo (body) da requisição
    // (O frontend enviou isso do formulário)
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
        // Nota: Como é um lançamento manual JÁ PAGO,
        // o Status é 'PAGO' e DataVencimento = DataPagamento.
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
        // 'result.insertId' é comum para pegar o ID do novo item
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

// Define a rota GET para /api/financeiro/dashboard/resumo
router.get('/dashboard/resumo', async (req, res) => {
    
    // --- 1. Preparar Datas ---
    // Precisamos das datas de hoje, início do mês e fim do mês
    const hoje = new Date(); // Data de hoje
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

    // Formatar para o SQL (ex: '2025-11-08')
    const hojeSQL = hoje.toISOString().split('T')[0];
    const inicioMesSQL = inicioMes.toISOString().split('T')[0];
    const fimMesSQL = fimMes.toISOString().split('T')[0];

    try {
        // --- 2. Definir as Consultas SQL ---
        // (Usamos COALESCE(SUM(Valor), 0) para garantir que retorne 0 em vez de NULL se não houver lançamentos)

        // Saldo Atual: (Total Receitas PAGAS) - (Total Despesas PAGAS) de *todo o histórico*
        const querySaldoAtual = `
            SELECT 
                (SELECT COALESCE(SUM(Valor), 0) FROM Lancamentos WHERE Tipo = 'RECEITA' AND Status = 'PAGO') - 
                (SELECT COALESCE(SUM(Valor), 0) FROM Lancamentos WHERE Tipo = 'DESPESA' AND Status = 'PAGO') 
            AS SaldoAtualTotal
        `;

        // Entradas do Mês: Total de Receitas PAGAS este mês
        const queryEntradasMes = `
            SELECT COALESCE(SUM(Valor), 0) AS EntradasMes 
            FROM Lancamentos 
            WHERE Tipo = 'RECEITA' AND Status = 'PAGO' 
            AND DataPagamento BETWEEN ? AND ?
        `; // params: [inicioMesSQL, fimMesSQL]

        // Saídas do Mês: Total de Despesas PAGAS este mês
        const querySaidasMes = `
            SELECT COALESCE(SUM(Valor), 0) AS SaidasMes 
            FROM Lancamentos 
            WHERE Tipo = 'DESPESA' AND Status = 'PAGO' 
            AND DataPagamento BETWEEN ? AND ?
        `; // params: [inicioMesSQL, fimMesSQL]

        // Contas a Receber VENCIDAS: Total PENDENTE com vencimento ANTES de hoje
        const queryReceberVencido = `
            SELECT COALESCE(SUM(Valor), 0) AS ContasReceberVencido 
            FROM Lancamentos 
            WHERE Tipo = 'RECEITA' AND Status = 'PENDENTE' 
            AND DataVencimento < ?
        `; // params: [hojeSQL]

        // Contas a Pagar HOJE: Total PENDENTE (Despesa) com vencimento HOJE
        const queryPagarHoje = `
            SELECT COALESCE(SUM(Valor), 0) AS ContasPagarHoje 
            FROM Lancamentos 
            WHERE Tipo = 'DESPESA' AND Status = 'PENDENTE' 
            AND DataVencimento = ?
        `; // params: [hojeSQL]

        // --- 3. Executar Consultas em Paralelo ---
        // (Isso é muito mais eficiente do que fazer uma após a outra)
        const [
            [saldoResult],    // Pega o primeiro registro do resultado
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

        // --- 4. Montar o Objeto de Resposta ---
        const resumo = {
            SaldoAtualTotal: saldoResult.SaldoAtualTotal,
            EntradasMes: entradasResult.EntradasMes,
            SaidasMes: saidasResult.SaidasMes,
            ContasReceberVencido: vencidoResult.ContasReceberVencido,
            ContasPagarHoje: pagarHojeResult.ContasPagarHoje
        };

        // 5. Retornar o JSON
        res.status(200).json(resumo);

    } catch (error) {
        console.error("Erro ao buscar resumo do dashboard:", error);
        res.status(500).json({ message: "Erro interno ao buscar resumo." });
    }
});

// Define a rota GET para /api/financeiro/movimentocaixa
router.get('/movimentocaixa', async (req, res) => {
    
    // 1. Obter os filtros opcionais da query string (URL)
    const { data_inicio, data_fim, conta_id } = req.query;

    try {
        // 2. Montar a consulta SQL dinâmica
        let params = [];
        
        // A consulta base seleciona apenas lançamentos PAGOS
        // e junta o nome da Categoria e da Conta/Caixa
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

        // 3. Adicionar filtros dinamicamente
        
        // Filtro por Data
        if (data_inicio && data_fim) {
            sqlQuery += " AND l.DataPagamento BETWEEN ? AND ?";
            params.push(data_inicio, data_fim);
        }

        // Filtro por Conta/Caixa
        if (conta_id) {
            sqlQuery += " AND l.ContaCaixaID = ?";
            params.push(conta_id);
        }

        // 4. Adicionar ordenação (mais recentes primeiro)
        sqlQuery += " ORDER BY l.DataPagamento DESC";

        // 5. Executar a consulta
        const [movimentos] = await db.query(sqlQuery, params);

        // 6. Retornar a lista de movimentos
        res.status(200).json(movimentos);

    } catch (error) {
        console.error("Erro ao buscar movimento de caixa:", error);
        res.status(500).json({ message: "Erro interno ao buscar movimentos." });
    }
});

// Define a rota GET para /api/financeiro/contasareceber/resumo
router.get('/contasareceber/resumo', async (req, res) => {
    
    // 1. Preparar Data
    const hoje = new Date();
    const hojeSQL = hoje.toISOString().split('T')[0]; // Formato 'AAAA-MM-DD'

    try {
        // --- 2. Definir as Consultas SQL ---
        // (Sempre filtrando por Tipo = 'RECEITA' E Status = 'PENDENTE')

        // Total a Receber: A soma de TUDO que está pendente
        const queryTotalAReceber = `
            SELECT COALESCE(SUM(Valor), 0) AS TotalAReceber
            FROM Lancamentos
            WHERE Tipo = 'RECEITA' AND Status = 'PENDENTE'
        `;

        // Total Vencido: O que já passou da data de vencimento
        const queryTotalVencido = `
            SELECT COALESCE(SUM(Valor), 0) AS TotalVencido
            FROM Lancamentos
            WHERE Tipo = 'RECEITA' AND Status = 'PENDENTE'
              AND DataVencimento < ?
        `; // params: [hojeSQL]

        // A Receber Hoje: O que vence exatamente hoje
        const queryReceberHoje = `
            SELECT COALESCE(SUM(Valor), 0) AS ReceberHoje
            FROM Lancamentos
            WHERE Tipo = 'RECEITA' AND Status = 'PENDENTE'
              AND DataVencimento = ?
        `; // params: [hojeSQL]

        // --- 3. Executar Consultas em Paralelo ---
        const [
            [totalResult],
            [vencidoResult],
            [hojeResult]
        ] = await Promise.all([
            db.query(queryTotalAReceber),
            db.query(queryTotalVencido, [hojeSQL]),
            db.query(queryReceberHoje, [hojeSQL])
        ]);

        // --- 4. Montar o Objeto de Resposta ---
        const resumo = {
            TotalAReceber: totalResult.TotalAReceber,
            TotalVencido: vencidoResult.TotalVencido,
            ReceberHoje: hojeResult.ReceberHoje
        };

        // 5. Retornar o JSON
        res.status(200).json(resumo);

    } catch (error) {
        console.error("Erro ao buscar resumo de contas a receber:", error);
        res.status(500).json({ message: "Erro interno ao buscar resumo." });
    }
});

// Define a rota GET para /api/financeiro/contasareceber
router.get('/contasareceber', async (req, res) => {
    
    // 1. Obter os filtros opcionais da query string
    const { cliente_id, status, data_inicio, data_fim } = req.query;

    // Data de hoje para o filtro 'status'
    const hojeSQL = new Date().toISOString().split('T')[0];

    try {
        // 2. Montar a consulta SQL dinâmica
        let params = [];
        
        // Consulta base: seleciona receitas pendentes e junta o nome do cliente
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

        // 3. Adicionar filtros dinamicamente
        
        if (cliente_id) {
            sqlQuery += " AND l.ClienteID = ?";
            params.push(cliente_id);
        }

        // Filtro por Data de Vencimento
        if (data_inicio && data_fim) {
            sqlQuery += " AND l.DataVencimento BETWEEN ? AND ?";
            params.push(data_inicio, data_fim);
        }

        // Filtro por Status (Vencido / A Vencer)
        if (status === 'vencido') {
            sqlQuery += " AND l.DataVencimento < ?";
            params.push(hojeSQL);
        } else if (status === 'a_vencer') {
            sqlQuery += " AND l.DataVencimento >= ?";
            params.push(hojeSQL);
        }

        // 4. Adicionar ordenação (vencimentos mais antigos primeiro)
        sqlQuery += " ORDER BY l.DataVencimento ASC";

        // 5. Executar a consulta
        const [pendencias] = await db.query(sqlQuery, params);

        // 6. Retornar a lista de pendências
        res.status(200).json(pendencias);

    } catch (error) {
        console.error("Erro ao buscar contas a receber:", error);
        res.status(500).json({ message: "Erro interno ao buscar pendências." });
    }
});

// Define a rota POST para /api/financeiro/lancamento/{id}/baixar
// O {id} é o ID da DÍVIDA PENDENTE
router.post('/lancamento/:id/baixar', async (req, res) => {
    
    // Obter o ID da dívida pela URL
    const { id } = req.params; 
    
    // Obter os dados do pagamento (do modal)
    const { ValorRecebido, DataPagamento, ContaCaixaID } = req.body;

    // Iniciar a conexão/transação (a sintaxe exata varia)
    const connection = await db.beginTransaction(); 

    try {
        // --- 1. Buscar a Dívida Original ---
        const [dividaRows] = await connection.query(
            "SELECT * FROM Lancamentos WHERE id = ? AND Status = 'PENDENTE' AND Tipo = 'RECEITA' FOR UPDATE",
            [id]
        ); // "FOR UPDATE" bloqueia a linha, essencial para transações

        if (dividaRows.length === 0) {
            await connection.rollback(); // Desfaz a transação
            return res.status(404).json({ message: "Dívida não encontrada ou já paga." });
        }

        const dividaOriginal = dividaRows[0];
        const valorOriginal = parseFloat(dividaOriginal.Valor);
        const valorRecebidoFloat = parseFloat(ValorRecebido);

        // --- 2. Validação ---
        if (valorRecebidoFloat > valorOriginal) {
            await connection.rollback();
            return res.status(400).json({ message: "O valor recebido não pode ser maior que o valor da dívida." });
        }

        // --- 3. Lógica de Pagamento (Total ou Parcial) ---

        // Cenário 1: Pagamento TOTAL
        if (valorRecebidoFloat === valorOriginal) {
            
            // Apenas atualiza o lançamento original para PAGO
            const sqlUpdateTotal = `
                UPDATE Lancamentos
                SET Status = 'PAGO', DataPagamento = ?, ContaCaixaID = ?
                WHERE id = ?
            `;
            await connection.query(sqlUpdateTotal, [DataPagamento, ContaCaixaID, id]);

        } 
        // Cenário 2: Pagamento PARCIAL (Amortização)
        else { 
            
            // Passo A: Atualizar a dívida original, subtraindo o valor
            const novoValorPendente = valorOriginal - valorRecebidoFloat;
            const sqlUpdateParcial = `
                UPDATE Lancamentos
                SET Valor = ?, Descricao = CONCAT(Descricao, ' (Pagto Parcial)')
                WHERE id = ?
            `;
            await connection.query(sqlUpdateParcial, [novoValorPendente, id]);

            // Passo B: Criar um NOVO lançamento (PAGO) com o valor recebido
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
                DataPagamento, // DataVencimento = DataPagamento
                dividaOriginal.CategoriaID,
                ContaCaixaID,
                dividaOriginal.ClienteID,
                dividaOriginal.VendaID
            ]);
        }

        // --- 4. Sucesso! ---
        await connection.commit(); // Confirma todas as operações no banco
        res.status(200).json({ message: "Pagamento registrado com sucesso!" });

    } catch (error) {
        // --- 5. Falha! ---
        await connection.rollback(); // Desfaz tudo
        console.error("Erro ao dar baixa em pagamento:", error);
        res.status(500).json({ message: "Erro interno ao processar pagamento." });
    }
});

// Define a rota GET para /api/financeiro/relatorios/dre
router.get('/relatorios/dre', async (req, res) => {
    
    // 1. Obter os filtros de data
    const { data_inicio, data_fim } = req.query;

    if (!data_inicio || !data_fim) {
        return res.status(400).json({ message: "As datas de início e fim são obrigatórias." });
    }

    try {
        // --- 2. A Consulta SQL ---
        // Esta é a consulta principal:
        // 1. Busca lançamentos PAGOS no período.
        // 2. Agrupa por Categoria e Tipo (Receita/Despesa).
        // 3. Soma o total de cada grupo.
        
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

        // --- 3. Processar os resultados (transformar a lista do SQL em um DRE) ---
        
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

        // --- 4. Montar o JSON de resposta ---
        const dre = {
            TotalReceitas: TotalReceitas,
            TotalDespesas: TotalDespesas,
            LucroPrejuizo: LucroPrejuizo,
            Receitas: ReceitasDetalhadas, // A lista detalhada
            Despesas: DespesasDetalhadas   // A lista detalhada
        };

        res.status(200).json(dre);

    } catch (error) {
        console.error("Erro ao gerar DRE:", error);
        res.status(500).json({ message: "Erro interno ao gerar relatório." });
    }
});