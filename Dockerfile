FROM node:22-slim

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

RUN npx prisma generate
RUN npx next build

EXPOSE 3000

CMD npx prisma db push --accept-data-loss && npm start
