// public/js/gestao_vendas.js (Versão Final, Limpa e Corrigida)

document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURAÇÃO E VARIÁVEIS GLOBAIS ---
    const API_URL = 'http://localhost:3002/api';
    const TAXA_PARCELAMENTO = 0.05; // Taxa de 5%
    
    let listaClientes = [], listaProdutos = [], listaServicos = [];
    let listaFormasPagamento = [];
    let listaContasCaixa = [];
    
    let vendaAtual = {
        cliente_id: null,
        itens: [],
        total: 0,
        subtotal: 0,
        desconto_tipo: 'R$',
        desconto_valor: 0,
        FormaPagamentoID: null,
        ContaCaixaID: null,
        DataVencimento: null,
        numParcelas: 1 
    };

    let selectedItems = { cliente: null, produto: null, servico: null };
    let ultimaVendaSalva = null;

    // --- REFERÊNCIAS AOS ELEMENTOS DO DOM ---
    const btnAddProduto = document.getElementById('btn-add-produto');
    const btnAddServico = document.getElementById('btn-add-servico');
    const btnFinalizarVenda = document.getElementById('btn-finalizar-venda');
    const itensVendaContainer = document.getElementById('itens-venda-container');
    const carrinhoVazioMsg = document.getElementById('carrinho-vazio-msg');
    // const totalValorEl = document.getElementById('total-valor'); // Removido, pois é atualizado por renderizarItensVenda
    const vendaForm = document.getElementById('venda-form');
    const vendaConfirmacaoEl = document.getElementById('venda-confirmacao');
    const confirmacaoTextoEl = document.getElementById('confirmacao-texto');
    const btnNovaVenda = document.getElementById('btn-nova-venda');
    const btnImprimirRecibo = document.getElementById('btn-imprimir-recibo');
    const inputDescontoValor = document.getElementById('desconto-valor');
    const selectDescontoTipo = document.getElementById('desconto-tipo');
    const selectFormaPagamento = document.getElementById('select-forma-pagamento');
    const selectContaCaixa = document.getElementById('select-conta-caixa');
    const inputDataVencimento = document.getElementById('input-data-vencimento');
    const blocoContaCaixa = document.getElementById('bloco-conta-caixa');
    const blocoDataVencimento = document.getElementById('bloco-data-vencimento');
    const blocoParcelamento = document.getElementById('bloco-parcelamento');
    const selectNumParcelas = document.getElementById('select-num-parcelas');
    const infoTaxaParcela = document.getElementById('info-taxa-parcela');
    const valorTaxaEl = document.getElementById('valor-taxa');
    const totalParceladoEl = document.getElementById('total-parcelado');

    // --- LISTENERS DE DESCONTO ---
    inputDescontoValor.addEventListener('input', () => {
        vendaAtual.desconto_valor = parseFloat(inputDescontoValor.value) || 0;
        renderizarItensVenda(); 
    });
    selectDescontoTipo.addEventListener('change', () => {
        vendaAtual.desconto_tipo = selectDescontoTipo.value;
        renderizarItensVenda(); 
    });

    // --- FUNÇÕES AUXILIARES ---
    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    const showAlert = (message, isSuccess = true) => {
        const feedbackAlert = document.getElementById('feedback-alert');
        if (!feedbackAlert) return;
        feedbackAlert.textContent = message;
        feedbackAlert.className = `p-4 mb-4 text-sm rounded-lg ${isSuccess ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`;
        feedbackAlert.classList.remove('hidden');
        setTimeout(() => feedbackAlert.classList.add('hidden'), 5000);
    };

    // --- FUNÇÃO DE AUTOCOMPLETE (Corrigida) ---
    const setupAutocomplete = (inputId, resultsId, type) => {
        const input = document.getElementById(inputId);
        const results = document.getElementById(resultsId);
        let activeIndex = -1;

        const updateActiveItem = () => {
            const items = results.querySelectorAll('.autocomplete-item');
            items.forEach((item, index) => {
                if (index === activeIndex) {
                    item.classList.add('active');
                    item.scrollIntoView({ block: 'nearest' });
                } else {
                    item.classList.remove('active');
                }
            });
        };

        input.addEventListener('input', async () => {
            const query = input.value.toLowerCase();
            results.innerHTML = '';
            activeIndex = -1;
            selectedItems[type] = null;
            if (type === 'cliente') vendaAtual.cliente_id = null;
            
            if (!query) { // Busca com 1 dígito
                results.classList.add('hidden');
                return;
            }

            try {
                let searchEndpoint = '';
                if (type === 'produto') searchEndpoint = 'produtos';
                else if (type === 'cliente') searchEndpoint = 'clientes';
                else if (type === 'servico') searchEndpoint = 'servicos';

                const response = await fetch(`${API_URL}/${searchEndpoint}/search?q=${query}`);
                if (!response.ok) throw new Error('A resposta da rede não foi bem-sucedida.');
                
                const filteredItems = await response.json();

                results.classList.remove('hidden');
                if (filteredItems.length === 0) {
                    results.innerHTML = '<div class="autocomplete-item-none">Nenhum resultado encontrado.</div>';
                } else {
                    filteredItems.forEach((item) => {
                        const div = document.createElement('div');
                        div.className = 'autocomplete-item';
                        
                        if (type === 'cliente') {
                            div.textContent = item.nome;
                        } else {
                            const preco = item.preco_unitario || item.preco || 0;
                            const stock = item.quantidade_em_estoque;
                            if (type === 'produto') {
                                div.textContent = `${item.nome} | Stock: ${stock} | (${formatCurrency(preco)})`;
                            } else {
                                div.textContent = `${item.nome} (${formatCurrency(preco)})`;
                            }
                        }
                        
                        div.addEventListener('click', () => {
                            input.value = item.nome;
                            selectedItems[type] = item.id;
                            if (type === 'cliente') vendaAtual.cliente_id = item.id;
                            results.classList.add('hidden');
                        });
                        results.appendChild(div);
                    });
                }
            } catch (error) {
                console.error(`Erro ao buscar ${type}:`, error);
                results.innerHTML = `<div class="autocomplete-item-none">Erro na busca.</div>`;
            }
        });

        input.addEventListener('keydown', (e) => {
            const items = results.querySelectorAll('.autocomplete-item');
            if (results.classList.contains('hidden') || items.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeIndex = (activeIndex + 1) % items.length;
                updateActiveItem();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeIndex = (activeIndex - 1 + items.length) % items.length;
                updateActiveItem();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (activeIndex > -1) {
                    items[activeIndex].click();
                    if (type === 'produto') {
                        document.getElementById('input-produto-qtd').focus();
                    } else if (type === 'servico') {
                        document.getElementById('input-servico-qtd').focus();
                    }
                }
            } else if (e.key === 'Escape') {
                results.classList.add('hidden');
            }
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.autocomplete-container')) {
                results.classList.add('hidden');
            }
        });
    };
    
    // --- FUNÇÃO DE CARREGAMENTO DE DADOS (Corrigida) ---
    const popularDadosIniciais = async () => {
        try {
            // Busca tudo em paralelo
            const [clientesRes, formasRes, contasRes] = await Promise.all([
                fetch(`${API_URL}/clientes`),
                fetch(`${API_URL}/financeiro/formaspagamento`),
                fetch(`${API_URL}/financeiro/contascaixa`)
            ]);

            listaClientes = await clientesRes.json();
            listaFormasPagamento = await formasRes.json();
            listaContasCaixa = await contasRes.json();

            // Preenche Formas de Pagamento (a lógica correta)
            selectFormaPagamento.innerHTML = '<option value="">Selecione a forma...</option>';
            listaFormasPagamento.forEach(forma => {
                const option = document.createElement('option');
                option.value = forma.id;
                option.textContent = forma.Nome;
                option.dataset.tipo = forma.TipoLancamento;
                option.dataset.aceitaParcelas = forma.aceitaParcelas;
                option.dataset.maxParcelas = forma.maxParcelas;
                selectFormaPagamento.appendChild(option);
            });

            // Preenche Contas/Caixa
            selectContaCaixa.innerHTML = '<option value="">Selecione a conta...</option>';
            listaContasCaixa.forEach(conta => {
                const option = document.createElement('option');
                option.value = conta.id;
                option.textContent = conta.Nome;
                selectContaCaixa.appendChild(option);
            });

        } catch (error) {
            console.error("Erro ao carregar dados iniciais:", error);
            showAlert("Erro fatal ao carregar dados financeiros. Verifique o console.", false);
        }
    };

    // --- FUNÇÕES DE RENDERIZAÇÃO E CÁLCULO ---
    const renderizarItensVenda = () => {
        itensVendaContainer.innerHTML = '';
        let subtotal = 0;

        if (vendaAtual.itens.length === 0) {
            carrinhoVazioMsg.style.display = 'block';
        } else {
            carrinhoVazioMsg.style.display = 'none';
            vendaAtual.itens.forEach((item, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'flex justify-between items-center text-sm p-2 bg-gray-50 rounded';
                itemDiv.innerHTML = `
                    <div class="flex-grow">
                        <p class="font-semibold text-gray-800">${item.nome} <span class="text-xs text-gray-500">(${item.tipo})</span></p>
                        <p class="text-gray-600">${item.quantidade} x ${formatCurrency(item.precoUnitario)}</p>
                    </div>
                    <p class="font-semibold w-24 text-right">${formatCurrency(item.subtotal)}</p>
                    <button type="button" data-action="remover-item" data-index="${index}" class="ml-3 text-red-500 hover:text-red-700 font-bold">X</button>`;
                itensVenda