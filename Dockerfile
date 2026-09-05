# Usa a imagem oficial do Go (Debian Bookworm) como base
FROM golang:1.22-bookworm

# Atualiza o sistema e prepara para instalar o Node.js
RUN apt-get update && apt-get install -y curl gnupg

# Baixa e instala o Node.js (Versão 20 LTS)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Define a pasta onde o seu código vai ficar dentro do container
WORKDIR /workspace