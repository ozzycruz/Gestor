// public/js/relatorios.js

document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURAÇÃO ---
    const API_URL = 'http://localhost:3002/api';

    // --- ELEMENTOS DO DOM ---
    const formDRE = document.getElementById('form-relatorio-dre');
    const btnGerarDRE = document.getElementById('btn-gerar-dre');
    const inputDataInicio = document.getElementById('data-inicio');
    const inputDataFim = document.getElementById('data-fim');
    const areaRelatorio = document.getElementById('area-relatorio');
    const feedbackAlert = document.getElementById('feedback-alert');

    // --- FUNÇÕES AUXILIARES ---
    const formatCurrency = (value) => {
        const valor = parseFloat(value) || 0;
        return new Intl.NumberFormat('pt-BR', { 
            style: 'currency', 
            currency: 'BRL' 
        }).format(valor);
    };

    const showAlert = (message, isSuccess = true) => {
        if (!feedbackAlert) return;
        feedbackAlert.textContent = message;
        feedbackAlert.className = `feedback-alert p-4 mb-4 text-sm rounded-lg ${isSuccess ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`;
        feedbackAlert.style.display = 'block';
        setTimeout(() => { feedbackAlert.style.display = 'none'; }, 5000);
    };

    // --- FUNÇÃO PRINCIPAL: DESENHAR O DRE ---
    const desenharDRE = (dreData) => {
        const {
            TotalReceitas, TotalCMV, LucroBruto, TotalDespesas, LucroLiquido,
            Receitas: ReceitasDetalhadas, Despesas: DespesasDetalhadas
        } = dreData;

        // Limpa a área de "Por favor, selecione..."
        areaRelatorio.innerHTML = '';
        areaRelatorio.style.textAlign = 'left'; // Alinha o texto

        // 1. Cabeçalho
        const header = document.createElement('h2');
        header.className = "text-2xl font-bold text-gray-800 mb-4";
        header.textContent = `DRE de ${inputDataInicio.valueAsDate.toLocaleDateString('pt-BR')} a ${inputDataFim.valueAsDate.toLocaleDateString('pt-BR')}`;
        areaRelatorio.appendChild(header);

        // 2. Cria a estrutura do DRE
        let htmlDRE = '<div class="space-y-4">';

        // --- RECEITAS ---
        htmlDRE += `
            <div>
                <h3 class="text-xl font-semibold text-gray-700">(+) Receita Bruta Total</h3>
                <div class="pl-4 border-l-2 border-gray-200 mt-1">
        `;
        ReceitasDetalhadas.forEach(r => {
            htmlDRE += `<p class="text-sm text-gray-600">${r.categoria}: ${formatCurrency(r.total)}</p>`;
        });
        htmlDRE += `
                    <p class="font-bold text-gray-800 mt-1">Total Receitas: ${formatCurrency(TotalReceitas)}</p>
                </div>
            </div>
        `;

        // --- CUSTO (CMV) ---
        // (Graças ao seu trabalho no 'valor_custo', podemos ter esta secção!)
        htmlDRE += `
            <div>
                <h3 class="text-xl font-semibold text-gray-700">(-) Custo da Mercadoria Vendida (CMV)</h3>
                <div class="pl-4 border-l-2 border-gray-200 mt-1">
                    <p class="font-bold text-gray-800">Total CMV: ${formatCurrency(TotalCMV)}</p>
                </div>
            </div>
        `;

        // --- LUCRO BRUTO ---
        htmlDRE += `
            <div class="border-t pt-2">
                <h3 class="text-2xl font-bold text-blue-600">(=) Lucro Bruto: ${formatCurrency(LucroBruto)}</h3>
                <p class="text-sm text-gray-500">(Receita de Vendas - Custo dos Produtos)</p>
            </div>
        `;

        // --- DESPESAS ---
        htmlDRE += `
            <div>
                <h3 class="text-xl font-semibold text-gray-700 mt-4">(-) Despesas Operacionais</h3>
                <div class="pl-4 border-l-2 border-gray-200 mt-1">
        `;
        DespesasDetalhadas.forEach(d => {
            htmlDRE += `<p class="text-sm text-gray-600">${d.categoria}: ${formatCurrency(d.total)}</p>`;
        });
        htmlDRE += `
                    <p class="font-bold text-red-600 mt-1">Total Despesas: ${formatCurrency(TotalDespesas)}</p>
                </div>
            </div>
        `;
        
        // --- LUCRO LÍQUIDO ---
        const lucroClasse = LucroLiquido >= 0 ? 'text-green-600' : 'text-red-600';
        htmlDRE += `
            <div class="border-t-2 border-gray-800 pt-4 mt-6">
                <h3 class="text-3xl font-bold ${lucroClasse}">(=) Lucro Líquido: ${formatCurrency(LucroLiquido)}</h3>
                <p class="text-sm text-gray-500">(Lucro Bruto - Total Despesas)</p>
            </div>
        `;

        htmlDRE += '</div>';
        areaRelatorio.innerHTML = htmlDRE;
    };

    // --- EVENT LISTENER (Ouvir o clique) ---
    formDRE.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const dataInicio = inputDataInicio.value;
        const dataFim = inputDataFim.value;

        if (!dataInicio || !dataFim) {
            showAlert("Por favor, selecione a Data Início e a Data Fim.", false);
            return;
        }

        btnGerarDRE.disabled = true;
        btnGerarDRE.textContent = "A gerar...";
        areaRelatorio.innerHTML = '<p class="text-center text-gray-500">A carregar dados...</p>';

        try {
            // Chama a nossa API "inteligente"
            const response = await fetch(`${API_URL}/financeiro/relatorios/dre?data_inicio=${dataInicio}&data_fim=${dataFim}`);
            const dreData = await response.json();

            if (!response.ok) {
                throw new Error(dreData.message);
            }

            // Envia os dados para a função que "desenha" o DRE
            desenharDRE(dreData);

        } catch (err) {
            console.error("Erro ao gerar DRE:", err);
            showAlert(err.message, false);
            areaRelatorio.innerHTML = `<p class="text-center text-red-500">Erro ao gerar relatório: ${err.message}</p>`;
        } finally {
            btnGerarDRE.disabled = false;
            btnGerarDRE.textContent = "Gerar Relatório DRE";
        }
    });

    // --- INICIALIZAÇÃO ---
    // Define as datas padrão (Início do Mês até Hoje)
    const hoje = new Date();
    const inicioDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    
    inputDataInicio.value = inicioDoMes.toISOString().split('T')[0];
    inputDataFim.value = hoje.toISOString().split('T')[0];
});