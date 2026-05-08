// src/app/veiculos/page.tsx
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

const prisma = new PrismaClient();

export default async function VeiculosPage(props: { searchParams: Promise<{ busca?: string, edit?: string }> }) {
  const searchParams = await props.searchParams;
  const busca = searchParams?.busca || "";
  const editId = searchParams?.edit ? parseInt(searchParams.edit) : null;

  // A MÁGICA ACONTECE AQUI: mode: 'insensitive' ignora maiúsculas e minúsculas
  const veiculos = await prisma.vehicle.findMany({
    where: { 
      OR: [
        { model: { contains: busca, mode: 'insensitive' } }, 
        { plate: { contains: busca, mode: 'insensitive' } }
      ] 
    },
    orderBy: { model: 'asc' }
  });

  // Busca os dados do veículo que está sendo editado (se houver)
  const veiculoEditando = editId ? await prisma.vehicle.findUnique({ where: { id: editId } }) : null;

  async function salvarVeiculo(formData: FormData) {
    "use server";
    const idString = formData.get("id") as string;
    const model = formData.get("model") as string;
    const plate = formData.get("plate") as string;
    const currentKm = parseInt(formData.get("currentKm") as string);

    if (idString) {
      // EDITAR
      await prisma.vehicle.update({
        where: { id: parseInt(idString) },
        data: { model, plate, currentKm }
      });
    } else {
      // CRIAR NOVO
      await prisma.vehicle.create({ data: { model, plate, currentKm } });
    }
    revalidatePath("/veiculos");
    redirect("/veiculos"); // Limpa a URL e tira o modo de edição
  }

  async function excluirVeiculo(formData: FormData) {
    "use server";
    const id = parseInt(formData.get("id") as string);
    
    try {
      // 1º Apaga o histórico de uso (viagens/check-ins)
      await prisma.vehicleLog.deleteMany({ where: { vehicleId: id } });
      
      // 2º Apaga o histórico de manutenções (Oficina)
      await prisma.vehicleMaintenance.deleteMany({ where: { vehicleId: id } });
      
      // 3º Agora sim, o veículo está livre para ser apagado do sistema
      await prisma.vehicle.delete({ where: { id } });
      
      revalidatePath("/veiculos");
      revalidatePath("/frota");
      revalidatePath("/manutencao");
    } catch (e) {
      console.error("Erro crítico ao excluir o veículo:", e);
    }
  }

  return (
    <div className="p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Cadastro de Veículos</h1>
      </header>

      {/* Formulário Duplo: Serve para Criar ou Editar */}
      <form action={salvarVeiculo} className={`${veiculoEditando ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'} p-6 rounded-xl shadow-sm border mb-8 transition-colors`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            {veiculoEditando ? `Editando: ${veiculoEditando.model}` : "Novo Veículo"}
          </h2>
          {veiculoEditando && (
            <Link href="/veiculos" className="text-sm font-medium text-gray-500 hover:text-gray-800 bg-gray-200 px-3 py-1 rounded">Cancelar Edição</Link>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {veiculoEditando && <input type="hidden" name="id" value={veiculoEditando.id} />}
          
          <div className="md:col-span-2">
            <input type="text" name="model" defaultValue={veiculoEditando?.model || ""} required placeholder="Modelo/Identificação" className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <input type="text" name="plate" defaultValue={veiculoEditando?.plate || ""} required placeholder="Placa" className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <input type="number" name="currentKm" defaultValue={veiculoEditando?.currentKm || ""} required placeholder="KM Atual" className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" className={`md:col-span-4 text-white p-2 rounded-lg font-bold transition ${veiculoEditando ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-900 hover:bg-slate-800'}`}>
            {veiculoEditando ? "Salvar Alterações" : "Cadastrar Veículo"}
          </button>
        </div>
      </form>

      {/* Filtro de Busca */}
      <div className="bg-white p-4 rounded-t-xl border border-gray-200 border-b-0 flex justify-between items-center bg-gray-50/50">
        <form method="GET" className="flex gap-2 w-full md:w-auto">
          <input type="text" name="busca" defaultValue={busca} placeholder="Buscar modelo ou placa..." className="border p-2 rounded-lg text-sm outline-none w-64 focus:ring-2 focus:ring-blue-500" />
          <button type="submit" className="bg-blue-600 text-white px-4 rounded-lg text-sm font-medium hover:bg-blue-700">Filtrar</button>
          {busca && <a href="/veiculos" className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm flex items-center hover:bg-gray-300">Limpar</a>}
        </form>
      </div>

      {/* Lista de Veículos */}
      <div className="bg-white rounded-b-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Modelo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Placa</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">KM Atual</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {veiculos.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-500 text-sm">Nenhum veículo encontrado.</td></tr>
            ) : (
              veiculos.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">{v.model}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{v.plate}</td>
                  <td className="px-6 py-4 text-sm text-center font-bold">{v.currentKm} KM</td>
                  <td className="px-6 py-4 text-center flex justify-center gap-4">
                    <Link href={`/veiculos?edit=${v.id}`} className="text-blue-600 hover:underline text-sm font-medium">Editar</Link>
                    <form action={excluirVeiculo}>
                      <input type="hidden" name="id" value={v.id} />
                      <button type="submit" className="text-red-500 hover:underline text-sm font-medium">Excluir</button>
                    </form>
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