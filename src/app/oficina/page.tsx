// src/app/oficina/page.tsx
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";

const prisma = new PrismaClient();

export default async function OficinaPage(props: { searchParams: Promise<{ error?: string, veiculo?: string }> }) {
  const searchParams = await props.searchParams;
  const erroURL = searchParams?.error;
  const filtroVeiculo = searchParams?.veiculo;

  const veiculos = await prisma.vehicle.findMany({ orderBy: { model: 'asc' } });
  
  const query: any = {};
  if (filtroVeiculo) query.vehicleId = parseInt(filtroVeiculo);

  const manutencoes = await prisma.vehicleMaintenance.findMany({
    where: query,
    orderBy: { date: 'desc' },
    include: { vehicle: true },
    take: 50
  });

  async function registrarManutencao(formData: FormData) {
    "use server";
    const vehicleId = parseInt(formData.get("vehicleId") as string);
    const type = formData.get("type") as string;
    const performedKm = parseInt(formData.get("performedKm") as string);
    const nextRevisionKm = formData.get("nextRevisionKm") ? parseInt(formData.get("nextRevisionKm") as string) : null;
    const description = formData.get("description") as string;
    const cost = formData.get("cost") ? parseFloat(formData.get("cost") as string) : 0;

    await prisma.vehicleMaintenance.create({
      data: { vehicleId, type, performedKm, nextRevisionKm, description, cost }
    });

    // Atualiza o KM atual do veículo para o KM da manutenção se for maior
    const v = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (v && performedKm > v.currentKm) {
      await prisma.vehicle.update({ where: { id: vehicleId }, data: { currentKm: performedKm } });
    }

    revalidatePath("/oficina");
    redirect("/oficina");
  }

  return (
    <div className="p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Oficina & Manutenção</h1>
        <p className="text-gray-500 mt-1">Controle de revisões e gastos da frota Smart Touch.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* FORMULÁRIO DE REGISTRO */}
        <div className="lg:col-span-1">
          <form action={registrarManutencao} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold mb-4 text-orange-600 flex items-center gap-2">🛠️ Nova Manutenção</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Veículo</label>
                <select name="vehicleId" required className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-orange-500">
                  <option value="">Selecione...</option>
                  {veiculos.map(v => (<option key={v.id} value={v.id}>{v.model} ({v.plate})</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo de Serviço</label>
                <select name="type" required className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-orange-500">
                  <option value="Troca de Óleo">Troca de Óleo</option>
                  <option value="Pneus">Pneus</option>
                  <option value="Freios">Freios</option>
                  <option value="Suspensão">Suspensão</option>
                  <option value="Elétrica">Elétrica</option>
                  <option value="Revisão Geral">Revisão Geral</option>
                  <option value="Corretiva (Quebra)">Manutenção Corretiva</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">KM Atual</label>
                  <input type="number" name="performedKm" required className="w-full border p-2 rounded-lg outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Próxima (KM)</label>
                  <input type="number" name="nextRevisionKm" placeholder="Ex: +10.000" className="w-full border p-2 rounded-lg outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Custo (R$)</label>
                <input type="number" step="0.01" name="cost" required placeholder="0,00" className="w-full border p-2 rounded-lg outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Descrição do Serviço</label>
                <textarea name="description" rows={3} className="w-full border p-2 rounded-lg outline-none" placeholder="O que foi feito?"></textarea>
              </div>
              <button type="submit" className="w-full bg-orange-600 text-white font-bold p-3 rounded-lg hover:bg-orange-700 transition">Salvar Manutenção</button>
            </div>
          </form>
        </div>

        {/* HISTÓRICO */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-bold">Histórico Recente</h2>
            <form method="GET" className="flex gap-2">
              <select name="veiculo" defaultValue={filtroVeiculo} className="border p-2 rounded-lg text-sm outline-none">
                <option value="">Filtrar por Veículo...</option>
                {veiculos.map(v => (<option key={v.id} value={v.id}>{v.model}</option>))}
              </select>
              <button type="submit" className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold">Ok</button>
            </form>
          </div>

          <div className="space-y-4">
            {manutencoes.length === 0 ? (
              <p className="text-center text-gray-500 bg-white p-10 rounded-xl border">Nenhuma manutenção registrada.</p>
            ) : (
              manutencoes.map(m => (
                <div key={m.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-900">{m.vehicle.model}</span>
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">{m.type}</span>
                    </div>
                    <p className="text-sm text-gray-500">{m.description}</p>
                    <div className="mt-3 flex gap-4 text-xs text-gray-400">
                      <span>📅 {new Date(m.date).toLocaleDateString('pt-BR')}</span>
                      <span>📍 KM: {m.performedKm}</span>
                      {m.nextRevisionKm && <span className="text-orange-500 font-medium">⏭️ Próxima: {m.nextRevisionKm} KM</span>}
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end justify-center border-t md:border-t-0 md:border-l pt-3 md:pt-0 md:pl-6 border-gray-100">
                    <span className="text-xs text-gray-400 uppercase font-bold">Custo Total</span>
                    <span className="text-xl font-bold text-green-600">R$ {m.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}