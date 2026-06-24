// src/app/login/page.tsx
import { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const prisma = new PrismaClient();

export default async function LoginPage(props: { searchParams: Promise<{ error?: string }> }) {
  const searchParams = await props.searchParams;
  const erro = searchParams?.error;

  async function fazerLogin(formData: FormData) {
    "use server";
    
    const loginInput = (formData.get("loginInput") as string).trim();
    const password = (formData.get("password") as string).trim();

    // ✅ MESTRE HARDCODED: O usuário admin/admin é reconhecido diretamente aqui,
    // sem precisar estar no banco. Isso garante que o acesso nunca seja perdido
    // mesmo após um reset total do sistema.
    if (loginInput === "admin" && password === "admin") {
      const masterPermissions = {
        master: true,
        painel: { ver: true },
        servicos: { ver: true, criar: true, excluir: true },
        catalogo: { ver: true, criar: true, excluir: true },
        movimentacoes: { ver: true, lancar: true },
        frota: { ver: true },
        oficina: { ver: true },
        garagem: { ver: true },
        equipe: { ver: true }
      };
      const cookieStore = await cookies();
      cookieStore.set("usuario_id", "0", { maxAge: 60 * 60 * 24 * 7, path: "/" });
      cookieStore.set("usuario_nome", "Administrador", { maxAge: 60 * 60 * 24 * 7, path: "/" });
      cookieStore.set("usuario_role", "INTERNO", { maxAge: 60 * 60 * 24 * 7, path: "/" });
      cookieStore.set("usuario_permissions", JSON.stringify(masterPermissions), { maxAge: 60 * 60 * 24 * 7, path: "/" });
      redirect("/");
    }

    // --- AUTO-SEED: Cria o primeiro usuário real se o banco estiver vazio ---
    const usersCount = await prisma.user.count();
    if (usersCount === 0) {
      const adminRole = await prisma.role.create({
        data: {
          name: "Gerente Geral",
          color: "blue",
          permissions: { master: true } 
        }
      });
      const firstUser = await prisma.user.create({
        data: {
          name: loginInput.includes("@") ? "Administrador" : loginInput,
          username: loginInput.includes("@") ? "gerente" : loginInput,
          email: loginInput.includes("@") ? loginInput : null,
          password: password,
          roleId: adminRole.id
        },
        include: { role: true }
      });
      
      const cookieStore = await cookies();
      cookieStore.set("usuario_id", String(firstUser.id), { maxAge: 60 * 60 * 24 * 7, path: "/" });
      cookieStore.set("usuario_nome", firstUser.name, { maxAge: 60 * 60 * 24 * 7, path: "/" });
      cookieStore.set("usuario_role", "INTERNO", { maxAge: 60 * 60 * 24 * 7, path: "/" });
      
      const fullPermissions = { master: true, painel: {ver:true}, servicos: {ver:true, criar:true, excluir:true}, catalogo: {ver:true, criar:true, excluir:true}, movimentacoes: {ver:true, lancar:true}, frota: {ver:true}, oficina: {ver:true}, garagem: {ver:true}, equipe: {ver:true} };
      cookieStore.set("usuario_permissions", JSON.stringify(fullPermissions), { maxAge: 60 * 60 * 24 * 7, path: "/" });

      redirect("/");
    }
    // ----------------------------------------------------------------------

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: loginInput },
          { username: loginInput }
        ],
        password: password,
        active: true 
      },
      include: { role: true }
    });

    if (!user) {
      redirect("/login?error=1");
    }

    const cookieStore = await cookies();
    cookieStore.set("usuario_id", String(user.id), { maxAge: 60 * 60 * 24 * 7, path: "/" });
    cookieStore.set("usuario_nome", user.name, { maxAge: 60 * 60 * 24 * 7, path: "/" });
    
    // ✅ CORRIGIDO: isMaster agora usa APENAS permissions.master do cargo,
    // não depende mais do nome do usuário.
    const isMaster = (user.role?.permissions as any)?.master === true;
      
    cookieStore.set("usuario_role", isMaster ? "INTERNO" : "TECNICO", { maxAge: 60 * 60 * 24 * 7, path: "/" });
    
    if (isMaster) {
      const masterPermissions = {
        master: true,
        painel: { ver: true },
        servicos: { ver: true, criar: true, excluir: true },
        catalogo: { ver: true, criar: true, excluir: true },
        movimentacoes: { ver: true, lancar: true },
        frota: { ver: true },
        oficina: { ver: true },
        garagem: { ver: true },
        equipe: { ver: true }
      };
      cookieStore.set("usuario_permissions", JSON.stringify(masterPermissions), { maxAge: 60 * 60 * 24 * 7, path: "/" });
    } else if (user.role?.permissions) {
      cookieStore.set("usuario_permissions", JSON.stringify(user.role.permissions), { maxAge: 60 * 60 * 24 * 7, path: "/" });
    } else {
      cookieStore.set("usuario_permissions", JSON.stringify({}), { maxAge: 60 * 60 * 24 * 7, path: "/" });
    }

    redirect("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-1">
          Estoque <span className="text-blue-500">Nexar Hub</span>
        </h1>
        <p className="text-center text-gray-500 text-sm mb-6">
          Acesso restrito a colaboradores internos
        </p>

        {erro && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center mb-6 border border-red-100 font-medium">
            Usuário/Email ou senha incorretos.
          </div>
        )}

        <form action={fazerLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Email ou Usuário</label>
            <input 
              type="text" 
              name="loginInput" 
              required 
              placeholder="seu@email.com ou seunome" 
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Senha</label>
            <input 
              type="password" 
              name="password" 
              required 
              placeholder="••••••••" 
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-slate-900 text-white font-bold rounded-lg p-3 mt-2 hover:bg-slate-800 transition-colors"
          >
            Entrar no Sistema
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Esqueceu sua senha? Solicite ao administrador.
        </p>
      </div>
    </div>
  );
}