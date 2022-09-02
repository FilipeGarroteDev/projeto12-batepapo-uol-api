/* eslint-disable no-console */

import dayjs from 'dayjs';
import express from 'express';
import cors from 'cors';

const server = express();
server.use(express.json());
server.use(cors());

server.listen(5000, () => console.log('Listening on port 5000'));
