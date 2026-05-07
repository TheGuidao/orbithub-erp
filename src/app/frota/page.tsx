// src/app/frota/page.tsx
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import BotaoExportar from "../components/BotaoExportar";

const prisma = new PrismaClient();

export default async function FrotaPage(props: { searchParams: Promise<{ error?: string, inicio?: string, fim?: string, mes?: string, ano?: string, viewAssinatura?: string }> }) {
  const searchParams = await props.searchParams;
  const erroURL = searchParams?.error;
  const modalAssinaturaId = searchParams?.viewAssinatura ? parseInt(searchParams.viewAssinatura) : null;
  
  const dataInicioStr = searchParams?.inicio;
  const dataFimStr = searchParams?.fim;
  const mes = searchParams?.mes; 
  const ano = searchParams?.ano; 

  const veiculos = await prisma.vehicle.findMany({ orderBy: { model: 'asc' } });
  
  const equipe = await prisma.user.findMany({ 
    where: { active: true, username: { not: 'admin' } }, 
    orderBy: { name: 'asc' } 
  });
  
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

  const logs = await prisma.vehicleLog.findMany({
    where: whereData,
    orderBy: { date: 'desc' },
    include: { vehicle: true, user: true },
    take: 1000
  });

  // INTEGÊNCIA: Descobre quais carros estão na rua para esconder da lista de saída
  const carrosNaRuaIds = logs.filter(l => l.endKm === null).map(l => l.vehicleId);
  const veiculosDisponiveis = veiculos.filter(v => !carrosNaRuaIds.includes(v.id));

  let assinaturaModalData = null;
  if (modalAssinaturaId) {
    assinaturaModalData = await prisma.vehicleLog.findUnique({ 
      where: { id: modalAssinaturaId }, 
      include: { user: true, vehicle: true } 
    });
  }

  const dadosParaPlanilha = logs.map(log => ({
    "Data de Saída": new Date(log.date).toLocaleString('pt-BR'),
    "Veículo": `${log.vehicle.model} (${log.vehicle.plate})`,
    "Técnico / Motorista": log.user.name,
    "Status da Assinatura": log.assinatura ? 'Assinado' : 'Pendente de Assinatura',
    "KM Inicial": log.startKm,
    "KM Final": log.endKm || "Ainda na rua",
    "KM Rodados": log.endKm ? (log.endKm - log.startKm) : "Pendente",
    "Limpeza": log.cleanState,
    "Observações do Retorno": log.notes || ""
  }));

  async function registrarSaida(formData: FormData) { 
    "use server"; 
    const vehicleId = parseInt(formData.get("vehicleId") as string); 
    const userId = parseInt(formData.get("userId") as string); 
    const startKm = parseInt(formData.get("startKm") as string); 
    
    // TRAVA DE SEGURANÇA: Se der um jeito de burlar o select, o servidor barra
    const emUso = await prisma.vehicleLog.findFirst({ where: { vehicleId, endKm: null } });
    if (emUso) redirect(`/frota?error=veiculo_em_uso`);

    const veiculo = await prisma.vehicle.findUnique({ where: { id: vehicleId } }); 
    if (veiculo && startKm < veiculo.currentKm) redirect(`/frota?error=km_retroativo`); 
    
    // A limpeza agora é definida na DEVOLUÇÃO. Na saída fica como "Aguardando Retorno"
    await prisma.vehicleLog.create({ data: { vehicleId, userId, startKm, cleanState: "Aguardando Retorno", date: new Date() } }); 
    revalidatePath("/frota"); redirect("/frota"); 
  }
  
  async function registrarRetorno(formData: FormData) { 
    "use server"; 
    const logId = parseInt(formData.get("logId") as string); 
    const endKm = parseInt(formData.get("endKm") as string); 
    const cleanState = formData.get("cleanState") as string; // Agora a limpeza vem daqui!
    const notes = formData.get("notes") as string; 
    
    const log = await prisma.vehicleLog.findUnique({ where: { id: logId } }); 
    if (log) { 
      if (endKm < log.startKm) redirect(`/frota?error=km_final_invalido`); 
      await prisma.vehicleLog.update({ where: { id: logId }, data: { endKm, notes, cleanState } }); 
      await prisma.vehicle.update({ where: { id: log.vehicleId }, data: { currentKm: endKm } }); 
    } 
    revalidatePath("/frota"); revalidatePath("/veiculos"); revalidatePath("/"); redirect("/frota"); 
  }

  return (
    <div className="p-4 md:p-8 relative">

      {assinaturaModalData && assinaturaModalData.signatureData && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="font-bold text-xl text-gray-900 mb-1">Termo de Retirada (Frota)</h3>
            <p className="text-sm text-gray-500 mb-4 flex justify-between border-b pb-4">
              <span>Motorista: {assinaturaModalData.user?.name}</span>
              <span className="font-bold">{assinaturaModalData.vehicle.model} ({assinaturaModalData.vehicle.plate})</span>
            </p>
            <div className="border-2 border-gray-100 rounded-xl bg-gray-50 p-2 mb-6">
              <img src={assinaturaModalData.signatureData} alt="Assinatura do Técnico" className="w-full h-auto" />
            </div>
            <Link href="/frota" className="block text-center bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-lg font-bold transition">
              Fechar Janela
            </Link>
          </div>
        </div>
      )}

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Controle de Frota</h1>
        <p className="text-gray-500 mt-1">Check-in e Check-out dos veículos.</p>
      </header>

      {erroURL === "km_retroativo" && <div className="bg-red-100 text-red-700 px-4 py-3 rounded-lg mb-6 border border-red-400"><strong>Erro:</strong> KM de saída não pode ser menor que o atual.</div>}
      {erroURL === "km_final_invalido" && <div className="bg-red-100 text-red-700 px-4 py-3 rounded-lg mb-6 border border-red-400"><strong>Erro:</strong> O KM final não pode ser menor que o da saída.</div>}
      {erroURL === "veiculo_em_uso" && <div className="bg-red-100 text-red-700 px-4 py-3 rounded-lg mb-6 border border-red-400"><strong>Erro:</strong> Este veículo já está em uso na rua e precisa ser devolvido primeiro.</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <form action={registrarSaida} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold mb-4">Registrar Saída</h2>
            <div className="space-y-4">
               <select name="vehicleId" required className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                 <option value="">Veículo...</option>
                 {veiculosDisponiveis.map(v => (<option key={v.id} value={v.id}>{v.model} (Placa: {v.plate})</option>))}
                 {veiculosDisponiveis.length === 0 && <option value="" disabled>Nenhum veículo no pátio</option>}
               </select>
               <select name="userId" required className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                 <option value="">Técnico...</option>
                 {equipe.map(u => (<option key={u.id} value={u.id}>{u.name}</option>))}
               </select>
               <input type="number" name="startKm" required placeholder="KM no Painel" className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
               <button type="submit" className="w-full bg-blue-600 text-white font-bold p-2 rounded-lg mt-2 hover:bg-blue-700 transition">Confirmar Saída</button>
            </div>
          </form>
        </div>

        <div className="lg:col-span-2 flex flex-col">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 bg-gray-50/50">
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
                {(dataInicioStr || dataFimStr || mes || ano) && (
                  <Link href="/frota" className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">Limpar</Link>
                )}
              </div>
            </form>
            <div className="shrink-0 w-full xl:w-auto">
              <BotaoExportar dados={dadosParaPlanilha} nomeArquivo="Relatorio_Uso_Frota" />
            </div>
          </div>

          <div className="space-y-4 flex-1">
            {logs.length === 0 ? (
               <p className="text-gray-500 bg-white p-6 rounded-xl border border-gray-200 text-center">Nenhum registro encontrado neste período.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm transition hover:shadow-md">
                   <div className="flex justify-between items-center mb-2">
                     <span className="font-bold text-gray-900 text-lg">{log.vehicle.model} <span className="text-sm text-gray-500 font-normal">({log.vehicle.plate})</span></span>
                     
                     <div className="flex items-center gap-2">
                       {log.assinatura ? (
                         <Link href={`/frota?viewAssinatura=${log.id}`} className="text-[10px] px-2 py-1 rounded-full uppercase font-bold tracking-wider bg-green-100 text-green-700 hover:bg-green-200 transition cursor-pointer flex items-center gap-1 border border-green-200">
                           ✅ Assinado (Ver)
                         </Link>
                       ) : (
                         <span className="text-[10px] px-2 py-1 rounded-full uppercase font-bold tracking-wider bg-yellow-100 text-yellow-700 border border-yellow-200">
                           ⏳ Pendente
                         </span>
                       )}
                       <span className={`text-xs px-3 py-1 rounded-full font-bold ${log.endKm ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                         {log.endKm ? 'Finalizado' : 'Em Uso (Rua)'}
                       </span>
                     </div>
                   </div>
                   <p className="text-sm">Motorista: <span className="font-bold text-gray-800">{log.user.name}</span></p>
                   <p className="text-sm text-gray-500 mt-1">Data de Saída: {new Date(log.date).toLocaleString('pt-BR')} | KM Inicial: <strong>{log.startKm}</strong></p>
                   
                   {!log.endKm && (
                     <form action={registrarRetorno} className="mt-4 flex flex-wrap gap-2 border-t pt-4 border-gray-100">
                       <input type="hidden" name="logId" value={log.id} />
                       <input type="number" name="endKm" placeholder="KM Final" required className="border border-gray-300 p-2 rounded-lg text-sm w-32 outline-none focus:ring-2 focus:ring-blue-500" />
                       <select name="cleanState" required className="border border-gray-300 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="Limpo">Devolveu Limpo ✨</option>
                          <option value="Sujo">Devolveu Sujo ❌</option>
                       </select>
                       <input type="text" name="notes" placeholder="Observações (Opcional)" className="border border-gray-300 p-2 rounded-lg text-sm flex-1 outline-none focus:ring-2 focus:ring-blue-500" />
                       <button type="submit" className="bg-slate-900 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 transition">Devolver Veículo</button>
                     </form>
                   )}
                   {log.endKm && (
                     <div className="mt-3 bg-blue-50/50 p-3 rounded-lg border border-blue-100 flex justify-between items-center">
                       <p className="text-sm text-blue-900">
                         Retorno: <span className="font-bold text-lg">{log.endKm} KM</span> <span className="text-gray-500 ml-2">({log.endKm - log.startKm} km rodados)</span>
                         <span className={`ml-4 text-xs font-bold px-2 py-1 rounded uppercase ${log.cleanState === 'Limpo' ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>{log.cleanState}</span>
                       </p>
                       {log.notes && <p className="text-xs text-blue-700 italic border-l-2 border-blue-300 pl-2">"{log.notes}"</p>}
                     </div>
                   )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}