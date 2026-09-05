# SGM.PRO - Sistema de Gestão de Medições e Operações Técnicas

> **SaaS & Marketplace B2B2C** de alta precisão para marcenarias de alto padrão, lojas de móveis planejados, escritórios de arquitetura e profissionais de medição técnica de obras.

---

## 📌 Visão Geral do Sistema

O **SGM.PRO** digitaliza e automatiza todo o ciclo operacional que antecede a produção e montagem de móveis sob medida:
1. **Lojas / Marcenarias**: Cadastram clientes e lançam Ordens de Serviço (OS) com múltiplos ambientes (m², complexidade técnica, plantas arquitetônicas em PDF).
2. **Cliente Final (Sem Login)**: Recebe um **Link Mágico** seguro (`/cliente/:token`) para conferir o projeto, agendar data/hora da visita, preencher o checklist de briefing e assinar os termos.
3. **Medidores Técnicos de Campo**: Visualizam medições liberadas em um radar de demandas geolocalizado, aceitam a OS, traçam rotas com Google Maps, realizam check-in na obra e anexam arquivos/medidas finais.
4. **Administrador Geral**: Painel completo de Business Intelligence (BI) para controle de faturamento, custo dos medidores, margem líquida real, ticket médio e controle de SLAs (15 dias).

---

## 🛠️ Stack Tecnológica

### Backend
* **Linguagem**: [Go (Golang) 1.22+](https://go.dev/)
* **Web Framework**: [Fiber v2](https://gofiber.io/)
* **ORM & Banco de Dados**: [GORM](https://gorm.io/) com driver PostgreSQL
* **Autenticação**: JWT (JSON Web Tokens) com claims RBAC (`ADMIN`, `LOJA`, `MEDIDOR`) + Bcrypt
* **Integrações**: Google Maps Distance Matrix API (cálculo de frete e deslocamento por km)
* **Arquitetura**: Padrão MVC (Config, Models, Services, Controllers, Routes, Middlewares, Utils)

### Frontend
* **Framework**: [React 19](https://react.dev/)
* **Build Tool**: [Vite 7](https://vitejs.dev/)
* **Estilização**: [Tailwind CSS 4](https://tailwindcss.com/) (Design System Dark Mode responsivo)
* **Comunicação HTTP**: Axios

### Infraestrutura
* **Containerização**: Docker & Docker Compose
* **Ambiente de Dev**: Hot-reload via Air (Go) e Vite HMR (React)

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
* [Git](https://git-scm.com/)
* [Docker](https://www.docker.com/) e [Docker Compose](https://docs.docker.com/compose/) **OU** [Go 1.22+](https://go.dev/) + [Node.js 20+](https://nodejs.org/) + [PostgreSQL](https://www.postgresql.org/)

---

### Opção 1: Execução com Docker (Recomendado)

1. Clone o repositório:
```bash
git clone https://github.com/SEU_USUARIO/SGM_PRO.git
cd SGM_PRO
```

2. Configure o arquivo de ambiente do Backend:
```bash
cp BACKEND/.env.example BACKEND/.env
```

3. Inicie os containers com Docker Compose:
```bash
docker-compose up --build
```

* Backend estará disponível em: `http://localhost:8080`
* Frontend estará disponível em: `http://localhost:5173`

---

### Opção 2: Execução Local (Sem Docker)

#### 1. Banco de Dados
Certifique-se de ter um banco de dados PostgreSQL rodando localmente e crie a base de dados `sgm_db`.

#### 2. Backend (Go)
```bash
cd BACKEND
cp .env.example .env
# Ajuste as credenciais do seu banco de dados no .env

# Executar o servidor
go run main.go
```
* O banco de dados executará o `AutoMigrate` automaticamente na primeira inicialização.
* Se a base estiver vazia, o administrador padrão será criado:
  * **E-mail**: `admin@sgm.pro`
  * **Senha**: `admin123`

#### 3. Frontend (React)
```bash
cd FRONTEND
npm install
npm run dev
```

---

## 📂 Estrutura do Repositório

```text
SGM_PRO/
├── BACKEND/
│   ├── config/              # Conexão com banco e migrações automáticas
│   ├── controllers/         # Controladores da API RESTful (Auth, OS, Loja, etc.)
│   ├── middleware/          # Middlewares de Autenticação JWT, CORS e Logs
│   ├── models/              # Modelos GORM (OrdemServico, Loja, Medidor, Cliente, etc.)
│   ├── routes/              # Mapeamento e agrupamento de rotas
│   ├── services/            # Camada de regras de negócio
│   ├── utils/               # Utilitários (Google Maps, tokens criptográficos, sanitização)
│   ├── uploads/             # Diretório local para uploads (PDFs e imagens de obra)
│   ├── .env.example         # Exemplo de variáveis de ambiente do backend
│   ├── go.mod / go.sum      # Módulos e dependências do Go
│   └── main.go              # Ponto de entrada da aplicação Go
├── FRONTEND/
│   ├── src/
│   │   ├── components/      # Componentes reutilizáveis (Cards de OS, Modais, Tabelas)
│   │   ├── views/           # Telas do sistema (Dashboard BI, Operações, MagicLink, etc.)
│   │   ├── App.jsx          # Componente raiz com roteamento e controle de perfis
│   │   └── main.jsx         # Ponto de entrada do React
│   ├── package.json         # Dependências do frontend (React, Tailwind, Axios)
│   └── vite.config.js       # Configurações do Vite
├── Dockerfile               # Imagem Docker Go + Node
├── docker-compose.yml       # Orquestração do ambiente
├── .gitignore               # Regras de exclusão do Git
└── README.md                # Documentação do projeto
```

---

## 📡 Principais Endpoints da API

### Públicos (Sem Token)
* `POST /api/login` - Autenticação de usuários (retorna Token JWT, nome, perfil e ref_id)
* `POST /api/esqueci-senha` - Solicitação de link de redefinição
* `POST /api/resetar-senha` - Redefinição de senha com token
* `GET /api/magic/:token` - Dados da OS para visualização do cliente final
* `PUT /api/magic/:token/aceitar` - Aceite dos termos e envio do briefing pelo cliente

### Protegidos (Requer Cabeçalho `Authorization: Bearer <token>`)
* `POST /api/upload` - Upload físico de plantas e fotos de medição
* `GET /api/os` - Listagem filtrada por perfil (`ADMIN`, `LOJA`, `MEDIDOR`)
* `POST /api/os` - Criação de OS com cálculo dinâmico de orçamento e complexidade
* `PUT /api/os/:id` - Atualização da OS e recálculo
* `PUT /api/os/:id/status` - Atualização manual de status e atribuição de medidor
* `PUT /api/os/:id/pegar-demanda` - Medidor assume a OS liberada no radar
* `PUT /api/os/:id/cheguei` - Check-in do medidor na obra
* `PUT /api/os/:id/entregar` - Entrega final das medições e anotações técnicas
* `GET|POST|PUT|DELETE /api/lojas` - CRUD de lojas parceiras
* `GET|POST|PUT|DELETE /api/medidores` - CRUD de medidores técnicos
* `GET|POST|PUT|DELETE /api/clientes` - Gestão de clientes com isolamento por loja
* `GET|POST|PUT|DELETE /api/usuarios` - Gestão de equipe e perfis de acesso

---

## 📄 Licença

Distribuído sob licença proprietária comercial. Todos os direitos reservados.
