// src/app/page.tsx
import { PrismaClient } from "@prisma/client";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const prisma = new PrismaClient();

export default async function DashboardPage() {
  // --- TRAVA DE SEGURANÇA ---
  const cookieStore = await cookies();
  const cargoDoUsuario = cookieStore.get("usuario_role")?.value;

  // Se for Técnico, chuta ele direto para as pendências dele
  if (cargoDoUsuario === "TECNICO") {
    redirect("/obras");
  }
  // --------------------------

  // 1. Cálculos de Datas (Fuso Horário do Brasil)
  const agora = new Date(new Date().getTime() - 3 * 60 * 60 * 1000);
  const dataHojeStr = agora.toISOString().split('T')[0];
  const primeiroDiaMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

  // 2. Busca simultânea de todos os dados cruciais (Performance máxima)
  const [todasObras, materiais, veiculos] = await Promise.all([
    prisma.serviceOrder.findMany({ include: { team: true }, orderBy: { date: 'asc' } }),
    prisma.material.findMany({ orderBy: { name: 'asc' } }),
    prisma.vehicle.findMany()
  ]);

  // 3. Filtrando os dados para o Dashboard
  const obrasHoje = todasObras.filter(o => o.date && o.date.toISOString().split('T')[0] === dataHojeStr);
  const obrasPendentes = todasObras.filter(o => o.status !== 'CONCLUIDO');
  const obrasConcluidasMes = todasObras.filter(o => o.status === 'CONCLUIDO' && new Date(o.updatedAt) >= primeiroDiaMes);
  
  // Lógica inteligente: Material com estoque igual ou menor que o mínimo configurado
  const alertasEstoque = materiais.filter(m => m.currentStock <= m.minStock);

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-[calc(100vh-60px)]">
      <div className="max-w-7xl mx-auto">
        
        {/* CABEÇALHO DO PAINEL */}
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Visão Geral</h1>
            <p className="text-slate-500 mt-1">Bem-vindo ao centro de comando da <span className="font-bold text-slate-700">Smart Touch</span>.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/obras?nova=true" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-blue-700 transition shadow-sm">
              + Nova Obra
            </Link>
          </div>
        </header>

        {/* CARDS DE MÉTRICAS RÁPIDAS (KPIs) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-l-4 border-l-blue-500 flex flex-col justify-between hover:shadow-md transition">
            <div className="flex justify-between items-start">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Obras Hoje</h3>
              <span className="text-2xl">📅</span>
            </div>
            <div className="mt-4">
              <p className="text-4xl font-black text-slate-800">{obrasHoje.length}</p>
              <p className="text-xs text-blue-600 font-bold mt-1">Agendadas para hoje</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-l-4 border-l-red-500 flex flex-col justify-between hover:shadow-md transition">
            <div className="flex justify-between items-start">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Alerta de Estoque</h3>
              <span className="text-2xl">⚠️</span>
            </div>
            <div className="mt-4">
              <p className="text-4xl font-black text-slate-800">{alertasEstoque.length}</p>
              <p className="text-xs text-red-500 font-bold mt-1">Itens no limite mínimo</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-l-4 border-l-yellow-500 flex flex-col justify-between hover:shadow-md transition">
            <div className="flex justify-between items-start">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Em Andamento</h3>
              <span className="text-2xl">🚧</span>
            </div>
            <div className="mt-4">
              <p className="text-4xl font-black text-slate-800">{obrasPendentes.length}</p>
              <p className="text-xs text-yellow-600 font-bold mt-1">Serviços ativos no quadro</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-l-4 border-l-green-500 flex flex-col justify-between hover:shadow-md transition">
            <div className="flex justify-between items-start">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Concluídas no Mês</h3>
              <span className="text-2xl">✅</span>
            </div>
            <div className="mt-4">
              <p className="text-4xl font-black text-slate-800">{obrasConcluidasMes.length}</p>
              <p className="text-xs text-green-600 font-bold mt-1">Sucesso operacional</p>
            </div>
          </div>
        </div>

        {/* ÁREA INFERIOR */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[400px]">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h2 className="font-bold text-slate-800">📌 Agenda de Hoje</h2>
              <Link href="/obras" className="text-xs font-bold text-blue-600 hover:text-blue-800">Ver Quadro Completo ➔</Link>
            </div>
            <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
              {obrasHoje.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <span className="text-4xl mb-3">🏖️</span>
                  <p className="text-sm font-medium">Nenhuma obra agendada para hoje.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {obrasHoje.map(obra => (
                    <Link key={obra.id} href={`/obras/detalhes/${obra.id}`} className="block bg-white border border-slate-200 p-4 rounded-xl hover:border-blue-300 hover:shadow-sm transition group">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-slate-800 group-hover:text-blue-600 transition">{obra.title}</h3>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${
                          obra.status === 'AGENDADO' ? 'bg-yellow-100 text-yellow-700' :
                          obra.status === 'EM_ANDAMENTO' ? 'bg-blue-100 text-blue-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {obra.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mb-3 truncate">📍 {obra.address || "Endereço não informado"}</p>
                      <div className="flex flex-wrap gap-1">
                        {obra.team.map(t => (
                          <span key={t.id} className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{t.name}</span>
                        ))}
                        {obra.team.length === 0 && <span className="text-[10px] italic text-slate-400">Sem equipe alocada</span>}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[400px]">
            <div className="p-5 border-b border-slate-100 bg-red-50/30 flex justify-between items-center">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <span className="text-red-500">🔴</span> Precisam de Reposição
              </h2>
              <Link href="/materiais" className="text-xs font-bold text-blue-600 hover:text-blue-800">Ver Estoque ➔</Link>
            </div>
            <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
              {alertasEstoque.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <span className="text-4xl mb-3">📦</span>
                  <p className="text-sm font-medium">Estoque saudável. Nada em falta!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alertasEstoque.map(mat => (
                    <div key={mat.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{mat.name}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">{mat.category}</p>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className={`text-lg font-black ${mat.currentStock === 0 ? 'text-red-600' : 'text-orange-500'}`}>
                          {mat.currentStock} und
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">Mínimo ideal: {mat.minStock}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}