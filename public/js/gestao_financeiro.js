// public/js/gestao_financeiro.js (Versão Completa e Corrigida)

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. REFERÊNCIAS AOS ELEMENTOS ---
    const btnAbrir = document.getElementById('btnAbrirModalDespesa');
    const btnFechar = document.getElementById('btnFecharModal');
    const modal = document.getElementById('modalDespesa');
    const formDespesa = document.getElementById('formDespesa');
    const selectCategorias = document.getElementById('despesaCategoria');
    const selectContas = document.getElementById('despesaConta');

    // Referências aos elementos do Dashboard
    const cardSaldo = document.getElementById('card-saldo');
    const cardEntradas = document.getElementById('card-entradas');
    const cardSaidas = document.getElementById('card-saidas');
    const cardVencido = document.getElementById('card-vencido');
    const tabelaCorpo = document.getElementById('tabela-movimentos-corpo');

    // --- 2. FUNÇÕES DE FORMATAÇÃO ---
    function formatarMoeda(valor) {
        return new Intl.NumberFormat('pt-BR', { 
            style: 'currency', 
            currency: 'BRL' 
        }).format(valor);
    }

    // --- 3. FUNÇÕES DE ATUALIZAÇÃO DO DASHBOARD ---

    // Função ÚNICA para atualizar TUDO
    async function atualizarDashboard() {
        console.log("A atualizar dashboard...");
        // Verifica se os elementos existem antes de tentar atualizar
        if (cardSaldo) {
            await atualizarCardsResumo();
        }
        if (tabelaCorpo) {
            await atualizarTabelaMovimentos();
        }
    }

    // Função para os CARDS
    async function atualizarCardsResumo() {
        try {
            const response = await fetch('http://localhost:3002/api/financeiro/dashboard/resumo');
            const resumo = await response.json();

            cardSaldo.textContent = formatarMoeda(resumo.SaldoAtualTotal);
            cardEntradas.textContent = formatarMoeda(resumo.EntradasMes);
            cardSaidas.textContent = formatarMoeda(resumo.SaidasMes);
            cardVencido.textContent = formatarMoeda(resumo.ContasReceberVencido);
            
            cardSaldo.classList.toggle('text-red-900', resumo.SaldoAtualTotal < 0);
            cardSaldo.classList.toggle('text-blue-900', resumo.SaldoAtualTotal >= 0);

        } catch (err) {
            console.error("Erro ao buscar resumo:", err);
            if (cardSaldo) cardSaldo.textContent = "Erro";
        }
    }

    // Função para a TABELA
    async function atualizarTabelaMovimentos() {
        try {
            const response = await fetch('http://localhost:3002/api/financeiro/movimentocaixa');
            const movimentos = await response.json();

            tabelaCorpo.innerHTML = ''; // Limpa a tabela

            if (movimentos.length === 0) {
                tabelaCorpo.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-gray-500">Nenhum movimento encontrado.</td></tr>';
                return;
            }

            movimentos.forEach(mov => {
                const valorClasse = mov.Tipo === 'DESPESA' ? 'valor-despesa' : 'valor-receita';
                const valorFormatado = formatarMoeda(mov.Valor);
                const dataFormatada = new Date(mov.DataPagamento).toLocaleDateString('pt-BR', {timeZone: 'UTC'});

                const linha = `
                    <tr>
                        <td class="p-3">${dataFormatada}</td>
                        <td class="p-3">${mov.Descricao}</td>
                        <td class="p-3">${mov.CategoriaNome || 'Sem Categoria'}</td>
                        <td class="p-3 text-right ${valorClasse}">${valorFormatado}</td>
                    </tr>
                `;
                tabelaCorpo.innerHTML += linha;
            });

        } catch (err) {
            console.error("Erro ao buscar movimentos:", err);
            tabelaCorpo.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-red-500">Erro ao carregar movimentos.</td></tr>';
        }
    }

    // --- 4. LÓGICA DO MODAL ---

    // Verifica se os botões existem antes de adicionar eventos
    if (btnAbrir && btnFechar && modal) {
        btnAbrir.addEventListener('click', () => {
            modal.classList.remove('modal-oculto');
            carregarCategorias(); // Carrega os dados para o modal
            carregarContas();     // Carrega os dados para o modal
            const dataInput = document.getElementById('despesaData');
            if(dataInput) dataInput.value = new Date().toISOString().split('T')[0];
        });
        btnFechar.addEventListener('click', () => {
            modal.classList.add('modal-oculto');
        });
    }

    // --- ESTAS SÃO AS FUNÇÕES QUE ESTAVAM A FALTAR ---

    async function carregarCategorias() {
        try {
            const response = await fetch('http://localhost:3002/api/financeiro/categorias?tipo=DESPESA');
            const categorias = await response.json();
            
            selectCategorias.innerHTML = '<option value="">Selecione...</option>'; 
            categorias.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.Nome;
                selectCategorias.appendChild(option);
            });
        } catch (err) {
            console.error('Erro ao carregar categorias:', err);
            selectCategorias.innerHTML = '<option value="">Erro ao carregar</option>';
        }
    }

    async function carregarContas() {
        try {
            const response = await fetch('http://localhost:3002/api/financeiro/contascaixa');
            const contas = await response.json();
            
            selectContas.innerHTML = '<option value="">Selecione...</option>';
            contas.forEach(conta => {
                const option = document.createElement('option');
                option.value = conta.id;
                option.textContent = conta.Nome;
                selectContas.appendChild(option);
            });
        } catch (err) {
            console.error('Erro ao carregar contas:', err);
            selectContas.innerHTML = '<option value="">Erro ao carregar</option>';
        }
    }

    // --- 5. EVENTO DE SUBMISSÃO ---
    if (formDespesa) {
        formDespesa.addEventListener('submit', async (e) => {
            e.preventDefault(); 

            const dadosDespesa = {
                Descricao: document.getElementById('despesaDescricao').value,
                Valor: parseFloat(document.getElementById('despesaValor').value),
                Tipo: 'DESPESA',
                DataPagamento: document.getElementById('despesaData').value,
                CategoriaID: parseInt(document.getElementById('despesaCategoria').value),
                ContaCaixaID: parseInt(document.getElementById('despesaConta').value)
            };

            try {
                const response = await fetch('http://localhost:3002/api/financeiro/lancamento', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dadosDespesa)
                });

                if (response.status === 201) {
                    alert('Despesa lançada com sucesso!');
                    formDespesa.reset(); 
                    modal.classList.add('modal-oculto'); 
                    await atualizarDashboard(); // Atualiza o dashboard
                } else {
                    const erro = await response.json();
                    alert(`Erro ao salvar: ${erro.message}`);
                }
            } catch (err) {
                console.error('Erro de rede ao salvar despesa:', err);
                alert('Erro de conexão. Verifique o console.');
            }
        });
    }

    // --- 6. CARREGAMENTO INICIAL ---
    // Chama a função principal quando a página (gestao_financeiro) carrega
    atualizarDashboard();
});