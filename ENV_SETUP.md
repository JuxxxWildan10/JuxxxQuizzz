# EduBattle — Environment Variables

## Server (GCP Cloud Run)
Copy file ini menjadi `.env` di folder `server/`, lalu isi nilainya.

```env
PORT=4000
NODE_ENV=production

# Database PostgreSQL (dari Supabase)
# Dapatkan di: supabase.com -> Project Settings -> Database -> URI
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres"

# JWT Secret — gunakan string acak yang panjang dan kuat
# Generator: https://generate-secret.vercel.app/32
JWT_SECRET="ganti-dengan-32-karakter-acak-minimum"
JWT_EXPIRES="7d"

# Gemini AI API Key
# Dapatkan di: aistudio.google.com/app/apikey
GEMINI_API_KEY="AIza..."

# CORS — URL frontend Vercel kamu (pisah koma jika lebih dari satu)
ALLOWED_ORIGINS="https://juxxxquizzz.vercel.app,http://localhost:3000"
```

## Client (Vercel)
Tambahkan di Vercel Dashboard -> Project Settings -> Environment Variables

```env
# URL backend GCP Cloud Run kamu
NEXT_PUBLIC_SOCKET_URL="https://edubattle-server-xxxxxxxxxx-as.a.run.app"
```
