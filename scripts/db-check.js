const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
  const uri = process.env.MONGODB_URI;
  console.log('Connecting to:', uri);
  await mongoose.connect(uri);
  console.log('Connected!');
  
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  console.log('Collections:');
  for (let col of collections) {
    const count = await db.collection(col.name).countDocuments();
    console.log(` - ${col.name}: ${count} documents`);
  }

  // print some products if any
  const products = await db.collection('products').find().limit(3).toArray();
  console.log('Sample Products:', products);

  // print some categories if any
  const categories = await db.collection('categories').find().limit(5).toArray();
  console.log('Sample Categories:', categories);

  await mongoose.disconnect();
}

check().catch(console.error);
