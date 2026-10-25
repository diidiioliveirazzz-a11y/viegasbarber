require("dotenv").config();
const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");

async function test() {
  console.log("=== Testes de Integração Multi-Barbeiro ===");

  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("viegas_barber");

  // 1. Verificar Barbeiros
  const barbers = await db.collection("users").find({ role: { $in: ["ADMIN", "BARBER"] } }).toArray();
  console.log("1. Barbeiros encontrados no sistema:", barbers.map(b => `${b.name} (${b.role}, username: ${b.username || b.role})`));

  const diogo = barbers.find(b => b.role === "ADMIN");
  const sandro = barbers.find(b => b.id === "barber-sandro-miguel");

  if (!diogo || !sandro) {
    throw new Error("Erro: Diogo ou Sandro não encontrados!");
  }

  // 2. Testar Login do Sandro
  const sandroPassMatch = await bcrypt.compare("Sandroadmin1", sandro.password);
  console.log("2. Verificação de password do Sandro (Sandroadmin1):", sandroPassMatch ? "SUCESSO ✅" : "FALHOU ❌");

  // 3. Verificar Marcações Passadas
  const withoutBarber = await db.collection("appointments").countDocuments({ barber_id: { $exists: false } });
  console.log("3. Marcações sem barber_id:", withoutBarber, withoutBarber === 0 ? "(Tudo associado! ✅)" : "");

  const diogoAppts = await db.collection("appointments").countDocuments({ barber_id: diogo.id });
  const sandroAppts = await db.collection("appointments").countDocuments({ barber_id: sandro.id });
  console.log(`4. Marcações do Diogo: ${diogoAppts} | Marcações do Sandro: ${sandroAppts}`);

  await client.close();
  console.log("=== Todos os testes concluídos com sucesso! ===");
}

test().catch(err => {
  console.error("Erro nos testes:", err);
  process.exit(1);
});
