# 🚀 CAR 시스템 PowerShell 배포 스크립트

Write-Host "🚀 CAR 시스템 배포 스크립트 시작..." -ForegroundColor Green
Write-Host ""

# 🔧 환경 설정
$env:NODE_ENV = "production"

try {
    Write-Host "📦 백엔드 의존성 설치..." -ForegroundColor Yellow
    npm install --production
    if ($LASTEXITCODE -ne 0) { throw "백엔드 의존성 설치 실패" }

    Write-Host "📦 프론트엔드 의존성 설치..." -ForegroundColor Yellow
    Set-Location frontend
    npm install
    if ($LASTEXITCODE -ne 0) { throw "프론트엔드 의존성 설치 실패" }

    Write-Host "🏗️ 프론트엔드 빌드..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "프론트엔드 빌드 실패" }

    Set-Location ..

    Write-Host "🗄️ 데이터베이스 마이그레이션..." -ForegroundColor Yellow
    Set-Location prisma
    npx prisma migrate deploy
    if ($LASTEXITCODE -ne 0) { throw "데이터베이스 마이그레이션 실패" }

    npx prisma generate
    if ($LASTEXITCODE -ne 0) { throw "Prisma 클라이언트 생성 실패" }

    Set-Location ..

    Write-Host "🧹 임시 파일 정리..." -ForegroundColor Yellow
    if (Test-Path "temp") { Remove-Item -Recurse -Force temp }
    if (Test-Path "logs\old") { Remove-Item -Recurse -Force logs\old }

    Write-Host "📁 필요한 디렉토리 생성..." -ForegroundColor Yellow
    if (!(Test-Path "logs")) { New-Item -ItemType Directory -Path "logs" }
    if (!(Test-Path "uploads")) { New-Item -ItemType Directory -Path "uploads" }

    Write-Host ""
    Write-Host "✅ 배포 완료!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎯 다음 단계:" -ForegroundColor Cyan
    Write-Host "1. 환경변수 파일(.env)을 프로덕션 설정으로 업데이트"
    Write-Host "2. JWT_SECRET을 보안성 높은 값으로 변경"
    Write-Host "3. 서버 시작: npm start"
    Write-Host ""

} catch {
    Write-Host "❌ 배포 실패: $_" -ForegroundColor Red
    exit 1
}

Read-Host "계속하려면 Enter를 누르세요" 