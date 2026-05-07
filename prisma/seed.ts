// prisma/seed.ts
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      password: 'Guilherme@2609',
      active: true,
      role: 'INTERNO'
    },
    create: {
      name: 'Administrador Mestre',
      username: 'admin',
      password: 'Guilherme@2609',
      role: 'INTERNO',
      active: true,
    },
  });
  console.log("-----------------------------------------");
  console.log("SUCESSO: Usuário mestre configurado!");
  console.log("Usuário: " + admin.username);
  console.log("Senha: Guilherme@2609");
  console.log("-----------------------------------------");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });