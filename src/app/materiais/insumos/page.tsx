// src/app/materiais/insumos/page.tsx
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

const prisma = new PrismaClient();

export default async function InsumosPage(props: { searchParams: Promise<{ critico?: string, busca?: string, categoria?: string, error?: string, edit?: string }> }) {
  const searchParams = await props.searchParams;
  const mostrarSomenteCriticos = searchParams?.critico === 'true';
  const busca = searchParams?.busca || '';
  const categoria = searchParams?.categoria || '';
  const erroURL = searchParams?.error;
  
  const editId = searchParams?.edit ? parseInt(searchParams.edit) : null;
  const materialToEdit = editId ? await prisma.material.findUnique({ where: { id: editId } }) : null;

  // Filtra APENAS Insumos e Ferramentas
  const whereClause: any = {
    category: { in: ["Insumos", "Ferramentas"] }
  };

  if (busca) {
    whereClause.OR = [
      { name: { contains: busca, mode: 'insensitive' } },
      { category: { contains: busca, mode: 'insensitive' } }
    ];
  }
  if (categoria) {
    whereClause.category = categoria;
  }

  const todosMateriais = await prisma.material.findMany({
    where: whereClause,
    orderBy: [{ category: 'asc' }, { name: 'asc' }]
  });

  const materiais = mostrarSomenteCriticos 
    ? todosMateriais.filter(m => m.currentStock <= m.minStock)
    : todosMateriais;

  const categoriasOpcoes = (
    <>
      <option value="Insumos">Insumos (Cabos, Conectores, Fitas...)</option>
      <option value="Ferramentas">Ferramentas (Alicates, Furadeiras...)</option>
    </>
  );

  async function salvarMaterial(formData: FormData) {
    "use server";
    const id = formData.get("id") ? parseInt(formData.get("id") as string) : null;
    const name = formData.get("name") as string;
    const category = formData.get("category") as string;
    const minStock = parseInt(formData.get("minStock") as string);
    const currentStock = parseInt(formData.get("currentStock") as string);

    if (id) {
      await prisma.material.update({ where: { id }, data: { name, category, minStock, currentStock } });
    } else {
      await prisma.material.create({ data: { name, category, minStock, currentStock } });
    }
    revalidatePath("/materiais/insumos");
    redirect("/materiais/insumos");
  }

  async function deletarMaterial(formData: FormData) {
    "use server";
    const id = parseInt(formData.get("id") as string);
    const historico = await prisma.transaction.count({ where: { materialId: id } });
    
    if (historico > 0) {
      redirect("/materiais/insumos?error=em_uso");
    }
    await prisma.material.delete({ where: { id } });
    revalidatePath("/materiais/insumos");
    redirect("/materiais/insumos");
  }

  return (
    <div>
      {/* CANCELAR EDIÇÃO */}
      {materialToEdit && (
        <div className="flex justify-end mb-4">
          <Link href="/materiais/insumos" className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium text-sm hover:bg-gray-300 transition">
            Cancelar Edição
          </Link>
        </div>
      )}

      {erroURL === "em_uso" && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-6 border border-red-200 font-medium">
          ⚠️ <strong>Operação Negada:</strong> Você não pode excluir um insumo com histórico. Edite e deixe o saldo zero.
        </div>
      )}

      <form action={salvarMaterial} className={`p-6 rounded-xl shadow-sm border mb-8 transition-all ${materialToEdit ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}>
        <h2 className={`text-xl font-bold mb-4 ${materialToEdit ? 'text-blue-800' : 'text-gray-900'}`}>
          {materialToEdit ? `Editando: ${materialToEdit.name}` : 'Cadastrar Novo Insumo/Ferramenta'}
        </h2>
        
        {materialToEdit && <input type="hidden" name="id" value={materialToEdit.id} />}

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nome do Item</label>
            <input type="text" name="name" defaultValue={materialToEdit?.name || ""} required placeholder="Ex: Rolo Cabo de Rede CAT6" className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Categoria</label>
            <select name="category" defaultValue={materialToEdit?.category || "Insumos"} required className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {categoriasOpcoes}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Saldo Atual</label>
            <input type="number" name="currentStock" defaultValue={materialToEdit?.currentStock ?? ""} required placeholder="Qtd" className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Alerta (Mínimo)</label>
            <input type="number" name="minStock" defaultValue={materialToEdit?.minStock ?? ""} required min="0" placeholder="Avisar em..." className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" className={`md:col-span-5 w-full text-white font-bold p-2 rounded-lg mt-2 transition shadow-sm ${materialToEdit ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-900 hover:bg-slate-800'}`}>
            {materialToEdit ? 'Salvar Alterações' : 'Cadastrar Insumo'}
          </button>
        </div>
      </form>

      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-6 bg-gray-50/50">
        <form method="GET" className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input type="text" name="busca" defaultValue={busca} placeholder="Pesquisar insumo ou ferramenta..." className="w-full border border-gray-300 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="w-full sm:w-64">
            <select name="categoria" defaultValue={categoria} className="w-full border border-gray-300 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Todas</option>
              {categoriasOpcoes}
            </select>
          </div>
          <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition">Pesquisar</button>
          {(busca || categoria) && (
            <Link href="/materiais/insumos" className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 flex items-center justify-center">Limpar</Link>
          )}
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Insumo/Ferramenta</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Subcategoria</th>
              <th className="px-6 py-3 text-center font-medium text-gray-500 uppercase">Estoque</th>
              <th className="px-6 py-3 text-center font-medium text-gray-500 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {materiais.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-500">Nenhum item encontrado.</td></tr>
            ) : (
              materiais.map((m) => {
                const emAlerta = m.currentStock <= m.minStock;
                return (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-bold text-gray-900">{m.name}</td>
                    <td className="px-6 py-4 text-gray-600"><span className="bg-slate-100 px-2 py-1 rounded text-xs font-medium text-slate-700 border border-slate-200">{m.category}</span></td>
                    <td className={`px-6 py-4 text-center font-bold text-lg ${emAlerta ? 'text-red-600' : 'text-gray-900'}`}>
                      {m.currentStock} <span className="text-xs text-gray-400 font-normal">/ min: {m.minStock}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <Link href={`/materiais/insumos?edit=${m.id}`} className="text-blue-600 font-bold text-xs bg-blue-50 px-3 py-1.5 rounded border border-blue-100 hover:bg-blue-100 transition">Editar</Link>
                        <form action={deletarMaterial}>
                          <input type="hidden" name="id" value={m.id} />
                          <button type="submit" className="text-red-500 hover:text-red-700 font-bold text-xs bg-red-50 px-3 py-1.5 rounded border border-red-100 transition hover:bg-red-100">Excluir</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}