// src/app/page.tsx
import { PrismaClient } from "@prisma/client";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const prisma = new PrismaClient();

export default async function DashboardPage() {
  // BLOQUEIO DE SEGURANÇA: SE FOR TÉCNICO, EXPULSA PARA AS PENDÊNCIAS
  const cookieStore = await cookies();
  if (cookieStore.get("usuario_role")?.value === 'TECNICO') {
    redirect('/pendencias');
  }

  const materiais = await prisma.material.findMany();
  const estoqueCritico = materiais.filter(m => m.currentStock <= m.minStock).length;

  const totalVeiculos = await prisma.vehicle.count();
  const veiculosEmUso = await prisma.vehicleLog.count({ where: { endKm: null } });
  const veiculosDisponiveis = totalVeiculos - veiculosEmUso;

  // LÓGICA ATUALIZADA: Conta apenas quem DEVOLVEU o carro limpo (endKm não é nulo)
  const topTecnicosRaw = await prisma.vehicleLog.groupBy({
    by: ['userId'],
    where: { cleanState: 'Limpo', endKm: { not: null } }, 
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 5
  });
  
  const users = await prisma.user.findMany();
  const topTecnicos = topTecnicosRaw.map(t => ({
    nome: users.find(u => u.id === t.userId)?.name || 'Desconhecido',
    quantidade: t._count.id || 0
  }));

  const frotaMaisRodada = await prisma.vehicle.findMany({
    orderBy: { currentKm: 'desc' },
    take: 5
  });

  const hoje = new Date();
  const seteDiasAtras = new Date();
  seteDiasAtras.setDate(hoje.getDate() - 6);
  seteDiasAtras.setHours(0, 0, 0, 0);

  const transacoes7Dias = await prisma.transaction.findMany({
    where: { createdAt: { gte: seteDiasAtras }, type: 'SAIDA' }
  });

  const ultimos7Dias = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(seteDiasAtras);
    d.setDate(d.getDate() + i);
    const dataStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const count = transacoes7Dias
      .filter(t => new Date(t.createdAt).toDateString() === d.toDateString())
      .reduce((acc, curr) => acc + curr.quantity, 0);
    return { data: dataStr, count };
  });

  const maxCount = Math.max(...ultimos7Dias.map(d => d.count), 1); 

  return (
    <div className="p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Interativo</h1>
        <p className="text-gray-500 mt-1">Visão geral do Catálogo e Frota Smart Touch</p>
      </header>

      {/* GRID ATUALIZADO PARA 2 COLUNAS (Ficou mais elegante sem o card inútil) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        
        {/* BLOCO ESTOQUE CRÍTICO -> AGORA É UM LINK CLICÁVEL! */}
        <Link href="/materiais?critico=true" className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between transition-all hover:-translate-y-1 hover:shadow-md hover:border-red-200 cursor-pointer group">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-semibold text-gray-700 group-hover:text-red-600 transition-colors">Catálogo Crítico</h3>
            <span className={`text-xs px-2 py-1 rounded-full font-bold ${estoqueCritico > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              {estoqueCritico > 0 ? 'Alerta' : 'Estável'}
            </span>
          </div>
          <div>
            <p className="text-4xl font-bold text-gray-900 group-hover:text-red-600 transition-colors">{estoqueCritico}</p>
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
              Itens abaixo do mínimo 
              <span className="text-xs text-red-500 opacity-0 group-hover:opacity-100 transition-opacity font-medium hidden md:inline">→ Clique para ver</span>
            </p>
          </div>
        </Link>

        {/* Card: Status da Frota */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-semibold text-gray-700">Status da Frota</h3>
            <span className={`text-xs px-2 py-1 rounded-full font-bold ${veiculosDisponiveis > 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
              {veiculosDisponiveis > 0 ? 'Pátio Livre' : 'Falta Carro'}
            </span>
          </div>
          <div>
            <p className="text-4xl font-bold text-gray-900">{veiculosDisponiveis}<span className="text-xl text-gray-400 font-medium">/{totalVeiculos}</span></p>
            <p className="text-sm text-gray-500 mt-1">Veículos disponíveis na base</p>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GRÁFICO: Volume de Saídas */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2">
          <h3 className="font-bold text-gray-900 mb-6">Volume de Saídas (Últimos 7 dias)</h3>
          <div className="h-64 flex items-end justify-between gap-2 pt-4">
            {ultimos7Dias.map((dia, index) => {
              const alturaPercentual = Math.round((dia.count / maxCount) * 100);
              return (
                <div key={index} className="flex flex-col items-center flex-1 group">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold text-slate-700 mb-2">
                    {dia.count > 0 ? dia.count : ''}
                  </div>
                  <div className="w-full max-w-[40px] bg-blue-500 rounded-t-md transition-all duration-500 hover:bg-blue-600" style={{ height: `${dia.count === 0 ? 2 : alturaPercentual}%` }}></div>
                  <div className="text-xs text-gray-400 mt-3">{dia.data}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RANKINGS ESQUERDA */}
        <div className="flex flex-col gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex-1">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Top Organização (Devolveu Limpo)</h3>
            <div className="space-y-4">
              {topTecnicos.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Nenhum dado registrado.</p>
              ) : (
                topTecnicos.map((tec, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center font-bold text-xs border border-green-100">{idx + 1}º</div>
                      <span className="text-sm font-medium text-gray-800">{tec.nome}</span>
                    </div>
                    <span className="text-sm font-bold text-green-600">{tec.quantidade} <span className="text-xs text-gray-400 font-normal">registros</span></span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex-1">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Frota Mais Rodada</h3>
            <div className="space-y-4">
              {frotaMaisRodada.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Nenhum veículo cadastrado.</p>
              ) : (
                frotaMaisRodada.map((v, idx) => (
                  <div key={v.id} className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold text-gray-800">{v.model}</p>
                      <p className="text-xs text-gray-500">{v.plate}</p>
                    </div>
                    <span className="text-sm font-bold text-slate-700">{v.currentKm.toLocaleString('pt-BR')} <span className="text-xs text-gray-400 font-normal">km</span></span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}