require("dotenv").config();
const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

const DIOGO_ID = "ba5d4352-bbfc-4c09-92a9-9ed1bfe5bbb9";
const DIOGO_NAME = "Diogo Viegas";
const SANDRO_ID = "barber-sandro-miguel";
const SANDRO_NAME = "Sandro Miguel";
const SANDRO_HASH = "$2b$12$9dloGkRVSrutg3hyXr8F6./fZt2Go3PRqfO0mRodsm/MU4L/9qLWS"; // Sandroadmin1

async function run() {
  console.log("=== Configuração Sandro Miguel e Multi-Barbeiro ===");

  const sandroUser = {
    _id: SANDRO_ID,
    id: SANDRO_ID,
    name: SANDRO_NAME,
    username: "sandro",
    email: "sandro@viegasbarber.pt",
    phone: "934172912",
    password: SANDRO_HASH,
    role: "BARBER",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // 1. Atualizar ficheiros locais JSON
  const usersPath = path.join(__dirname, "..", "data", "nosql", "users.json");
  if (fs.existsSync(usersPath)) {
    const users = JSON.parse(fs.readFileSync(usersPath, "utf8"));
    const idx = users.findIndex(u => u.id === SANDRO_ID || u.email === "sandro@viegasbarber.pt");
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...sandroUser };
    } else {
      users.push(sandroUser);
    }
    // Assegurar username no Diogo
    const diogo = users.find(u => u.id === DIOGO_ID || u.role === "ADMIN");
    if (diogo) diogo.username = "admin";

    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), "utf8");
    console.log("Local users.json atualizado!");
  }

  const apptsPath = path.join(__dirname, "..", "data", "nosql", "appointments.json");
  if (fs.existsSync(apptsPath)) {
    const appts = JSON.parse(fs.readFileSync(apptsPath, "utf8"));
    let updatedCount = 0;
    for (const a of appts) {
      if (!a.barber_id) {
        a.barber_id = DIOGO_ID;
        a.barber_name = DIOGO_NAME;
        updatedCount++;
      }
    }
    fs.writeFileSync(apptsPath, JSON.stringify(appts, null, 2), "utf8");
    console.log(`Local appointments.json atualizado (${updatedCount} marcações associadas ao Diogo)!`);
  }

  // 2. Atualizar MongoDB Atlas
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log("Aviso: MONGODB_URI não definido.");
    return;
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("viegas_barber");

    // Upsert Sandro
    await db.collection("users").updateOne(
      { $or: [{ id: SANDRO_ID }, { email: "sandro@viegasbarber.pt" }, { username: "sandro" }] },
      { $set: sandroUser },
      { upsert: true }
    );
    console.log("Atlas users: Sandro Miguel inserido/atualizado com sucesso!");

    // Garantir username admin no Diogo
    await db.collection("users").updateOne(
      { id: DIOGO_ID },
      { $set: { username: "admin" } }
    );

    // Atualizar marcações antigas no Atlas
    const res = await db.collection("appointments").updateMany(
      { $or: [{ barber_id: { $exists: false } }, { barber_id: null }] },
      { $set: { barber_id: DIOGO_ID, barber_name: DIOGO_NAME } }
    );
    console.log(`Atlas appointments: ${res.modifiedCount} marcações passadas associadas ao Diogo Viegas!`);

  } finally {
    await client.close();
  }

  console.log("Concluído com sucesso!");
}

run().catch(console.error);
