// src/app/components/MenuNavegacao.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MenuNavegacao({ roleUsuario, nomeUsuario }: { roleUsuario: string | undefined, nomeUsuario: string | undefined }) {
  const pathname = usePathname();

  // Função que verifica se a URL atual é a do link para ativar o visual de "Aba Selecionada"
  const isActive = (path: string) => pathname === path;

  // Estilos visuais
  const baseClass = "transition-all pb-1 border-b-2";
  const activeClass = "text-blue-400 border-blue-400 font-bold";
  const inactiveClass = "text-gray-300 border-transparent hover:text-blue-300 hover:border-blue-300/50";

  if (roleUsuario === 'INTERNO') {
    return (
      <>
        <Link href="/" className={`${baseClass} ${isActive('/') ? activeClass : inactiveClass}`}>Painel</Link>
        <Link href="/materiais" className={`${baseClass} ${isActive('/materiais') ? activeClass : inactiveClass}`}>Catálogo</Link>
        <Link href="/movimentacoes" className={`${baseClass} ${isActive('/movimentacoes') ? activeClass : inactiveClass}`}>Movimentações</Link>
        <Link href="/frota" className={`${baseClass} ${isActive('/frota') ? activeClass : inactiveClass}`}>Uso da Frota</Link>
        <Link href="/oficina" className={`${baseClass} ${isActive('/oficina') ? activeClass : inactiveClass}`}>Oficina</Link>
        <Link href="/veiculos" className={`${baseClass} ${isActive('/veiculos') ? activeClass : inactiveClass}`}>Garagem</Link>
        {nomeUsuario === 'Administrador Mestre' && (
           <Link href="/equipe" className={`${baseClass} ${isActive('/equipe') ? activeClass : inactiveClass}`}>Equipe</Link>
        )}
      </>
    );
  }

  return (
    <Link href="/pendencias" className={`${baseClass} ${isActive('/pendencias') ? activeClass : inactiveClass}`}>Minhas Pendências</Link>
  );
}