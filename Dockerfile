FROM node:lts-alpine
WORKDIR /app
EXPOSE 3030
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "start"]
RUN chmod +x /app/node_modules/.bin/nodemon
