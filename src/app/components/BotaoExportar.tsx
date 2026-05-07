// src/components/BotaoExportar.tsx
"use client"; // Isso avisa o Next.js que esse código roda no navegador do usuário

export default function BotaoExportar({ dados, nomeArquivo }: { dados: any[], nomeArquivo: string }) {
  
  const exportarParaExcel = () => {
    if (!dados || dados.length === 0) {
      alert("Nenhum dado encontrado no período selecionado para exportar.");
      return;
    }

    // Pega os nomes das colunas baseadas nas chaves do primeiro objeto
    const colunas = Object.keys(dados[0]);
    let csv = colunas.join(";") + "\n";

    // Preenche as linhas
    dados.forEach(linha => {
      const valores = colunas.map(col => {
        let valor = linha[col];
        if (valor === null || valor === undefined) valor = "";
        
        // Remove quebras de linha e ponto-e-vírgula do texto para não quebrar as colunas do CSV
        if (typeof valor === 'string') {
          valor = valor.replace(/;/g, ',').replace(/\n/g, ' ');
        }
        return `"${valor}"`;
      });
      csv += valores.join(";") + "\n";
    });

    // O \uFEFF é o BOM do UTF-8, garante que o Excel leia os acentos (ç, ã, é) corretamente!
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    // Cria um link invisível e clica nele para forçar o download
    const link = document.createElement("a");
    link.href = url;
    const dataHoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    link.setAttribute("download", `SmartTouch_${nomeArquivo}_${dataHoje}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button onClick={exportarParaExcel} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700 transition shadow-sm flex items-center gap-2">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
      Baixar Relatório (Excel)
    </button>
  );
}