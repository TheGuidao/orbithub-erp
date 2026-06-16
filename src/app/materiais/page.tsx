// src/app/materiais/page.tsx
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

const prisma = new PrismaClient();

export default async function MateriaisPage(props: { 
  searchParams: Promise<{ critico?: string, busca?: string, categoria?: string, error?: string, edit?: string, action?: string }> 
}) {
  const searchParams = await props.searchParams;
  const mostrarSomenteCriticos = searchParams?.critico === 'true';
  const busca = searchParams?.busca || '';
  const categoriaFiltroId = searchParams?.categoria || '';
  const erroURL = searchParams?.error;
  const action = searchParams?.action;
  
  const editId = searchParams?.edit ? parseInt(searchParams.edit) : null;
  const materialToEdit = editId ? await prisma.material.findUnique({ where: { id: editId } }) : null;

  // Carrega as Categorias e Subcategorias dinâmicas do banco (Apenas tipo EQUIPAMENTO)
  const categoriasDoBanco = await prisma.category.findMany({
    where: { type: "EQUIPAMENTO" },
    include: { subcategories: { orderBy: { name: 'asc' } } },
    orderBy: { name: 'asc' }
  });

  // Filtro de Busca estruturado
  const whereClause: any = {
    OR: [
      { subcategory: { category: { type: "EQUIPAMENTO" } } },
      { subcategoryId: null, category: { notIn: ["Insumos", "Ferramentas"] } } // Suporte a dados antigos
    ]
  };

  if (busca) {
    whereClause.AND = [
      {
        OR: [
          { name: { contains: busca, mode: 'insensitive' } },
          { brand: { contains: busca, mode: 'insensitive' } },
          { subcategory: { name: { contains: busca, mode: 'insensitive' } } }
        ]
      }
    ];
  }

  if (categoriaFiltroId) {
    if (!whereClause.AND) whereClause.AND = [];
    whereClause.AND.push({ subcategoryId: parseInt(categoriaFiltroId) });
  }

  const todosMateriais = await prisma.material.findMany({
    where: whereClause,
    include: { subcategory: { include: { category: true } } },
    orderBy: [
      { subcategory: { category: { name: 'asc' } } },
      { name: 'asc' }
    ]
  });

  const materiais = mostrarSomenteCriticos 
    ? todosMateriais.filter(m => m.currentStock <= m.minStock)
    : todosMateriais;

  // --- SERVER ACTIONS DE CADASTRO ---

  async function salvarMaterial(formData: FormData) {
    "use server";
    const id = formData.get("id") ? parseInt(formData.get("id") as string) : null;
    const name = formData.get("name") as string;
    const brand = formData.get("brand") as string;
    const subcategoryIdString = formData.get("subcategoryId") as string;
    const minStock = parseInt(formData.get("minStock") as string);
    const currentStock = parseInt(formData.get("currentStock") as string);

    const subcategoryId = subcategoryIdString ? parseInt(subcategoryIdString) : null;

    if (id) {
      await prisma.material.update({
        where: { id },
        data: { name, brand, subcategoryId, minStock, currentStock }
      });
    } else {
      await prisma.material.create({
        data: { name, brand, subcategoryId, minStock, currentStock }
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

  async function criarCategoria(formData: FormData) {
    "use server";
    const name = formData.get("categoryName") as string;
    if (name) {
      try {
        await prisma.category.create({ data: { name: name.trim(), type: "EQUIPAMENTO" } });
      } catch (e) {
        // Ignora duplicados ou trata erro de forma silenciosa
      }
    }
    revalidatePath("/materiais");
    redirect("/materiais");
  }

  async function criarSubcategoria(formData: FormData) {
    "use server";
    const categoryId = parseInt(formData.get("parentCategoryId") as string);
    const name = formData.get("subcategoryName") as string;
    if (!isNaN(categoryId) && name) {
      await prisma.subcategory.create({ data: { name: name.trim(), categoryId } });
    }
    revalidatePath("/materiais");
    redirect("/materiais");
  }

  return (
    <div className="relative">
      
      {/* MODAL: NOVA CATEGORIA PAI */}
      {action === "nova_cat" && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form action={criarCategoria} className="bg-white p-6 rounded-2xl max-w-md w-full shadow-xl border border-gray-100">
            <h3 className="font-bold text-xl text-gray-900 mb-2">📦 Criar Nova Categoria</h3>
            <p className="text-xs text-gray-500 mb-4">Exemplos: Automação, Áudio e Vídeo, Rede, Redes e Infraestrutura.</p>
            <input type="text" name="categoryName" required placeholder="Nome da categoria principal..." className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 mb-4" />
            <div className="flex gap-2 justify-end">
              <Link href="/materiais" className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold text-sm transition">Cancelar</Link>
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition">Salvar Categoria</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: NOVA SUBCATEGORIA */}
      {action === "nova_sub" && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form action={criarSubcategoria} className="bg-white p-6 rounded-2xl max-w-md w-full shadow-xl border border-gray-100">
            <h3 className="font-bold text-xl text-gray-900 mb-2">🌿 Criar Nova Subcategoria</h3>
            <p className="text-xs text-gray-500 mb-4">Exemplos: Centrais, Módulos, Receivers, Caixas de Som, Cabeamento.</p>
            
            <label className="block text-xs font-bold text-gray-600 mb-1">Vincular à Categoria Principal:</label>
            <select name="parentCategoryId" required className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white mb-3 text-sm">
              <option value="" disabled selected>Escolha uma categoria...</option>
              {categoriasDoBanco.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <label className="block text-xs font-bold text-gray-600 mb-1">Nome da Subcategoria:</label>
            <input type="text" name="subcategoryName" required placeholder="Ex: Amplificadores de Parede" className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 mb-4" />
            
            <div className="flex gap-2 justify-end">
              <Link href="/materiais" className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold text-sm transition">Cancelar</Link>
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition">Salvar Subcategoria</button>
            </div>
          </form>
        </div>
      )}

      {/* CANCELAR EDIÇÃO */}
      {materialToEdit && (
        <div className="flex justify-end mb-4">
          <Link href="/materiais" className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium text-sm hover:bg-gray-300 transition">
            Cancelar Edição
          </Link>
        </div>
      )}

      {erroURL === "em_uso" && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-6 border border-red-200 font-medium">
          ⚠️ <strong>Operação Negada:</strong> Você não pode excluir um equipamento que já possui histórico de retiradas. Clique em "Editar" e deixe o saldo dele como zero em vez de excluir.
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

      {/* FORMULÁRIO PRINCIPAL */}
      <form action={salvarMaterial} className={`p-6 rounded-xl shadow-sm border mb-8 transition-all ${materialToEdit ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}>
        <h2 className={`text-xl font-bold mb-4 ${materialToEdit ? 'text-blue-800' : 'text-gray-900'}`}>
          {materialToEdit ? `Editando: ${materialToEdit.name}` : 'Cadastrar Novo Equipamento'}
        </h2>
        
        {materialToEdit && <input type="hidden" name="id" value={materialToEdit.id} />}

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nome do Equipamento</label>
            <input type="text" name="name" defaultValue={materialToEdit?.name || ""} required placeholder="Ex: Roteador WiFi 6" className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Marca / Fabricante</label>
            <input type="text" name="brand" defaultValue={materialToEdit?.brand || ""} placeholder="Ex: Ubiquiti" className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="md:col-span-1">
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-gray-600">Subcategoria</label>
              <div className="flex gap-1">
                <Link href="/materiais?action=nova_cat" className="text-[10px] text-blue-600 font-bold hover:underline" title="Criar Categoria Principal">+ Cat</Link>
                <span className="text-[10px] text-gray-300">|</span>
                <Link href="/materiais?action=nova_sub" className="text-[10px] text-blue-600 font-bold hover:underline" title="Criar Subcategoria">+ Sub</Link>
              </div>
            </div>
            <select name="subcategoryId" defaultValue={materialToEdit?.subcategoryId || ""} required className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm">
              <option value="" disabled>Selecione...</option>
              {categoriasDoBanco.map(cat => (
                <optgroup key={cat.id} label={cat.name}>
                  {cat.subcategories.map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </optgroup>
              ))}
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
          <button type="submit" className={`md:col-span-6 w-full text-white font-bold p-2 rounded-lg mt-2 transition shadow-sm ${materialToEdit ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-900 hover:bg-slate-800'}`}>
            {materialToEdit ? 'Salvar Alterações' : 'Cadastrar Equipamento'}
          </button>
        </div>
      </form>

      {/* FILTROS E BUSCA */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-6 bg-gray-50/50">
        <form method="GET" className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input type="text" name="busca" defaultValue={busca} placeholder="Pesquisar por nome, marca ou subcategoria..." className="w-full border border-gray-300 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="w-full sm:w-64">
            <select name="categoria" defaultValue={categoriaFiltroId} className="w-full border border-gray-300 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Todas as Subcategorias</option>
              {categoriasDoBanco.map(cat => (
                <optgroup key={cat.id} label={cat.name}>
                  {cat.subcategories.map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition">
            Pesquisar
          </button>
          {(busca || categoriaFiltroId) && (
            <Link href="/materiais" className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 text-center flex items-center justify-center">
              Limpar
            </Link>
          )}
        </form>
      </div>

      {/* TABELA DE DADOS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Equipamento</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Categoria / Subcategoria</th>
              <th className="px-6 py-3 text-center font-medium text-gray-500 uppercase">Estoque</th>
              <th className="px-6 py-3 text-center font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-center font-medium text-gray-500 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {materiais.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">Nenhum equipamento encontrado.</td></tr>
            ) : (
              materiais.map((m) => {
                const emAlerta = m.currentStock <= m.minStock;
                
                // Trata exibição se o item tiver relação nova ou categoria antiga em texto solto
                const labelCategoria = m.subcategory 
                  ? `${m.subcategory.category.name} → ${m.subcategory.name}`
                  : m.category || "Sem categoria";

                return (
                  <tr key={m.id} className={`hover:bg-gray-50 ${emAlerta && mostrarSomenteCriticos ? 'bg-red-50/30' : ''}`}>
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900">{m.name}</p>
                      {m.brand && <p className="text-[10px] text-gray-500 font-semibold uppercase">{m.brand}</p>}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      <span className="bg-slate-100 px-2 py-1 rounded text-xs font-medium text-slate-700 border border-slate-200">
                        {labelCategoria}
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