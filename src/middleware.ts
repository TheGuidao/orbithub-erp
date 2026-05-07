// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const cookieUsuario = request.cookies.get('usuario_id');
  const isLoginPage = request.nextUrl.pathname === '/login';

  // console.log("Middleware rodando na rota:", request.nextUrl.pathname);

  // Se não estiver logado e não for a página de login, força o redirecionamento
  if (!cookieUsuario && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Se já estiver logado e tentar ir para o login, manda para o painel
  if (cookieUsuario && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};