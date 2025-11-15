// public/js/gestao_produtos.js (Versão ATUALIZADA com Ordenação)

document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURAÇÃO ---
    const API_URL = 'http://localhost:3002/api';

    // --- ELEMENTOS DO DOM ---
    const tabelaProdutosBody = document.getElementById('tabela-produtos');
    const modal = document.getElementById('produto-modal');
    const modalTitle = document.getElementById('modal-title');
    const produtoForm = document.getElementById('produto-form');
    const btnNovoProduto = document.getElementById('btnNovoProduto');
    const btnCancelar = document.getElementById('btn-cancelar');
    const feedbackAlert = document.getElementById('feedback-alert');
    const inputId = document.getElementById('produto-id');
    const inputNome = document.getElementById('produto-nome');
    const inputDescricao = document.getElementById('produto-descricao');
    const inputEstoque = document.getElementById('produto-estoque');
    const inputPreco = document.getElementById('produto-preco');
    const inputCusto = document.getElementById('produto-custo');
    const inputBusca = document.getElementById('input-busca-produto');

    // --- NOVO: Seletores e Variáveis de Ordenação ---
    const headersTabela = document.querySelectorAll('#tabela-produtos-header th[data-sort]');
    let todosOsProdutos = [];
    let sortColumn = 'nome'; // Coluna padrão
    let sortDirection = 'asc'; // Direção padrão

    // --- FUNÇÕES AUXILIARES ---
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    // Função que converte "19,90" para 19.90 (número)
    const parseCurrency = (value) => {
        if (typeof value !== 'string') return value;
        return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
    };
    // Função que converte 19.9 para "19,90" (texto para input)
    const formatCurrencyForInput = (value) => {
        return (parseFloat(value) || 0).toFixed(2).replace('.', ',');
    };
    
    const showAlert = (message, isSuccess = true) => {
        feedbackAlert.textContent = message;
        feedbackAlert.className = `feedback-alert p-4 mb-4 text-sm rounded-lg ${isSuccess ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`;
        feedbackAlert.style.display = 'block';
        setTimeout(() => { feedbackAlert.style.display = 'none'; }, 4000);
    };
    
    // --- FUNÇÕES PRINCIPAIS (CRUD) ---
    
    // 1. Busca os dados da API
    const carregarProdutos = async () => {
        try {
            const response = await fetch(`${API_URL}/produtos`);
            if (!response.ok) throw new Error('Erro ao carregar produtos.');
            
            todosOsProdutos = await response.json();
            aplicarFiltroEOrdem(); // Chama a nova função central
        } catch (error) {
            showAlert(error.message, false);
        }
    };

    // 2. ATUALIZADO: Função central que filtra, ordena e desenha
    const aplicarFiltroEOrdem = () => {
        const termo = inputBusca.value.toLowerCase();

        // 2a. Filtra
        const produtosFiltrados = todosOsProdutos.filter(produto => 
            produto.nome.toLowerCase().includes(termo)
        );

        // 2b. Ordena (Lógica de ordenação dinâmica)
        produtosFiltrados.sort((a, b) => {
            let valA = a[sortColumn];
            let valB = b[sortColumn];

            // Trata números (estoque, preco)
            if (sortColumn === 'quantidade_em_estoque' || sortColumn === 'preco_unitario') {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
            } else { // Trata strings (nome)
                valA = (valA || '').toLowerCase();
                valB = (valB || '').toLowerCase();
            }

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        // 2c. Desenha
        desenharTabela(produtosFiltrados);
    };

// 3. A função de desenhar a tabela (ATUALIZADA)
    const desenharTabela = (produtosParaRenderizar) => {
        tabelaProdutosBody.innerHTML = '';
        if (produtosParaRenderizar.length === 0) {
            tabelaProdutosBody.innerHTML = `<tr><td colspan="5" class="text-center text-gray-500 py-4">Nenhum produto encontrado.</td></tr>`;
            return;
        }
        produtosParaRenderizar.forEach(produto => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${produto.nome}</div>
                    <div class="text-sm text-gray-500">${(produto.descricao || '').substring(0, 40)}...</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${produto.quantidade_em_estoque}</td>
                
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${formatCurrency(produto.valor_custo)}</td>
                
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${formatCurrency(produto.preco_unitario)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button data-action="editar-produto" data-produto-id="${produto.id}" class="text-indigo-600 hover:text-indigo-900 mr-3">Editar</button>
                    <button data-action="remover-produto" data-produto-id="${produto.id}" class="text-red-600 hover:text-red-900">Remover</button>
                </td>
            `;
            tabelaProdutosBody.appendChild(tr);
        });
    };

// --- Funções do Modal (ATUALIZADAS) ---
    
    const abrirModal = async (isEdit = false, produtoId = null) => {
        produtoForm.reset();
        inputId.value = '';
        if (isEdit && produtoId) {
            modalTitle.textContent = 'Editar Produto';
            try {
                // Usamos a lista local em vez de buscar na API
                const produto = todosOsProdutos.find(p => p.id === produtoId);
                if (!produto) throw new Error('Produto não encontrado na lista local.');
                
                inputId.value = produto.id;
                inputNome.value = produto.nome;
                inputDescricao.value = produto.descricao;
                inputEstoque.value = produto.quantidade_em_estoque;
                // ATUALIZADO: Popula o Custo e o Preço
                inputCusto.value = formatCurrencyForInput(produto.valor_custo);
                inputPreco.value = formatCurrencyForInput(produto.preco_unitario);
            } catch (error) {
                showAlert(error.message, false);
                return;
            }
        } else {
            modalTitle.textContent = 'Novo Produto';
        }
        // CORRIGIDO: Usa a classe nova para ABRIR
        modal.classList.remove('modal-oculto');
        setTimeout(() => { inputNome.focus(); }, 100);
    };

    // CORRIGIDO: Usa a classe nova para FECHAR
    const fecharModal = () => modal.classList.add('modal-oculto');

    const removerProduto = async (id) => {
        if (confirm('Tem a certeza que deseja remover este produto?')) {
            try {
                const response = await fetch(`${API_URL}/produtos/${id}`, { method: 'DELETE' });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message);
                showAlert(result.message);
                carregarProdutos(); // Recarrega a lista
            } catch (error) {
                showAlert(error.message, false);
            }
        }
    };

    // --- EVENT LISTENERS ---
    btnNovoProduto.addEventListener('click', () => abrirModal(false));
    btnCancelar.addEventListener('click', fecharModal);
    
// Listener do Formulário (ATUALIZADO)
    produtoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = inputId.value;
        
        // ATUALIZADO: Adiciona 'valor_custo'
        const produtoData = {
            nome: inputNome.value,
            descricao: inputDescricao.value,
            quantidade_em_estoque: parseInt(inputEstoque.value, 10),
            preco_unitario: parseCurrency(inputPreco.value),
            valor_custo: parseCurrency(inputCusto.value) // --- NOVO ---
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_URL}/produtos/${id}` : `${API_URL}/produtos`;

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(produtoData)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            
            showAlert(result.message);
            fecharModal();
            carregarProdutos(); // Recarrega a lista
        } catch (error) {
            showAlert(error.message, false);
        }
    });

    // Listener da Tabela (para Editar/Remover)
    tabelaProdutosBody.addEventListener('click', (e) => {
        const button = e.target.closest('[data-action]');
        if (!button) return;

        const action = button.dataset.action;
        const produtoId = button.dataset.produtoId;

        if (action === 'editar-produto') {
            abrirModal(true, parseInt(produtoId));
        }
        if (action === 'remover-produto') {
            removerProduto(parseInt(produtoId));
        }
    });

    // ATUALIZADO: Listener da Busca (agora só chama a função central)
    inputBusca.addEventListener('input', aplicarFiltroEOrdem);

    // --- NOVO: Listener para ORDENAÇÃO ---
    headersTabela.forEach(header => {
        header.addEventListener('click', () => {
            const newSortColumn = header.dataset.sort;
            
            // Se clicar na mesma coluna, inverte a direção
            if (sortColumn === newSortColumn) {
                sortDirection = (sortDirection === 'asc') ? 'desc' : 'asc';
            } else {
                // Se clicar numa nova coluna, define-a como padrão (asc)
                sortColumn = newSortColumn;
                sortDirection = 'asc';
            }
            
            // Atualiza as setas
            headersTabela.forEach(h => {
                const arrow = h.querySelector('.sort-arrow');
                if (h.dataset.sort === sortColumn) {
                    arrow.innerHTML = sortDirection === 'asc' ? ' ▲' : ' ▼';
                } else {
                    arrow.innerHTML = ''; // Limpa setas das outras colunas
                }
            });

            // Re-renderiza a tabela com a nova ordem
            aplicarFiltroEOrdem();
        });
    });

    // --- INICIALIZAÇÃO ---
    carregarProdutos();
});