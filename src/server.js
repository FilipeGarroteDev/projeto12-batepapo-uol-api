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

const messageSchema = joi.object({
  to: joi.string().required(),
  text: joi.string().required(),
  type: joi.string().valid('message', 'private_message'),
});

server.post('/participants', async (req, res) => {
  const { name } = req.body;
  const validation = userSchema.validate(req.body);

  try {
    const hasUser = await db.collection('users').findOne({ name });

    if (validation.error) {
      return res
        .status(422)
        .send(
          'O nome de usuário é obrigatório. Por favor, insira um nome válido! :)'
        );
    }
    if (hasUser) {
      return res
        .status(409)
        .send(
          'Esse nome de usuário já está sendo utilizado. Por favor, escolha outro nome! :)'
        );
    }

    await db.collection('messages').insertOne({
      from: name,
      to: 'Todos',
      text: 'entra na sala...',
      type: 'status',
      time: dayjs(Date.now()).format('hh:mm:ss'),
    });
    await db.collection('users').insertOne({
      name,
      lastStatus: Date.now(),
    });
    return res.sendStatus(201);
  } catch (error) {
    return res.status(400).send(error.message);
  }
});

server.get('/participants', async (req, res) => {
  try {
    const users = await db.collection('users').find().toArray();
    return res.send(users);
  } catch (error) {
    return res.status(400).send(error.message);
  }
});

server.post('/messages', async (req, res) => {
  let message = req.body;
  const { user: from } = req.headers;
  const activeUser = await db.collection('users').findOne({ name: from });
  const validation = messageSchema.validate(message, { abortEarly: false });

  if (!activeUser || validation.error) {
    return res.sendStatus(422);
  }

  message = {
    ...message,
    from,
    time: dayjs(Date.now()).format('hh:mm:ss'),
  };
  await db.collection('messages').insertOne(message);
  return res.sendStatus(201);
});

server.get('/messages', async (req, res) => {
  const messages = await db.collection('messages').find().toArray();
  const { limit } = req.query;
  const { user } = req.headers;
  let lastMessages = messages;
  lastMessages = lastMessages.filter((value) => {
    return (
      value.type === 'status' ||
      value.type === 'message' ||
      (value.type === 'private_message' &&
        (value.to === user || value.from === user))
    );
  });

  if (limit) {
    lastMessages = lastMessages.slice(-limit);
  }

  res.send(lastMessages);
});

server.listen(5000, () => console.log('Listening on port 5000'));
