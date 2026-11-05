import express from 'express';
import { MongoClient } from 'mongodb';
import 'dotenv/config';
const app = express();
const PORT = 8000;
import cors from 'cors';

const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

app.use(express.json());
app.use(cors());

const mongoClient = await connectToMongoDB();
const db = mongoClient.db('studiospace-client');
const usersCollection = db.collection('users');

app.get('/', (req, res) => {
  res.send({ message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
