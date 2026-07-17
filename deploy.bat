@echo off
echo 🚀 CAR 시스템 배포 스크립트 시작...
echo.

REM 🔧 환경 설정
set NODE_ENV=production

echo 📦 의존성 설치...
call npm install --production
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 백엔드 의존성 설치 실패
    exit /b 1
)

echo 📦 프론트엔드 의존성 설치...
cd frontend
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 프론트엔드 의존성 설치 실패
    exit /b 1
)

echo 🏗️ 프론트엔드 빌드...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 프론트엔드 빌드 실패
    exit /b 1
)

cd ..

echo 🗄️ 데이터베이스 마이그레이션...
cd prisma
call npx prisma migrate deploy
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 데이터베이스 마이그레이션 실패
    exit /b 1
)

call npx prisma generate
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Prisma 클라이언트 생성 실패
    exit /b 1
)

cd ..

echo 🧹 임시 파일 정리...
if exist "temp" rmdir /s /q temp
if exist "logs\old" rmdir /s /q logs\old

echo 📁 필요한 디렉토리 생성...
if not exist "logs" mkdir logs
if not exist "uploads" mkdir uploads

echo ✅ 배포 완료!
echo.
echo 🎯 다음 단계:
echo 1. 환경변수 파일(.env)을 프로덕션 설정으로 업데이트
echo 2. JWT_SECRET을 보안성 높은 값으로 변경
echo 3. 서버 시작: npm start
echo.
pause 