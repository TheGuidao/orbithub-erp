// src/app/equipe/page.tsx
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

const prisma = new PrismaClient();

export default async function EquipePage(props: { searchParams: Promise<{ edit?: string, error?: string, success?: string }> }) {
  // --- SEGURANÇA MÁXIMA: BLOQUEIO DE ACESSO DIRETO PELA URL ---
  const cookieStore = await cookies();
  const nomeUsuario = cookieStore.get("usuario_nome")?.value;

  if (nomeUsuario !== 'Administrador Mestre') {
    redirect('/'); 
  }
  // ------------------------------------------------------------

  const searchParams = await props.searchParams;
  const editId = searchParams?.edit ? parseInt(searchParams.edit) : null;
  const erroURL = searchParams?.error; 
  const successURL = searchParams?.success;
  const userToEdit = editId ? await prisma.user.findUnique({ where: { id: editId } }) : null;

  const equipe = await prisma.user.findMany({ 
    where: { username: { not: 'admin' }, active: true },
    orderBy: { name: 'asc' } 
  });

  async function salvarUsuario(formData: FormData) {
    "use server";
    const id = formData.get("id") ? parseInt(formData.get("id") as string) : null;
    const name = formData.get("name") as string;
    const username = (formData.get("username") as string).trim();
    const password = (formData.get("password") as string).trim();
    const role = formData.get("role") as string;

    if (username.toLowerCase() === 'admin') {
      redirect("/equipe?error=admin_reserved");
    }

    const usuarioExistente = await prisma.user.findFirst({ where: { username, active: true } });
    if (usuarioExistente && usuarioExistente.id !== id) {
      redirect("/equipe?error=username_exists");
    }

    if (id) {
      const dataToUpdate: any = { name, username, role };
      if (password !== "") dataToUpdate.password = password; 
      await prisma.user.update({ where: { id }, data: dataToUpdate });
    } else {
      await prisma.user.create({ 
        data: { name, username, password, role, active: true } 
      });
    }
    
    revalidatePath("/equipe");
    redirect("/equipe");
  }

  async function deletarUsuario(formData: FormData) {
    "use server";
    const id = parseInt(formData.get("id") as string);
    
    const user = await prisma.user.findUnique({ where: { id } });
    if (user?.username === 'admin') {
      throw new Error("Operação não permitida.");
    }

    await prisma.user.update({ 
      where: { id }, 
      data: { 
        active: false, 
        username: `${user?.username}_excluido_${id}` 
      } 
    });

    revalidatePath("/equipe");
    redirect("/equipe");
  }

  // --- FUNÇÃO: FACTORY RESET (ESTADO ZERO) ---
  async function resetarSistemaConfirmado(formData: FormData) {
    "use server";
    const palavra = formData.get("confirmacao") as string;

    if (palavra !== "RESETAR") {
      redirect("/equipe?error=palavra_reset_invalida");
    }

    // 1. Apaga primeiro todos os históricos (por causa das relações)
    await prisma.transaction.deleteMany();
    await prisma.vehicleLog.deleteMany();
    await prisma.vehicleMaintenance.deleteMany();

    // 2. Apaga os cadastros base
    await prisma.material.deleteMany();
    await prisma.vehicle.deleteMany();

    // 3. Apaga a equipe toda (EXCETO o admin mestre)
    await prisma.user.deleteMany({
      where: { username: { not: 'admin' } }
    });

    // Limpa o cache de todas as páginas do sistema
    revalidatePath("/", "layout");
    redirect("/equipe?success=reset_ok");
  }

  return (
    <div className="p-4 md:p-8">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestão de Equipe</h1>
          <p className="text-gray-500 mt-1">Controle de acessos e cargos da Nexar Hub.</p>
        </div>
        {userToEdit && (
          <Link href="/equipe" className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium text-sm hover:bg-gray-300 transition">
            Cancelar Edição
          </Link>
        )}
      </header>

      {/* MENSAGENS DE SUCESSO E ERRO */}
      {successURL === "reset_ok" && (
        <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg mb-6 border border-green-200 font-medium">
          ✅ <strong>Sucesso!</strong> O sistema foi completamente resetado e voltou ao Estado Zero. Seu usuário Mestre foi mantido.
        </div>
      )}
      {erroURL === "palavra_reset_invalida" && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-6 border border-red-200 font-medium">
          ⚠️ <strong>Erro:</strong> Palavra de confirmação incorreta. O sistema NÃO foi resetado.
        </div>
      )}
      {erroURL === "username_exists" && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-6 border border-red-200 font-medium">
          ⚠️ <strong>Erro:</strong> Este Nome de Usuário (Login) já está sendo usado por outro colaborador ativo. Escolha um nome diferente.
        </div>
      )}
      {erroURL === "admin_reserved" && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-6 border border-red-200 font-medium">
          ⚠️ <strong>Erro:</strong> A palavra "admin" é reservada para o sistema. Você não pode utilizá-la.
        </div>
      )}

      {/* FORMULÁRIO DINÂMICO (CADASTRO / EDIÇÃO) */}
      <form action={salvarUsuario} className={`p-6 rounded-xl shadow-sm border mb-8 transition-all ${userToEdit ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}>
        <h2 className={`text-xl font-bold mb-4 ${userToEdit ? 'text-blue-800' : 'text-gray-900'}`}>
          {userToEdit ? `Editando Perfil: ${userToEdit.name}` : 'Cadastrar Novo Colaborador'}
        </h2>
        
        {userToEdit && <input type="hidden" name="id" value={userToEdit.id} />}
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nome Completo</label>
            <input type="text" name="name" defaultValue={userToEdit?.name || ""} required className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Login (Usuário)</label>
            <input type="text" name="username" defaultValue={userToEdit?.username || ""} required className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Senha {userToEdit && <span className="text-gray-400 font-normal ml-1">(Vazio para manter)</span>}
            </label>
            <input type="text" name="password" required={!userToEdit} placeholder={userToEdit ? "••••••••" : "Senha inicial"} className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nível de Acesso</label>
            <select name="role" defaultValue={userToEdit?.role || "TECNICO"} required className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
              <option value="TECNICO">Técnico (Acesso limitado às pendências)</option>
              <option value="INTERNO">Interno (Acesso administrativo completo)</option>
            </select>
          </div>
          <button type="submit" className={`md:col-span-4 w-full text-white font-bold p-3 rounded-lg mt-2 transition shadow-sm ${userToEdit ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-900 hover:bg-slate-800'}`}>
            {userToEdit ? 'Atualizar Colaborador' : 'Adicionar à Equipe'}
          </button>
        </div>
      </form>

      {/* TABELA DE COLABORADORES */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-12">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Nome</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Usuário</th>
              <th className="px-6 py-3 text-center font-medium text-gray-500 uppercase">Acesso</th>
              <th className="px-6 py-3 text-center font-medium text-gray-500 uppercase">Gerenciar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {equipe.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-500">Nenhum colaborador registrado.</td></tr>
            ) : (
              equipe.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-bold text-gray-900">{u.name}</td>
                  <td className="px-6 py-4 text-gray-600">{u.username}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-xs px-2 py-1 rounded-full font-bold ${u.role === 'INTERNO' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center gap-3">
                      <Link href={`/equipe?edit=${u.id}`} className="text-blue-600 font-bold text-xs bg-blue-50 px-3 py-1.5 rounded border border-blue-100 hover:bg-blue-100">
                        Editar
                      </Link>
                      {/* O ONSUBMIT FOI RETIRADO DAQUI */}
                      <form action={deletarUsuario}>
                        <input type="hidden" name="id" value={u.id} />
                        <button type="submit" className="text-red-500 font-bold text-xs bg-red-50 px-3 py-1.5 rounded border border-red-100 hover:bg-red-100">
                          Excluir
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ZONA DE PERIGO - RESET DO SISTEMA */}
      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-xl font-bold text-red-800 mb-2 flex items-center gap-2">
          ⚠️ Zona de Perigo: Factory Reset
        </h3>
        <p className="text-sm text-red-700 mb-4">
          Esta ação apagará <strong>todos</strong> os materiais, veículos, históricos de frota, movimentações de estoque e usuários cadastrados (exceto a sua conta mestre). O sistema voltará ao Estado Zero para testes limpos. <strong>Esta ação não pode ser desfeita.</strong>
        </p>
        <form action={resetarSistemaConfirmado} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs font-bold text-red-800 mb-1">Para confirmar, digite a palavra: RESETAR</label>
            <input
              type="text"
              name="confirmacao"
              required
              placeholder="Digite RESETAR em maiúsculo"
              className="w-full border border-red-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-red-500 bg-white placeholder-red-300 text-red-900 font-bold"
            />
          </div>
          <button
            type="submit"
            className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2 rounded-lg transition h-[42px]"
          >
            Zerar Todo o Sistema
          </button>
        </form>
      </div>

    </div>
  );
}