// src/app/equipe/page.tsx
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

const prisma = new PrismaClient();

export default async function EquipePage(props: { searchParams: Promise<{ edit?: string, error?: string, success?: string, action?: string }> }) {
  const cookieStore = await cookies();
  const permissionsCookie = cookieStore.get("usuario_permissions")?.value;
  let userPermissions: any = {};
  
  try {
    userPermissions = permissionsCookie ? JSON.parse(permissionsCookie) : {};
  } catch(e) {}

  // Bloqueio inteligente: Só entra se for o 'admin' ou se tiver a permissão específica 'equipe.ver'
  const isMaster = cookieStore.get("usuario_nome")?.value === 'Administrador Mestre';
  const podeAcessarEquipe = isMaster || userPermissions?.equipe?.ver === true;

  if (!podeAcessarEquipe) {
    redirect('/'); 
  }

  const searchParams = await props.searchParams;
  const editId = searchParams?.edit ? parseInt(searchParams.edit) : null;
  const erroURL = searchParams?.error; 
  const successURL = searchParams?.success;
  const action = searchParams?.action;

  const userToEdit = editId ? await prisma.user.findUnique({ where: { id: editId } }) : null;

  const equipe = await prisma.user.findMany({ 
    where: { username: { not: 'admin' }, active: true },
    include: { role: true },
    orderBy: { name: 'asc' } 
  });

  const cargosDisponiveis = await prisma.role.findMany({
    orderBy: { name: 'asc' }
  });

  const badgeClasses: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700 border-blue-200",
    green: "bg-green-100 text-green-700 border-green-200",
    red: "bg-red-100 text-red-700 border-red-200",
    purple: "bg-purple-100 text-purple-700 border-purple-200",
    orange: "bg-orange-100 text-orange-700 border-orange-200",
    amber: "bg-amber-100 text-amber-700 border-amber-200",
  };

  // --- SERVER ACTIONS ---

  async function salvarUsuario(formData: FormData) {
    "use server";
    const id = formData.get("id") ? parseInt(formData.get("id") as string) : null;
    const name = formData.get("name") as string;
    const username = (formData.get("username") as string).trim();
    const emailRaw = (formData.get("email") as string).trim();
    const email = emailRaw === "" ? null : emailRaw; // Salva nulo se vier vazio
    const password = (formData.get("password") as string).trim();
    const roleIdStr = formData.get("roleId") as string;

    const roleId = roleIdStr ? parseInt(roleIdStr) : null;

    if (username.toLowerCase() === 'admin') redirect("/equipe?error=admin_reserved");

    // Validação de Username duplicado
    const usernameExistente = await prisma.user.findFirst({ where: { username, active: true } });
    if (usernameExistente && usernameExistente.id !== id) redirect("/equipe?error=username_exists");

    // Validação de Email duplicado
    if (email) {
      const emailExistente = await prisma.user.findFirst({ where: { email, active: true } });
      if (emailExistente && emailExistente.id !== id) redirect("/equipe?error=email_exists");
    }

    if (id) {
      const dataToUpdate: any = { name, username, email, roleId };
      if (password !== "") dataToUpdate.password = password; 
      await prisma.user.update({ where: { id }, data: dataToUpdate });
    } else {
      await prisma.user.create({ 
        data: { name, username, email, password, roleId, active: true } 
      });
    }
    
    revalidatePath("/equipe");
    redirect("/equipe");
  }

  async function deletarUsuario(formData: FormData) {
    "use server";
    const id = parseInt(formData.get("id") as string);
    
    const user = await prisma.user.findUnique({ where: { id } });
    if (user?.username === 'admin') throw new Error("Operação não permitida.");

    await prisma.user.update({ 
      where: { id }, 
      data: { active: false, username: `${user?.username}_excluido_${id}` } 
    });

    revalidatePath("/equipe");
    redirect("/equipe");
  }

  async function criarCargo(formData: FormData) {
    "use server";
    const name = formData.get("roleName") as string;
    const color = formData.get("roleColor") as string;

    const permissions = {
      painel: { ver: formData.get("p_painel_ver") === "on" },
      servicos: {
        ver: formData.get("p_servicos_ver") === "on",
        criar: formData.get("p_servicos_criar") === "on",
        excluir: formData.get("p_servicos_excluir") === "on",
      },
      catalogo: {
        ver: formData.get("p_catalogo_ver") === "on",
        criar: formData.get("p_catalogo_criar") === "on",
        excluir: formData.get("p_catalogo_excluir") === "on",
      },
      movimentacoes: {
        ver: formData.get("p_mov_ver") === "on",
        lancar: formData.get("p_mov_lancar") === "on",
      },
      frota: { ver: formData.get("p_frota_ver") === "on" },
      oficina: { ver: formData.get("p_oficina_ver") === "on" },
      garagem: { ver: formData.get("p_garagem_ver") === "on" },
      // NOVA CAIXINHA PARA EQUIPE
      equipe: { ver: formData.get("p_equipe_ver") === "on" }
    };

    if (name) {
      await prisma.role.create({
        data: { name: name.trim(), color, permissions }
      });
    }

    revalidatePath("/equipe");
    redirect("/equipe?action=gerenciar_cargos");
  }

  async function deletarCargo(formData: FormData) {
    "use server";
    const id = parseInt(formData.get("roleId") as string);
    const emUso = await prisma.user.count({ where: { roleId: id } });
    if (emUso > 0) redirect("/equipe?action=gerenciar_cargos&error=role_em_uso");
    await prisma.role.delete({ where: { id } });
    revalidatePath("/equipe");
    redirect("/equipe?action=gerenciar_cargos");
  }

  async function resetarSistemaConfirmado(formData: FormData) {
    "use server";
    const palavra = formData.get("confirmacao") as string;
    if (palavra !== "RESETAR") redirect("/equipe?error=palavra_reset_invalida");
    await prisma.transaction.deleteMany();
    await prisma.vehicleLog.deleteMany();
    await prisma.vehicleMaintenance.deleteMany();
    await prisma.material.deleteMany();
    await prisma.vehicle.deleteMany();
    await prisma.user.deleteMany({ where: { username: { not: 'admin' } } });
    revalidatePath("/", "layout");
    redirect("/equipe?success=reset_ok");
  }

  return (
    <div className="p-4 md:p-8 relative">
      
      {/* MODAL GIGANTE DE GERENCIAMENTO DE CARGOS */}
      {action === "gerenciar_cargos" && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-100 max-h-[90vh] flex flex-col">
            <header className="mb-4 shrink-0">
              <h3 className="font-black text-2xl text-gray-900">🛡️ Níveis de Acesso e Permissões</h3>
              <p className="text-xs text-gray-500 mt-0.5">Defina milimetricamente o que cada cargo pode visualizar ou operar.</p>
            </header>

            {erroURL === "role_em_uso" && (
              <p className="bg-red-50 text-red-600 p-2 rounded-lg text-xs font-bold mb-3 border border-red-200 shrink-0">
                ⚠️ Não é possível excluir: existem colaboradores ativos vinculados a este cargo.
              </p>
            )}

            <form action={criarCargo} className="space-y-4 border-b pb-5 mb-4 overflow-y-auto pr-1 custom-scrollbar flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Nome do Cargo</label>
                  <input type="text" name="roleName" required placeholder="Ex: Estoquista, Supervisor" className="w-full border border-gray-300 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Cor (Tag)</label>
                  <select name="roleColor" required className="w-full border border-gray-300 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="blue">🔵 Azul</option>
                    <option value="green">🟢 Verde</option>
                    <option value="purple">🟣 Roxo</option>
                    <option value="orange">🟠 Laranja</option>
                    <option value="amber">🟡 Amarelo</option>
                    <option value="red">🔴 Vermelho</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-blue-600 uppercase tracking-wider mb-2">Configuração de Permissões:</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  
                  <div className="border rounded-xl p-3 bg-gray-50/50 space-y-2">
                    <span className="text-xs font-bold text-gray-800 block border-b pb-1 mb-1">🎛️ Painel Inicial</span>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer"><input type="checkbox" name="p_painel_ver" defaultChecked /> Visualizar Dashboard Geral</label>
                  </div>

                  <div className="border rounded-xl p-3 bg-gray-50/50 space-y-2">
                    <span className="text-xs font-bold text-gray-800 block border-b pb-1 mb-1">📅 Serviços e Agendas</span>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer"><input type="checkbox" name="p_servicos_ver" defaultChecked /> Visualizar Quadro / Cards</label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer"><input type="checkbox" name="p_servicos_criar" /> Criar Novas O.S.</label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer"><input type="checkbox" name="p_servicos_excluir" /> Excluir O.S.</label>
                  </div>

                  <div className="border rounded-xl p-3 bg-gray-50/50 space-y-2">
                    <span className="text-xs font-bold text-gray-800 block border-b pb-1 mb-1">📦 Catálogo de Produtos</span>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer"><input type="checkbox" name="p_catalogo_ver" defaultChecked /> Visualizar Materiais</label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer"><input type="checkbox" name="p_catalogo_criar" /> Cadastrar/Editar Itens</label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer"><input type="checkbox" name="p_catalogo_excluir" /> Excluir produtos</label>
                  </div>

                  <div className="border rounded-xl p-3 bg-gray-50/50 space-y-2">
                    <span className="text-xs font-bold text-gray-800 block border-b pb-1 mb-1">🔄 Movimentações de Estoque</span>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer"><input type="checkbox" name="p_mov_ver" defaultChecked /> Visualizar Histórico</label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer"><input type="checkbox" name="p_mov_lancar" /> Lançar Entrada/Saída</label>
                  </div>

                  <div className="border rounded-xl p-3 bg-gray-50/50 space-y-2">
                    <span className="text-xs font-bold text-red-600 block border-b pb-1 mb-1 border-red-200">👥 Administração</span>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer"><input type="checkbox" name="p_equipe_ver" /> Acesso à Gestão de Equipe (Restrito)</label>
                  </div>

                  <div className="border rounded-xl p-3 bg-gray-50/50 space-y-2">
                    <span className="font-bold text-xs text-gray-800 block border-b pb-1 mb-1">🚗 Frota e Logística</span>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer"><input type="checkbox" name="p_frota_ver" defaultChecked /> Uso da Frota</label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer"><input type="checkbox" name="p_oficina_ver" defaultChecked /> Oficina</label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer"><input type="checkbox" name="p_garagem_ver" defaultChecked /> Garagem</label>
                  </div>

                </div>
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold p-2.5 rounded-lg text-sm transition shadow-md">Salvar Novo Nível de Acesso</button>
            </form>

            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 shrink-0">Cargos Configurados</h4>
            <div className="max-h-36 overflow-y-auto border rounded-xl divide-y px-3 bg-gray-50/50 mb-4 shrink-0">
              {cargosDisponiveis.map(cargo => (
                <div key={cargo.id} className="py-2 flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${cargo.color === 'blue' ? 'bg-blue-500' : cargo.color === 'green' ? 'bg-green-500' : cargo.color === 'purple' ? 'bg-purple-500' : cargo.color === 'orange' ? 'bg-orange-500' : cargo.color === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`}></span>
                    <span className="font-bold text-gray-800">{cargo.name}</span>
                  </div>
                  <form action={deletarCargo}>
                    <input type="hidden" name="roleId" value={cargo.id} />
                    <button type="submit" className="text-red-500 hover:bg-red-100 p-1 rounded-lg text-xs transition">🗑️ Excluir</button>
                  </form>
                </div>
              ))}
            </div>

            <div className="flex justify-end shrink-0">
              <Link href="/equipe" className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-lg font-bold text-sm transition text-center w-full sm:w-auto">Fechar Painel</Link>
            </div>
          </div>
        </div>
      )}

      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestão de Equipe</h1>
          <p className="text-gray-500 mt-1">Controle de acessos e cargos da Nexar Hub.</p>
        </div>
        {userToEdit && <Link href="/equipe" className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-300">Cancelar Edição</Link>}
      </header>

      {/* ERROS */}
      {successURL === "reset_ok" && <div className="bg-green-50 text-green-700 p-3 rounded-lg mb-6 border border-green-200">✅ Sucesso! Sistema resetado.</div>}
      {erroURL === "palavra_reset_invalida" && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-6 border border-red-200">⚠️ Palavra de confirmação incorreta.</div>}
      {erroURL === "username_exists" && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-6 border border-red-200">⚠️ Este Login já está sendo usado.</div>}
      {erroURL === "email_exists" && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-6 border border-red-200">⚠️ Este Email já está sendo usado.</div>}
      {erroURL === "admin_reserved" && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-6 border border-red-200">⚠️ A palavra "admin" é reservada.</div>}

      <form action={salvarUsuario} className={`p-6 rounded-xl shadow-sm border mb-8 ${userToEdit ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}>
        <h2 className={`text-xl font-bold mb-4 ${userToEdit ? 'text-blue-800' : 'text-gray-900'}`}>
          {userToEdit ? `Editando: ${userToEdit.name}` : 'Cadastrar Colaborador'}
        </h2>
        {userToEdit && <input type="hidden" name="id" value={userToEdit.id} />}
        
        {/* GRID DE 5 COLUNAS PARA ACOMODAR O EMAIL */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nome Completo</label>
            <input type="text" name="name" defaultValue={userToEdit?.name || ""} required className="w-full border border-gray-300 p-2 rounded-lg text-sm outline-none focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Login (Usuário)</label>
            <input type="text" name="username" defaultValue={userToEdit?.username || ""} required className="w-full border border-gray-300 p-2 rounded-lg text-sm outline-none focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Email (Opcional)</label>
            <input type="email" name="email" defaultValue={userToEdit?.email || ""} placeholder="Para login/recuperação" className="w-full border border-gray-300 p-2 rounded-lg text-sm outline-none focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Senha {userToEdit && <span className="text-gray-400 font-normal ml-1">(Vazio mantém)</span>}
            </label>
            <input type="text" name="password" required={!userToEdit} placeholder={userToEdit ? "••••••••" : "Senha"} className="w-full border border-gray-300 p-2 rounded-lg text-sm outline-none focus:ring-blue-500" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-gray-600">Nível de Acesso</label>
              <Link href="/equipe?action=gerenciar_cargos" className="text-[10px] text-blue-600 font-bold hover:underline">⚙️ Configurar</Link>
            </div>
            <select name="roleId" defaultValue={userToEdit?.roleId || ""} required className="w-full border border-gray-300 p-2 rounded-lg bg-white text-sm outline-none focus:ring-blue-500">
              <option value="" disabled>Selecione...</option>
              {cargosDisponiveis.map(cargo => <option key={cargo.id} value={cargo.id}>{cargo.name}</option>)}
            </select>
          </div>
          <button type="submit" className={`md:col-span-5 w-full text-white font-bold p-3 rounded-lg mt-2 ${userToEdit ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-900 hover:bg-slate-800'}`}>
            {userToEdit ? 'Atualizar Colaborador' : 'Adicionar à Equipe'}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-12">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Nome</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Usuário / Email</th>
              <th className="px-6 py-3 text-center font-medium text-gray-500 uppercase">Acesso / Cargo</th>
              <th className="px-6 py-3 text-center font-medium text-gray-500 uppercase">Gerenciar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {equipe.map((u) => {
              const corBadge = u.role?.color && badgeClasses[u.role.color] ? badgeClasses[u.role.color] : "bg-gray-100 text-gray-700 border-gray-200";
              return (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-bold text-gray-900">{u.name}</td>
                  <td className="px-6 py-4 text-gray-600">
                    <div>{u.username}</div>
                    {u.email && <div className="text-[10px] text-blue-500">{u.email}</div>}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${corBadge}`}>{u.role?.name || "Sem Cargo"}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center gap-3">
                      <Link href={`/equipe?edit=${u.id}`} className="text-blue-600 font-bold text-xs bg-blue-50 px-3 py-1.5 rounded border border-blue-100">Editar</Link>
                      <form action={deletarUsuario}>
                        <input type="hidden" name="id" value={u.id} />
                        <button type="submit" className="text-red-500 font-bold text-xs bg-red-50 px-3 py-1.5 rounded border border-red-100">Excluir</button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-xl font-bold text-red-800 mb-2">⚠️ Zona de Perigo: Factory Reset</h3>
        <p className="text-sm text-red-700 mb-4">Apaga tudo, exceto admin. Não pode ser desfeito.</p>
        <form action={resetarSistemaConfirmado} className="flex gap-4 items-end">
          <input type="text" name="confirmacao" required placeholder="Digite RESETAR" className="border border-red-300 p-2 rounded-lg text-red-900 flex-1" />
          <button type="submit" className="bg-red-600 text-white font-bold px-6 py-2 rounded-lg">Zerar Sistema</button>
        </form>
      </div>
    </div>
  );
}