// src/app/manutencao/page.tsx
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import BotaoExportar from "../components/BotaoExportar";

const prisma = new PrismaClient();

export default async function ManutencaoPage(props: { searchParams: Promise<{ inicio?: string, fim?: string, mes?: string, ano?: string }> }) {
  const searchParams = await props.searchParams;
  
  const dataInicioStr = searchParams?.inicio;
  const dataFimStr = searchParams?.fim;
  const mes = searchParams?.mes; 
  const ano = searchParams?.ano; 

  const veiculos = await prisma.vehicle.findMany({
    orderBy: { model: 'asc' },
    include: { maintenances: { orderBy: { date: 'desc' } } }
  });

  // MOTOR DE FILTRO
  let dataInicioDb, dataFimDb;

  if (ano) {
    dataInicioDb = new Date(`${ano}-01-01T00:00:00`);
    dataFimDb = new Date(`${ano}-12-31T23:59:59`);
  } else if (mes) {
    const [anoStr, mesStr] = mes.split('-');
    dataInicioDb = new Date(parseInt(anoStr), parseInt(mesStr) - 1, 1);
    dataFimDb = new Date(parseInt(anoStr), parseInt(mesStr), 0, 23, 59, 59);
  } else if (dataInicioStr || dataFimStr) {
    if (dataInicioStr) dataInicioDb = new Date(dataInicioStr + "T00:00:00");
    if (dataFimStr) dataFimDb = new Date(dataFimStr + "T23:59:59");
  }

  const whereData: any = {};
  if (dataInicioDb || dataFimDb) {
    whereData.date = {};
    if (dataInicioDb) whereData.date.gte = dataInicioDb;
    if (dataFimDb) whereData.date.lte = dataFimDb;
  }

  const historico = await prisma.vehicleMaintenance.findMany({
    where: whereData,
    orderBy: { date: 'desc' },
    include: { vehicle: true },
    take: 1000
  });

  // PREPARANDO DADOS PARA A PLANILHA DE GASTOS
  const dadosParaPlanilha = historico.map(h => ({
    "Data": new Date(h.date).toLocaleDateString('pt-BR'),
    "Veículo": `${h.vehicle.model} (${h.vehicle.plate})`,
    "Serviço Realizado": h.type,
    "Descrição Detalhada": h.description || "",
    "KM no Painel": h.performedKm,
    "Custo Total (R$)": h.cost ? h.cost.toFixed(2).replace('.', ',') : "0,00"
  }));

  const alertas = veiculos.map(v => {
    const comPrevisao = v.maintenances.find(m => m.nextRevisionKm !== null);
    if (comPrevisao && comPrevisao.nextRevisionKm) {
      const faltaParaRevisao = comPrevisao.nextRevisionKm - v.currentKm;
      if (faltaParaRevisao <= 0) return { ...v, status: "VENCIDA", aviso: `Passou ${Math.abs(faltaParaRevisao)} KM do limite!` };
      if (faltaParaRevisao <= 1000) return { ...v, status: "ATENÇÃO", aviso: `Faltam apenas ${faltaParaRevisao} KM` };
    }
    return null;
  }).filter(v => v !== null);

  async function registrarManutencao(formData: FormData) {
    "use server";
    const vehicleId = parseInt(formData.get("vehicleId") as string);
    const type = formData.get("type") as string;
    const performedKm = parseInt(formData.get("performedKm") as string);
    const nextRevisionKmString = formData.get("nextRevisionKm") as string;
    const nextRevisionKm = nextRevisionKmString ? parseInt(nextRevisionKmString) : null;
    const description = formData.get("description") as string;
    const costString = formData.get("cost") as string;
    const cost = costString ? parseFloat(costString.replace(',', '.')) : null;

    await prisma.vehicleMaintenance.create({
      data: { vehicleId, type, performedKm, nextRevisionKm, description, cost, date: new Date() }
    });

    const veiculo = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (veiculo && performedKm > veiculo.currentKm) {
      await prisma.vehicle.update({ where: { id: vehicleId }, data: { currentKm: performedKm } });
    }

    revalidatePath("/manutencao"); revalidatePath("/veiculos");
  }

  return (
    <div className="p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Oficina e Manutenção</h1>
        <p className="text-gray-500 mt-1">Controle de revisões, trocas de óleo e custos da frota.</p>
      </header>

      {alertas.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8">
          <h2 className="text-red-800 font-bold flex items-center gap-2 mb-3">⚠️ Alertas de Revisão</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {alertas.map((alerta: any) => (
              <div key={alerta.id} className="bg-white p-3 rounded-lg border border-red-100 shadow-sm flex justify-between items-center">
                <div>
                  <p className="font-bold text-gray-900">{alerta.model} <span className="text-xs text-gray-500 font-normal">({alerta.plate})</span></p>
                  <p className="text-sm text-red-600 font-medium">{alerta.aviso}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full text-white font-bold ${alerta.status === 'VENCIDA' ? 'bg-red-600' : 'bg-orange-500'}`}>
                  {alerta.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <form action={registrarManutencao} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
        <h2 className="text-xl font-bold mb-4 text-gray-900">Registrar Novo Serviço</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Veículo</label>
            <select name="vehicleId" required className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Selecione...</option>
              {veiculos.map(v => (<option key={v.id} value={v.id}>{v.model} (KM: {v.currentKm})</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo de Serviço</label>
            <select name="type" required className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
              <option value="Troca de Óleo e Filtros">Troca de Óleo</option>
              <option value="Revisão Geral">Revisão Geral</option>
              <option value="Pneus e Alinhamento">Pneus / Alinhamento</option>
              <option value="Freios">Freios</option>
              <option value="Corretiva (Quebra)">Corretiva (Quebra)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">KM no Painel</label>
            <input type="number" name="performedKm" required placeholder="KM Atual" className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Avisar próxima no KM:</label>
            <input type="number" name="nextRevisionKm" placeholder="Opcional" className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Descrição</label>
            <input type="text" name="description" placeholder="O que foi feito..." className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Custo (R$)</label>
            <input type="number" step="0.01" name="cost" placeholder="Ex: 350.50" className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" className="w-full bg-slate-900 text-white font-bold p-2 rounded-lg hover:bg-slate-800 transition">Salvar Ficha</button>
        </div>
      </form>

      {/* FILTROS E EXPORTAÇÃO DA OFICINA */}
      <div className="bg-white p-5 rounded-t-xl border border-gray-200 border-b-0 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 bg-gray-50/50">
        <form method="GET" className="flex flex-wrap items-end gap-4 w-full">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Período</label>
            <div className="flex gap-2">
              <input type="date" name="inicio" defaultValue={dataInicioStr} className="border border-gray-300 p-2 rounded-lg text-sm outline-none" />
              <input type="date" name="fim" defaultValue={dataFimStr} className="border border-gray-300 p-2 rounded-lg text-sm outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Mês</label>
            <input type="month" name="mes" defaultValue={mes} className="border border-gray-300 p-2 rounded-lg text-sm outline-none" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700">Filtrar</button>
            <a href="/manutencao" className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">Limpar</a>
          </div>
        </form>
        <div className="shrink-0 w-full xl:w-auto">
          <BotaoExportar dados={dadosParaPlanilha} nomeArquivo="Relatorio_Custos_Oficina" />
        </div>
      </div>

      <div className="bg-white rounded-b-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Data</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Veículo</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Serviço</th>
              <th className="px-6 py-3 text-center font-medium text-gray-500 uppercase tracking-wider">KM Feito</th>
              <th className="px-6 py-3 text-center font-medium text-gray-500 uppercase tracking-wider">Custo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {historico.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">Nenhum serviço registrado neste período.</td></tr>
            ) : (
              historico.map((h) => (
                <tr key={h.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">{new Date(h.date).toLocaleDateString('pt-BR')}</td>
                  <td className="px-6 py-4 font-bold text-gray-900">{h.vehicle.model}</td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-800 block">{h.type}</span>
                    <span className="text-xs text-gray-500">{h.description}</span>
                  </td>
                  <td className="px-6 py-4 text-center font-semibold bg-gray-50">{h.performedKm}</td>
                  <td className="px-6 py-4 text-center text-red-600 font-bold">
                    {h.cost ? `R$ ${h.cost.toFixed(2)}` : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}