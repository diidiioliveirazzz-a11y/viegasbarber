require("dotenv").config();
const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

async function updateInsta() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("viegas_barber");

  await db.collection("users").updateOne(
    { id: "barber-sandro-miguel" },
    { $set: { instagram: "sandro_miguel22_", updated_at: new Date().toISOString() } }
  );

  const u = await db.collection("users").findOne({ id: "barber-sandro-miguel" });
  console.log("Atlas Sandro user updated:", u.name, "Instagram:", u.instagram);

  await client.close();

  const usersPath = path.join(__dirname, "..", "data", "nosql", "users.json");
  if (fs.existsSync(usersPath)) {
    const users = JSON.parse(fs.readFileSync(usersPath, "utf8"));
    const s = users.find(x => x.id === "barber-sandro-miguel");
    if (s) {
      s.instagram = "sandro_miguel22_";
      s.updated_at = new Date().toISOString();
      fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), "utf8");
      console.log("Local users.json updated!");
    }
  }
}

updateInsta().catch(console.error);
