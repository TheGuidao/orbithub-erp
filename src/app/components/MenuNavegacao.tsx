// src/app/components/MenuNavegacao.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "next";

export default function MenuNavegacao({ roleUsuario, nomeUsuario }: { roleUsuario: string | undefined, nomeUsuario: string | undefined }) {
  const pathname = usePathname();
  const [permissions, setPermissions] = useState<any>({});

  // Lemos o cookie de permissões no lado do cliente
  useEffect(() => {
    const cookies = document.cookie.split(';');
    const permCookie = cookies.find(c => c.trim().startsWith('usuario_permissions='));
    if (permCookie) {
      try {
        setPermissions(JSON.parse(decodeURIComponent(permCookie.split('=')[1])));
      } catch(e) {}
    }
  }, []);

  const isActive = (path: string) => pathname === path;
  const baseClass = "transition-all pb-1 border-b-2";
  const activeClass = "text-blue-400 border-blue-400 font-bold";
  const inactiveClass = "text-gray-300 border-transparent hover:text-blue-300 hover:border-blue-300/50";

  const isMaster = nomeUsuario === 'Administrador Mestre' || permissions.master === true;

  // Se o cara não pode ver o painel nem os serviços, significa que ele é um técnico de campo puro
  if (!isMaster && permissions.painel?.ver !== true && permissions.servicos?.ver !== true) {
    return <Link href="/pendencias" className={`${baseClass} ${isActive('/pendencias') ? activeClass : inactiveClass}`}>Minhas Pendências</Link>;
  }

  return (
    <>
      {(isMaster || permissions.painel?.ver) && <Link href="/" className={`${baseClass} ${isActive('/') ? activeClass : inactiveClass}`}>Painel</Link>}
      {(isMaster || permissions.servicos?.ver) && <Link href="/obras" className={`${baseClass} ${isActive('/obras') ? activeClass : inactiveClass}`}>Serviços e Agendas</Link>}
      {(isMaster || permissions.catalogo?.ver) && <Link href="/materiais" className={`${baseClass} ${isActive('/materiais') ? activeClass : inactiveClass}`}>Catálogo</Link>}
      {(isMaster || permissions.movimentacoes?.ver) && <Link href="/movimentacoes" className={`${baseClass} ${isActive('/movimentacoes') ? activeClass : inactiveClass}`}>Movimentações</Link>}
      {(isMaster || permissions.frota?.ver) && <Link href="/frota" className={`${baseClass} ${isActive('/frota') ? activeClass : inactiveClass}`}>Uso da Frota</Link>}
      {(isMaster || permissions.oficina?.ver) && <Link href="/oficina" className={`${baseClass} ${isActive('/oficina') ? activeClass : inactiveClass}`}>Oficina</Link>}
      {(isMaster || permissions.garagem?.ver) && <Link href="/veiculos" className={`${baseClass} ${isActive('/veiculos') ? activeClass : inactiveClass}`}>Garagem</Link>}
      {(isMaster || permissions.equipe?.ver) && <Link href="/equipe" className={`${baseClass} ${isActive('/equipe') ? activeClass : inactiveClass}`}>Equipe</Link>}
    </>
  );
}