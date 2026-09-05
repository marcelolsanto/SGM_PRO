package config

import (
	"log"
	"os"

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
	)
	if err != nil {
		log.Println("⚠️ Aviso nas migrações do banco:", err)
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

	// 5. Rotina de auto-cura de tokens antigos
	var ordens []models.OrdemServico
	DB.Find(&ordens)
	mapaDeTokens := make(map[string]bool)
	for _, o := range ordens {
		if o.Token == "" || mapaDeTokens[o.Token] {
			o.Token = utils.GerarTokenUnico()
			DB.Save(&o)
		}
		mapaDeTokens[o.Token] = true
	}
}