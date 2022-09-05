/* eslint-disable consistent-return */
/* eslint-disable no-console, no-underscore-dangle, import/no-unresolved */

import dayjs from 'dayjs';
import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import joi from 'joi';
import dotenv from 'dotenv';
import { stripHtml } from 'string-strip-html';

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

async function removeParticipants() {
  try {
    const usersList = await db.collection('users').find().toArray();
    const kickedUsers = usersList.filter(
      (value) => Date.now() - Number(value.lastStatus) > 10000
    );

    if (kickedUsers) {
      kickedUsers.forEach(async (value) => {
        await db.collection('users').deleteOne({ _id: ObjectId(value._id) });
        await db.collection('messages').insertOne({
          from: value.name,
          to: 'Todos',
          text: 'sai da sala...',
          type: 'status',
          time: dayjs(Date.now()).format('hh:mm:ss'),
        });
      });
    }
  } catch (error) {
    console.log(error.message);
  }
}

setInterval(removeParticipants, 15000);

function isPublicMessages(message) {
  if (message.type === 'private_message') {
    return false;
  }
  return true;
}

function isUserPrivateMessages(message, user) {
  if (
    message.type === 'private_message' &&
    (message.to === user || message.from === user || message.to === 'Todos')
  ) {
    return true;
  }
  return false;
}

function sanitizedData(value) {
  if (!value) {
    return;
  }
  return stripHtml(value).result.trim();
}

server.post('/participants', async (req, res) => {
  const name = sanitizedData(req.body.name);
  const validation = userSchema.validate({ name });
  console.log(name);

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
  const { to, text, type } = req.body;
  const from = sanitizedData(req.headers.user);
  const validation = messageSchema.validate(message, { abortEarly: false });

  try {
    const activeUser = await db.collection('users').findOne({ name: from });

    if (!activeUser || validation.error) {
      return res.sendStatus(422);
    }
    message = {
      to: sanitizedData(to),
      text: sanitizedData(text),
      type: sanitizedData(type),
      from,
      time: dayjs(Date.now()).format('hh:mm:ss'),
    };

    await db.collection('messages').insertOne(message);
    return res.sendStatus(201);
  } catch (error) {
    return res.status(400).send(error.message);
  }
});

server.get('/messages', async (req, res) => {
  const { limit } = req.query;
  const { user } = req.headers;
  const cleanedUser = sanitizedData(user);

  try {
    const messages = await db.collection('messages').find().toArray();
    let lastMessages = messages;
    lastMessages = lastMessages.filter((value) => {
      return (
        isPublicMessages(value) || isUserPrivateMessages(value, cleanedUser)
      );
    });

    if (limit) {
      lastMessages = lastMessages.slice(-Number(limit));
      if (Number(limit) === 0) {
        lastMessages = [];
      }
    }

    res.send(lastMessages);
  } catch (error) {
    res.status(400).send(error.message);
  }
});

server.post('/status', async (req, res) => {
  const user = sanitizedData(req.headers.user);

  try {
    const activeUser = await db.collection('users').findOne({ name: user });

    if (!activeUser) {
      return res.sendStatus(404);
    }

    const lastStatus = Date.now();
    await db
      .collection('users')
      .updateOne({ name: user }, { $set: { lastStatus } });

    return res.sendStatus(200);
  } catch (error) {
    return res.status(400).send(error.message);
  }
});

server.delete('/messages/:id', async (req, res) => {
  const { id } = req.params;
  const { user } = req.headers;
  const cleanedUser = sanitizedData(user);
  try {
    const message = await db
      .collection('messages')
      .findOne({ _id: ObjectId(id) });

    if (!message) {
      return res.status(404).send('Mensagem não encontrada. :(');
    }
    if (message.from !== cleanedUser) {
      return res
        .status(401)
        .send(
          'Você não é o dono dessa mensagem e, portanto, não pode deletá-la! :('
        );
    }
    await db.collection('messages').deleteOne({ _id: ObjectId(id) });
    return res.status(200).send('Mensagem apagada com sucesso! :)');
  } catch (error) {
    return res.status(400).send(error.message);
  }
});

server.put('/messages/:id', async (req, res) => {
  let message = req.body;
  const { to, text, type } = req.body;
  const from = sanitizedData(req.headers.user);
  const { id } = req.params;
  const validation = messageSchema.validate(message, { abortEarly: false });

  try {
    const activeUser = await db.collection('users').findOne({ name: from });
    const sentMessage = await db
      .collection('messages')
      .findOne({ _id: ObjectId(id) });

    if (!activeUser || validation.error) {
      return res.sendStatus(422);
    }
    if (!sentMessage) {
      return res.status(404).send('Mensagem não encontrada. :(');
    }
    if (sentMessage.from !== from) {
      return res
        .status(401)
        .send(
          'Você não é o dono dessa mensagem e, portanto, não pode deletá-la! :('
        );
    }

    message = {
      to: sanitizedData(to),
      text: sanitizedData(text),
      type: sanitizedData(type),
      from,
      time: dayjs(Date.now()).format('hh:mm:ss'),
    };
    await db
      .collection('messages')
      .updateOne({ _id: ObjectId(id) }, { $set: message });
    return res.sendStatus(201);
  } catch (error) {
    return res.status(400).send(error.message);
  }
});

server.listen(5000, () => console.log('Listening on port 5000'));
