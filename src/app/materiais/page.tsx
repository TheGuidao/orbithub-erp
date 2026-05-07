// src/app/materiais/page.tsx
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

const prisma = new PrismaClient();

export default async function MateriaisPage(props: { searchParams: Promise<{ critico?: string, busca?: string, categoria?: string, error?: string, edit?: string }> }) {
  const searchParams = await props.searchParams;
  const mostrarSomenteCriticos = searchParams?.critico === 'true';
  const busca = searchParams?.busca || '';
  const categoria = searchParams?.categoria || '';
  const erroURL = searchParams?.error;
  
  const editId = searchParams?.edit ? parseInt(searchParams.edit) : null;
  const materialToEdit = editId ? await prisma.material.findUnique({ where: { id: editId } }) : null;

  const whereClause: any = {};
  if (busca) {
    whereClause.OR = [
      { name: { contains: busca } },
      { category: { contains: busca } }
    ];
  }
  if (categoria) {
    whereClause.category = categoria;
  }

  const todosMateriais = await prisma.material.findMany({
    where: whereClause,
    orderBy: [
      { category: 'asc' },
      { name: 'asc' }
    ]
  });

  const materiais = mostrarSomenteCriticos 
    ? todosMateriais.filter(m => m.currentStock <= m.minStock)
    : todosMateriais;

  const categoriasOpcoes = (
    <>
      <optgroup label="Automação">
        <option value="Automação - Centrais">Centrais de Automação</option>
        <option value="Automação - Módulos">Módulos de Automação</option>
      </optgroup>
      <optgroup label="Áudio e Vídeo">
        <option value="Áudio/Vídeo - Receivers e Áudio">Receivers e Áudio</option>
        <option value="Áudio/Vídeo - TV com Suporte">TV com Suporte</option>
        <option value="Áudio/Vídeo - Projetor, Tela e Lift/Flap">Projetor, Tela Motorizada e Lift/Flap</option>
        <option value="Áudio/Vídeo - Painéis de LED">Painéis de LED</option>
      </optgroup>
      <optgroup label="Rede e Infraestrutura">
        <option value="Rede - Equipamentos">Equipamentos de Rede</option>
        <option value="Infra - Montagem de Quadros">Montagem de Quadros</option>
        <option value="Infra - Cabeamento">Cabeamento</option>
      </optgroup>
      <optgroup label="Diversos">
        <option value="Ferramentas">Ferramentas</option>
        <option value="Insumos">Insumos</option>
      </optgroup>
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
      await prisma.material.update({
        where: { id },
        data: { name, category, minStock, currentStock }
      });
    } else {
      await prisma.material.create({
        data: { name, category, minStock, currentStock }
      });
    }

    revalidatePath("/materiais");
    revalidatePath("/");
    redirect("/materiais");
  }

  async function deletarMaterial(formData: FormData) {
    "use server";
    const id = parseInt(formData.get("id") as string);

    const historico = await prisma.transaction.count({ where: { materialId: id } });
    if (historico > 0) {
      redirect("/materiais?error=em_uso");
    }

    await prisma.material.delete({ where: { id } });
    revalidatePath("/materiais");
    revalidatePath("/");
    redirect("/materiais");
  }

  return (
    <div className="p-4 md:p-8">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Catálogo de Materiais</h1> {/* TITULO CORRIGIDO AQUI! */}
          <p className="text-gray-500 mt-1">Cadastre, pesquise e edite os materiais do estoque.</p>
        </div>
        {materialToEdit && (
          <Link href="/materiais" className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium text-sm hover:bg-gray-300 transition">
            Cancelar Edição
          </Link>
        )}
      </header>

      {erroURL === "em_uso" && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-6 border border-red-200 font-medium">
          ⚠️ <strong>Operação Negada:</strong> Você não pode excluir um material que já possui histórico de retiradas. Clique em "Editar" e deixe o saldo dele como zero em vez de excluir.
        </div>
      )}

      {mostrarSomenteCriticos && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl shadow-sm mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-red-800 font-bold text-lg flex items-center gap-2">⚠️ Visualizando Estoque Crítico</h3>
            <p className="text-red-600 text-sm mt-1">Mostrando apenas itens abaixo do limite mínimo.</p>
          </div>
          <Link href="/materiais" className="bg-white border border-red-200 text-red-600 font-bold px-4 py-2 rounded-lg hover:bg-red-100 transition text-sm">
            Ver Todos os Itens
          </Link>
        </div>
      )}

      <form action={salvarMaterial} className={`p-6 rounded-xl shadow-sm border mb-8 transition-all ${materialToEdit ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}>
        <h2 className={`text-xl font-bold mb-4 ${materialToEdit ? 'text-blue-800' : 'text-gray-900'}`}>
          {materialToEdit ? `Editando: ${materialToEdit.name}` : 'Cadastrar Novo Item'}
        </h2>
        
        {materialToEdit && <input type="hidden" name="id" value={materialToEdit.id} />}

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nome do Item / Equipamento</label>
            <input type="text" name="name" defaultValue={materialToEdit?.name || ""} required placeholder="Ex: Roteador WiFi 6 Ubiquiti" className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Categoria</label>
            <select name="category" defaultValue={materialToEdit?.category || ""} required className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="" disabled>Selecione...</option>
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
            {materialToEdit ? 'Salvar Alterações' : 'Cadastrar Item'}
          </button>
        </div>
      </form>

      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-6 bg-gray-50/50">
        <form method="GET" className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input type="text" name="busca" defaultValue={busca} placeholder="Pesquisar por nome ou categoria do material..." className="w-full border border-gray-300 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="w-full sm:w-64">
            <select name="categoria" defaultValue={categoria} className="w-full border border-gray-300 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Todas as Categorias</option>
              {categoriasOpcoes}
            </select>
          </div>
          <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition">
            Pesquisar
          </button>
          {(busca || categoria) && (
            <Link href="/materiais" className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 text-center flex items-center justify-center">
              Limpar
            </Link>
          )}
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Item</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Subcategoria</th>
              <th className="px-6 py-3 text-center font-medium text-gray-500 uppercase">Estoque</th>
              <th className="px-6 py-3 text-center font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-center font-medium text-gray-500 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {materiais.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">Nenhum item encontrado.</td></tr>
            ) : (
              materiais.map((m) => {
                const emAlerta = m.currentStock <= m.minStock;
                return (
                  <tr key={m.id} className={`hover:bg-gray-50 ${emAlerta && mostrarSomenteCriticos ? 'bg-red-50/30' : ''}`}>
                    <td className="px-6 py-4 font-bold text-gray-900">{m.name}</td>
                    <td className="px-6 py-4 text-gray-600">
                      <span className="bg-slate-100 px-2 py-1 rounded text-xs font-medium text-slate-700 border border-slate-200">
                        {m.category}
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-center font-bold text-lg ${emAlerta ? 'text-red-600' : 'text-gray-900'}`}>
                      {m.currentStock} <span className="text-xs text-gray-400 font-normal">/ min: {m.minStock}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${emAlerta ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {emAlerta ? 'Comprar' : 'Ok'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <Link 
                          href={`/materiais?edit=${m.id}`} 
                          className="text-blue-600 font-bold text-xs bg-blue-50 px-3 py-1.5 rounded border border-blue-100 hover:bg-blue-100 transition"
                        >
                          Editar
                        </Link>
                        <form action={deletarMaterial}>
                          <input type="hidden" name="id" value={m.id} />
                          <button type="submit" className="text-red-500 hover:text-red-700 font-bold text-xs bg-red-50 px-3 py-1.5 rounded border border-red-100 transition hover:bg-red-100">
                            Excluir
                          </button>
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