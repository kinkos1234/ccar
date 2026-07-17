@echo off
echo Starting CAR System Backend Server...
set DATABASE_URL=file:./prisma/car_system.db
set JWT_SECRET=car_system_2024!@#_super_secret_key
set PORT=41100
node src/server.js 