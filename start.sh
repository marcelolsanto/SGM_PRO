#!/bin/bash
set -e

echo "========================================="
echo "🚀 INICIANDO SGM.PRO"
echo "========================================="

# 1. Garante que o diretório de uploads existe
mkdir -p /workspace/BACKEND/uploads

# 2. Inicia o Backend Go em segundo plano
echo "🔧 Iniciando Backend Go na porta 8080..."
cd /workspace/BACKEND
go run main.go &
BACKEND_PID=$!

# 3. Prepara e inicia o Frontend React
echo "📦 Verificando dependências do Frontend..."
cd /workspace/FRONTEND
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
  npm install
fi

echo "✨ Iniciando Frontend React na porta 5173..."
npm run dev -- --host 0.0.0.0 --port 5173 &
FRONTEND_PID=$!

# Aguarda os processos
wait -n $BACKEND_PID $FRONTEND_PID
