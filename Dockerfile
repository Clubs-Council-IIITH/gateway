FROM node:18.7.0-slim

WORKDIR /gateway

COPY . .

RUN npm install

CMD npm start
