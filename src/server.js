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

server.listen(5000, () => console.log('Listening on port 5000'));
