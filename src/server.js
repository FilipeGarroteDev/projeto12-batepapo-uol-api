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
  const hasUser = await db.collection('users').findOne({ name: req.body.name });

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
  try {
    await db.collection().insertOne({
      name,
      lastStatus: Date.now(),
    });
    return res.sendStatus(201);
  } catch (error) {
    return res.status(400).send(error.message);
  }
});

server.get('/participants', async (req, res) => {
  const users = await db.collection('users').find().toArray();
  return res.send(users);
});

server.post('/messages', async (req, res) => {
  let message = req.body;
  const { user } = req.headers;
  const activeUser = await db.collection('users').findOne({ name: user });
  const validation = messageSchema.validate(message);

  if (!activeUser || validation.error) {
    return res.sendStatus(422);
  }

  message = {
    ...message,
    time: dayjs(Date.now()).format('hh:mm:ss'),
  };
  await db.collection('messages').insertOne(message);
  return res.sendStatus(201);
});

// server.post('/messages', (req, res) => {
//   const { to, text, type } = req.body;
//   const { user: from } = req.headers;
//   const loggedUser = users.find((user) => user.name === from);

//   if (to === '' || text === '') {
//     console.log('to');
//     res.status(422).send('Você não pode mandar uma mensagem vazia.');
//     return;
//   }

//   if (type !== 'message' && type !== 'private_message') {
//     console.log('message');
//     res.sendStatus(422);
//     return;
//   }

//   if (loggedUser) {
//     console.log('logged');
//     res.sendStatus(422);
//     return;
//   }

//   const mensagem = {
//     to,
//     text,
//     type,
//     from,
//     time: formatado,
//   };

//   messages.push(mensagem);
//   res.send(messages);
// });

// server.get('/messages', (req, res) => {
//   const { limit } = req.query;
//   let lastMessages = messages;

//   if (limit) {
//     lastMessages = messages.slice(-limit);
//   }

//   res.send(lastMessages);
// });

server.listen(5000, () => console.log('Listening on port 5000'));
