require("dotenv").config();
const bcrypt = require("bcryptjs");
const { initDb, db } = require("./db");
const { id, WEEK_SCHEDULE } = require("./lib");

async function seed() {
  await initDb();

  const settingsCol = db.settings();
  const existingSettings = await settingsCol.findOne({ id: "default" });
    if (!existingSettings) {
      await settingsCol.insertOne({
        id: "default",
        minAdvanceHours: 4,
      lunchStart: "13:00",
      lunchEnd: "13:30",
      barberName: "Diogo Viegas",
      shopName: "Viegas Barber",
      address: "Centro comercial São Julião , Setúbal",
      phone: "+351 939 504 261",
      whatsapp: "+351 939 504 261",
      instagram: "v_barber8",
      schedule: WEEK_SCHEDULE,
    });
    console.log("[NoSQL Seed] Definições padrão criadas com horário semanal.");
  }

  const servicesCol = db.services();
  const servicesCount = await servicesCol.countDocuments({});
  if (servicesCount === 0) {
    const defaultServices = [
      {
        id: "srv-corte-12",
        name: "Corte",
        description: "Corte de cabelo contemporâneo à máquina ou tesoura com degradê e acabamento de alta precisão.",
        price: 12.0,
        duration: 45,
        isActive: true,
      },
      {
        id: "srv-corte-sobrancelha-14",
        name: "Corte + Sobrancelha",
        description: "Corte completo com alinhamento e limpeza precisa de sobrancelhas a lâmina/navalha.",
        price: 14.0,
        duration: 45,
        isActive: true,
      },
      {
        id: "srv-corte-sobrancelha-tinta-16",
        name: "Corte + Sobrancelha + Tinta",
        description: "Corte, definição de sobrancelha e aplicação de tinta/pigmentação para acabamento nítido e impecável.",
        price: 16.0,
        duration: 45,
        isActive: true,
      },
      {
        id: "srv-corte-barba-17",
        name: "Corte + Barba",
        description: "A combinação clássica: corte de cabelo perfeito aliado à modelação e cuidado completo da barba.",
        price: 17.0,
        duration: 45,
        isActive: true,
      },
      {
        id: "srv-pack-completo-18",
        name: "Pack Completo",
        description: "A experiência total de cuidado masculino: corte, barba, sobrancelha e finalização de excelência.",
        price: 18.0,
        duration: 45,
        isActive: true,
      },
    ];
    await servicesCol.insertMany(defaultServices);
    console.log("[NoSQL Seed] Novo preçário de serviços inserido.");
  }

  const prodCol = db.products();
  const prodCount = await prodCol.countDocuments({});
  if (prodCount === 0) {
    const defaultProducts = [
      {
        id: id(),
        name: "Matte Clay Viegas Barber",
        description: "Cera modeladora com acabamento mate natural e fixação forte de longa duração.",
        price: 16.5,
        stock: 18,
        category: "Ceras",
        imageUrl: "https://images.unsplash.com/photo-1585751119414-ef2636f8aede?auto=format&fit=crop&w=600&q=80",
      },
      {
        id: id(),
        name: "Pomada Pomade Classic Shine",
        description: "Fórmula à base de água que confere brilho clássico sem resíduos gordurosos.",
        price: 15.0,
        stock: 12,
        category: "Pomadas",
        imageUrl: "https://images.unsplash.com/photo-1598452963314-b09f397a5c48?auto=format&fit=crop&w=600&q=80",
      },
      {
        id: id(),
        name: "Óleo Fortificante de Barba",
        description: "Mistura nutritiva de óleos de argão e jojoba para hidratar fios e pele.",
        price: 14.0,
        stock: 25,
        category: "Barba",
        imageUrl: "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=600&q=80",
      },
      {
        id: id(),
        name: "Shampoo Revitalizante Mentolado",
        description: "Sensação refrescante imediata e limpeza profunda para couro cabeludo masculino.",
        price: 13.5,
        stock: 14,
        category: "Shampoos",
        imageUrl: "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=600&q=80",
      },
    ];
    await prodCol.insertMany(defaultProducts);
    console.log("[NoSQL Seed] Produtos inseridos.");
  }

  const rewardsCol = db.rewards();
  await rewardsCol.deleteMany({});
  const defaultRewards = [
    {
      id: "rew-corte-3eur",
      title: "Desconto de 3€ no Corte",
      description: "Ao fim de 5 cortes realizados na Viegas Barber, tens direito a 3€ de desconto direto no teu próximo corte de cabelo.",
      cutsRequired: 5,
      discountValue: 3.0,
      rewardType: "HAIRCUT_DISCOUNT",
      pointsCost: 5,
      isActive: true,
    },
    {
      id: "rew-cera-4eur",
      title: "Desconto de 4€ na Cera",
      description: "Ao fim de 5 cortes realizados na Viegas Barber, podes optar por 4€ de desconto direto na compra de qualquer cera para cabelo.",
      cutsRequired: 5,
      discountValue: 4.0,
      rewardType: "PRODUCT_DISCOUNT",
      pointsCost: 5,
      isActive: true,
    },
  ];
  await rewardsCol.insertMany(defaultRewards);
  console.log("[NoSQL Seed] Recompensas de fidelidade atualizadas (5 cortes = 3€ corte ou 4€ cera).");

  const usersCol = db.users();
  const admin = await usersCol.findOne({ role: "ADMIN" });
  if (!admin) {
    const password = process.env.ADMIN_PASSWORD || "ViegasAdmin1";
    const hashed = await bcrypt.hash(password, 12);
    await usersCol.insertOne({
      id: id(),
      name: "Diogo Viegas",
      email: "admin@instagram.user",
      password: hashed,
      role: "ADMIN",
    });
    console.log(`[NoSQL Seed] Conta ADMIN criada. Instagram: admin | Palavra-passe: ${password}`);
  }

  console.log("[NoSQL Seed] Base de dados NoSQL atualizada com sucesso!");
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seed };
