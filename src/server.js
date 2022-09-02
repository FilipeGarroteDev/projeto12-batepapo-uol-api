/* eslint-disable no-console */

import dayjs from 'dayjs';
import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import joi from 'joi';
import dotenv from 'dotenv';

dotenv.config();

const server = express();
server.use(express.json());
server.use(cors());
const mongoClient = new MongoClient(process.env.MONGO_URI);

let db;

mongoClient.connect().then(() => {
  db = mongoClient.db('batepapouol');
});

const userSchema = joi.object({
  name: joi.string().required(),
});

server.post('/participants', async (req, res) => {
  const { name } = req.body;
  const validation = userSchema.validate(req.body);
  const users = await db.collection('users').find().toArray();

  if (validation.error) {
    return res
      .status(422)
      .send(
        'O nome de usuário é obrigatório. Por favor, insira um nome válido! :)'
      );
  }
  if (users.find((value) => value.name === name)) {
    return res
      .status(409)
      .send(
        'Esse nome de usuário já está sendo utilizado. Por favor, escolha outro nome! :)'
      );
  }
  try {
    await db.collection('users').insertOne({
      name,
      lastStatus: Date.now(),
    });
    return res.sendStatus(201);
  } catch (error) {
    return res.status(400).send(error.message);
  }
});

server.listen(5000, () => console.log('Listening on port 5000'));
