const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function sync() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('No MONGODB_URI found, skipping Atlas sync');
    return;
  }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  
  const raw = fs.readFileSync(path.join(__dirname, '../data/nosql/hair_styles.json'), 'utf8');
  const styles = JSON.parse(raw);

  await db.collection('hair_styles').deleteMany({});
  await db.collection('hair_styles').insertMany(styles);
  
  const count = await db.collection('hair_styles').countDocuments();
  console.log(`Synced ${count} hair styles to MongoDB Atlas!`);
  await client.close();
}

sync().catch(console.error);
