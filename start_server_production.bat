@echo off
title CAR System Production Server

echo 🚀 CAR 시스템 프로덕션 서버 시작...
echo.

REM 🔧 프로덕션 환경 설정
set NODE_ENV=production
set NODE_OPTIONS=--max-old-space-size=2048

REM 📊 시스템 정보 출력
echo 🖥️ 시스템 정보:
echo - Node.js 버전: 
node --version
echo - 환경: %NODE_ENV%
echo - 메모리 제한: 2048MB
echo - 시작 시간: %date% %time%
echo.

REM 🗄️ 데이터베이스 상태 확인
echo 🗄️ 데이터베이스 연결 확인...
if not exist "prisma\car_system.db" (
    echo ❌ 데이터베이스 파일이 없습니다. 마이그레이션을 실행하세요.
    pause
    exit /b 1
)

REM 📁 필요한 디렉토리 확인
if not exist "logs" mkdir logs
if not exist "uploads" mkdir uploads

REM 🎯 프론트엔드 빌드 확인
if not exist "frontend\.next" (
    echo ⚠️ 프론트엔드가 빌드되지 않았습니다.
    echo 빌드를 진행하시겠습니까? (Y/N)
    set /p build_choice=
    if /i "%build_choice%"=="Y" (
        echo 🏗️ 프론트엔드 빌드 중...
        cd frontend
        call npm run build
        if %ERRORLEVEL% NEQ 0 (
            echo ❌ 빌드 실패
            pause
            exit /b 1
        )
        cd ..
    ) else (
        echo ❌ 빌드 없이는 서버를 시작할 수 없습니다.
        pause
        exit /b 1
    )
)

echo ✅ 모든 사전 확인 완료
echo.

REM 🚀 서버 시작
echo 🚀 백엔드 서버 시작 중... (포트: 41100)
echo 🌐 프론트엔드 서버 시작 중... (포트: 41000)
echo.
echo 📝 로그는 logs 폴더에 저장됩니다.
echo 🛑 서버 중지: Ctrl+C
echo.

REM 백엔드와 프론트엔드를 동시에 시작
start "CAR Backend" /min cmd /c "set PORT=41100 && node src/server.js > logs/backend.log 2>&1"
timeout /t 3 /nobreak > nul

cd frontend
start "CAR Frontend" /min cmd /c "set PORT=41000 && npm start > ../logs/frontend.log 2>&1"
cd ..

echo 🎯 서버가 시작되었습니다!
echo - 백엔드: http://localhost:41100
echo - 프론트엔드: http://localhost:41000
echo.
echo 📊 실시간 로그를 보려면:
echo - 백엔드: tail -f logs/backend.log
echo - 프론트엔드: tail -f logs/frontend.log
echo.

pause 