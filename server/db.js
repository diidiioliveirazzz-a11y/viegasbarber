const { MongoClient } = require("mongodb");
const nosql = require("./nosql");

/**
 * Universal NoSQL Database Adapter.
 * Uses official MongoDB client when MONGODB_URI is provided and reachable;
 * Otherwise uses the persistent embedded NoSQL document database engine.
 */

let mongoClient = null;
let mongoDb = null;
let useMongo = false;

async function initDb() {
  const uri = process.env.MONGODB_URI;
  if (uri) {
    try {
      mongoClient = new MongoClient(uri, { serverSelectionTimeoutMS: 2000 });
      await mongoClient.connect();
      mongoDb = mongoClient.db(process.env.MONGODB_DATABASE || "viegas_barber");
      useMongo = true;
      console.log(`[NoSQL] Ligado ao MongoDB com sucesso (${uri})`);
      return;
    } catch (err) {
      console.warn(`[NoSQL] Aviso: Não foi possível ligar ao MongoDB (${err.message}). A usar NoSQL Document Store embutido.`);
      useMongo = false;
    }
  } else {
    // console.log("[NoSQL] Modo NoSQL Document Store (armazenamento persistente em JSON ativado).");
  }
}

function collection(name) {
  if (useMongo && mongoDb) {
    return mongoDb.collection(name);
  }
  return nosql.collection(name);
}

const db = {
  collection,
  users: () => collection("users"),
  services: () => collection("services"),
  subscriptions: () => collection("subscriptions"),
  appointments: () => collection("appointments"),
  blocked_times: () => collection("blocked_times"),
  reviews: () => collection("reviews"),
  settings: () => collection("settings"),
  hair_styles: () => collection("hair_styles"),
  media_assets: () => collection("media_assets"),
  client_hair_history: () => collection("client_hair_history"),
  loyalty: () => collection("loyalty"),
  rewards: () => collection("rewards"),
  products: () => collection("products"),
  orders: () => collection("orders"),
  notifications: () => collection("notifications"),
  waitlist: () => collection("waitlist"),
  push_subscriptions: () => collection("push_subscriptions"),
  sessions: () => collection("sessions"),
};

module.exports = {
  initDb,
  collection,
  db,
};
