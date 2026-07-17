Write-Host "Starting CAR System Backend Server..." -ForegroundColor Green
$env:DATABASE_URL="file:./prisma/car_system.db"
$env:JWT_SECRET="car_system_2024!@#_super_secret_key"
$env:PORT="41100"
Write-Host "Environment variables set:" -ForegroundColor Yellow
Write-Host "DATABASE_URL: $env:DATABASE_URL" -ForegroundColor Cyan
Write-Host "PORT: $env:PORT" -ForegroundColor Cyan
node src/server.js 