package config

import (
	"log"
	"os"
	"time"

	"workspace/backend/models"
	"workspace/backend/utils"

	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// DB é a variável global para acesso ao banco de dados
var DB *gorm.DB

func ConectarBanco() {
	// 1. Carrega o arquivo .env
	if err := godotenv.Load(); err != nil {
		log.Println("Aviso: .env não encontrado. Usando variáveis do sistema.")
	}

	// 2. Garante existência do diretório de uploads
	if err := os.MkdirAll("./uploads", os.ModePerm); err != nil {
		log.Println("Aviso: Não foi possível criar pasta uploads:", err)
	}

	dsn := os.Getenv("DB_DSN")
	database, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("❌ Falha crítica ao conectar no banco:\n", err)
	}

	DB = database
	sqlDB, errDB := DB.DB()
	if errDB == nil {
		sqlDB.SetMaxOpenConns(150)
		sqlDB.SetMaxIdleConns(50)
		sqlDB.SetConnMaxLifetime(time.Hour)
	}
	log.Println("✅ Banco de dados PostgreSQL conectado com sucesso!")

	// 3. Auto-migrações das tabelas
	err = DB.AutoMigrate(
		&models.Loja{},
		&models.Medidor{},
		&models.Usuario{},
		&models.OrdemServico{},
		&models.Ambiente{},
		&models.BriefingCliente{},
		&models.Cliente{},
		&models.ContatoLead{},
	)
	if err != nil {
		log.Println("⚠️ Aviso nas migrações do banco:", err)
	}

	// 3.1. Índices B-Tree de alta performance para concorrência em escala
	indices := []string{
		"CREATE INDEX IF NOT EXISTS idx_os_loja_status ON ordem_servicos(loja_id, status);",
		"CREATE INDEX IF NOT EXISTS idx_os_medidor_status ON ordem_servicos(medidor_id, status);",
		"CREATE INDEX IF NOT EXISTS idx_os_token ON ordem_servicos(token);",
		"CREATE INDEX IF NOT EXISTS idx_os_criado_em ON ordem_servicos(criado_em);",
		"CREATE INDEX IF NOT EXISTS idx_ambientes_os_id ON ambientes(ordem_servico_id);",
		"CREATE INDEX IF NOT EXISTS idx_clientes_loja_id ON clientes(loja_id);",
	}
	for _, idxSql := range indices {
		DB.Exec(idxSql)
	}

	// 4. Seed do Administrador padrão caso o banco esteja vazio
	var contagemUsuarios int64
	DB.Model(&models.Usuario{}).Count(&contagemUsuarios)
	if contagemUsuarios == 0 {
		hash, _ := bcrypt.GenerateFromPassword([]byte("admin123"), 10)
		DB.Create(&models.Usuario{
			Nome:   "SGM Admin",
			Email:  "admin@sgm.pro",
			Senha:  string(hash),
			Perfil: "ADMIN",
		})
		log.Println("👤 Administrador padrão criado: admin@sgm.pro")
	}

	// 5. Rotina de auto-cura de tokens antigos (apenas ordens sem token)
	var ordensSemToken []models.OrdemServico
	DB.Where("token = '' OR token IS NULL").Limit(500).Find(&ordensSemToken)
	for _, o := range ordensSemToken {
		o.Token = utils.GerarTokenUnico()
		DB.Model(&models.OrdemServico{}).Where("id = ?", o.ID).Update("token", o.Token)
	}
}