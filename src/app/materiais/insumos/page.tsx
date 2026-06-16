// src/app/materiais/insumos/page.tsx
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

const prisma = new PrismaClient();

export default async function InsumosPage(props: { 
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

  // AUTO-SEED INSUMOS: Garante que existam categorias base se o banco de insumos estiver vazio
  const totalCategoriasInsumos = await prisma.category.count({ where: { type: "INSUMO" } });
  if (totalCategoriasInsumos === 0) {
    await prisma.category.create({
      data: {
        name: "Insumos",
        type: "INSUMO",
        subcategories: {
          create: [
            { name: "Cabos e Fios" },
            { name: "Conectores e Terminais" },
            { name: "Fitas e Fixadores" }
          ]
        }
      }
    });
    await prisma.category.create({
      data: {
        name: "Ferramentas",
        type: "INSUMO",
        subcategories: {
          create: [
            { name: "Alicates" },
            { name: "Furadeiras e Brocas" },
            { name: "Chaves Diversas" }
          ]
        }
      }
    });
    revalidatePath("/materiais/insumos");
  }

  // Carrega as Categorias e Subcategorias dinâmicas (Apenas tipo INSUMO)
  const categoriasDoBanco = await prisma.category.findMany({
    where: { type: "INSUMO" },
    include: { subcategories: { orderBy: { name: 'asc' } } },
    orderBy: { name: 'asc' }
  });

  // Filtro de Busca estruturado para Insumos
  const whereClause: any = {
    OR: [
      { subcategory: { category: { type: "INSUMO" } } },
      { subcategoryId: null, category: { in: ["Insumos", "Ferramentas"] } } // Suporte a dados antigos
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

  // --- SERVER ACTIONS DE CADASTRO E EXCLUSÃO ---

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

  // Ações para Categorias Dinâmicas
  async function criarCategoria(formData: FormData) {
    "use server";
    const name = formData.get("categoryName") as string;
    if (name) {
      try {
        await prisma.category.create({ data: { name: name.trim(), type: "INSUMO" } });
      } catch (e) {}
    }
    revalidatePath("/materiais/insumos");
    redirect("/materiais/insumos?action=nova_cat");
  }

  async function criarSubcategoria(formData: FormData) {
    "use server";
    const categoryId = parseInt(formData.get("parentCategoryId") as string);
    const name = formData.get("subcategoryName") as string;
    if (!isNaN(categoryId) && name) {
      await prisma.subcategory.create({ data: { name: name.trim(), categoryId } });
    }
    revalidatePath("/materiais/insumos");
    redirect("/materiais/insumos?action=nova_sub");
  }

  async function deletarCategoria(formData: FormData) {
    "use server";
    const id = parseInt(formData.get("categoryId") as string);
    const subcategories = await prisma.subcategory.findMany({ where: { categoryId: id } });
    const subIds = subcategories.map(s => s.id);
    const emUso = await prisma.material.count({ where: { subcategoryId: { in: subIds } } });

    if (emUso > 0) {
      redirect("/materiais/insumos?action=nova_cat&error=cat_em_uso");
    }

    await prisma.category.delete({ where: { id } });
    revalidatePath("/materiais/insumos");
    redirect("/materiais/insumos?action=nova_cat");
  }

  async function deletarSubcategoria(formData: FormData) {
    "use server";
    const id = parseInt(formData.get("subcategoryId") as string);
    const emUso = await prisma.material.count({ where: { subcategoryId: id } });

    if (emUso > 0) {
      redirect("/materiais/insumos?action=nova_sub&error=sub_em_uso");
    }

    await prisma.subcategory.delete({ where: { id } });
    revalidatePath("/materiais/insumos");
    redirect("/materiais/insumos?action=nova_sub");
  }

  return (
    <div className="relative">
      
      {/* MODAL: NOVA CATEGORIA PAI */}
      {action === "nova_cat" && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl max-w-md w-full shadow-xl border border-gray-100 max-h-[85vh] flex flex-col">
            <h3 className="font-bold text-xl text-gray-900 mb-1">🧰 Criar Categoria de Insumo</h3>
            <p className="text-xs text-gray-500 mb-4">Gerencie as categorias de ferramentas e insumos.</p>
            
            {erroURL === "cat_em_uso" && (
              <p className="bg-red-50 text-red-600 p-2 rounded text-xs font-bold mb-3 border border-red-200">
                ⚠️ Não é possível excluir: existem itens vinculados a esta categoria.
              </p>
            )}

            <form action={criarCategoria} className="flex gap-2 mb-6 shrink-0">
              <input type="text" name="categoryName" required placeholder="Ex: Equipamentos de EPI" className="flex-1 border border-gray-300 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition">Criar</button>
            </form>

            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 shrink-0">Categorias Existentes</h4>
            <div className="flex-1 overflow-y-auto divide-y border rounded-xl px-3 bg-gray-50/50 mb-4">
              {categoriasDoBanco.map(c => (
                <div key={c.id} className="py-2.5 flex justify-between items-center text-sm">
                  <span className="font-medium text-gray-800">{c.name}</span>
                  <form action={deletarCategoria}>
                    <input type="hidden" name="categoryId" value={c.id} />
                    <button type="submit" className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition" title="Excluir">🗑️</button>
                  </form>
                </div>
              ))}
            </div>

            <div className="flex justify-end shrink-0">
              <Link href="/materiais/insumos" className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-lg font-bold text-sm transition text-center w-full sm:w-auto">Fechar Janela</Link>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVA SUBCATEGORIA */}
      {action === "nova_sub" && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl max-w-md w-full shadow-xl border border-gray-100 max-h-[85vh] flex flex-col">
            <h3 className="font-bold text-xl text-gray-900 mb-1">🌿 Criar Subcategoria de Insumo</h3>
            
            {erroURL === "sub_em_uso" && (
              <p className="bg-red-50 text-red-600 p-2 rounded text-xs font-bold mb-3 border border-red-200">
                ⚠️ Não é possível excluir: existem itens cadastrados nesta subcategoria.
              </p>
            )}

            <form action={criarSubcategoria} className="space-y-3 mb-6 shrink-0 border-b pb-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Categoria Pai:</label>
                <select name="parentCategoryId" required className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm">
                  <option value="" disabled selected>Selecione...</option>
                  {categoriasDoBanco.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <input type="text" name="subcategoryName" required placeholder="Ex: Parafusos Phillips" className="flex-1 border border-gray-300 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition">Criar</button>
              </div>
            </form>

            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 shrink-0">Subcategorias</h4>
            <div className="flex-1 overflow-y-auto space-y-3 mb-4">
              {categoriasDoBanco.map(cat => (
                <div key={cat.id} className="border rounded-xl p-3 bg-gray-50/50">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wide block mb-1.5">{cat.name}</span>
                  {cat.subcategories.length === 0 ? (
                    <span className="text-xs text-gray-400 italic">Nenhuma subcategoria.</span>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {cat.subcategories.map(sub => (
                        <div key={sub.id} className="py-1.5 flex justify-between items-center text-sm">
                          <span className="text-gray-700">{sub.name}</span>
                          <form action={deletarSubcategoria}>
                            <input type="hidden" name="subcategoryId" value={sub.id} />
                            <button type="submit" className="text-red-500 hover:bg-red-50 px-1.5 py-0.5 rounded transition text-xs">🗑️</button>
                          </form>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end shrink-0">
              <Link href="/materiais/insumos" className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-lg font-bold text-sm transition text-center w-full sm:w-auto">Fechar Janela</Link>
            </div>
          </div>
        </div>
      )}

      {/* RENDERIZAÇÃO DO FORMULÁRIO PRINCIPAL */}
      {materialToEdit && (
        <div className="flex justify-end mb-4">
          <Link href="/materiais/insumos" className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium text-sm hover:bg-gray-300 transition">Cancelar Edição</Link>
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

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nome do Item</label>
            <input type="text" name="name" defaultValue={materialToEdit?.name || ""} required placeholder="Ex: Rolo Cabo de Rede CAT6" className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Marca / Fabricante</label>
            <input type="text" name="brand" defaultValue={materialToEdit?.brand || ""} placeholder="Ex: Furukawa" className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="md:col-span-1">
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-gray-600">Subcategoria</label>
              <div className="flex gap-1">
                <Link href="/materiais/insumos?action=nova_cat" className="text-[10px] text-blue-600 font-bold hover:underline" title="Gerenciar Categorias Principal">+ Cat</Link>
                <span className="text-[10px] text-gray-300">|</span>
                <Link href="/materiais/insumos?action=nova_sub" className="text-[10px] text-blue-600 font-bold hover:underline" title="Gerenciar Subcategorias">+ Sub</Link>
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
            {materialToEdit ? 'Salvar Alterações' : 'Cadastrar Insumo'}
          </button>
        </div>
      </form>

      {/* FILTROS E TABELA */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-6 bg-gray-50/50">
        <form method="GET" className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input type="text" name="busca" defaultValue={busca} placeholder="Pesquisar por nome ou marca..." className="w-full border border-gray-300 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
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
          <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition">Pesquisar</button>
          {(busca || categoriaFiltroId) && (
            <Link href="/materiais/insumos" className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 flex items-center justify-center">Limpar</Link>
          )}
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Insumo/Ferramenta</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Categoria / Subcategoria</th>
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
                const labelCategoria = m.subcategory 
                  ? `${m.subcategory.category.name} → ${m.subcategory.name}`
                  : m.category || "Sem categoria";

                return (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900">{m.name}</p>
                      {m.brand && <p className="text-[10px] text-gray-500 font-semibold uppercase">{m.brand}</p>}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      <span className="bg-slate-100 px-2 py-1 rounded text-xs font-medium text-slate-700 border border-slate-200">{labelCategoria}</span>
                    </td>
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