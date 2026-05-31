# Menggunakan image Node.js yang ringan
FROM node:20-alpine

# Menginstal OpenSSL (Wajib untuk Prisma di Alpine)
RUN apk add --no-cache openssl

# Set direktori kerja di dalam container
WORKDIR /app

# Menyalin package.json dan package-lock.json (jika ada)
COPY package*.json ./

# Menginstal dependensi
RUN npm install

# Menyalin seluruh folder server ke dalam container
COPY . .

# Menjalankan Prisma Generate (Sangat Penting untuk Supabase/Postgres)
RUN npx prisma generate

# Mengompilasi TypeScript ke JavaScript (folder dist)
RUN npm run build

# Menentukan port yang akan digunakan Cloud Run (standar 8080)
ENV PORT=8080
EXPOSE 8080

# Menjalankan server
CMD ["npm", "start"]
