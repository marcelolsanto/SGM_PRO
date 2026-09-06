package main

import (
	"log"

	"workspace/backend/config"
	"workspace/backend/routes"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/compress"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
)

func main() {
	// 1. Inicia a conexão com o banco de dados e executa migrações/seeds
	config.ConectarBanco()

	// 2. Inicia a instância do Fiber com limite de upload de 20MB
	app := fiber.New(fiber.Config{
		BodyLimit: 20 * 1024 * 1024,
	})

	// 3. Middlewares globais (Compressão de banda, Logs e CORS)
	app.Use(compress.New(compress.Config{
		Level: compress.LevelBestSpeed,
	}))
	app.Use(logger.New(logger.Config{
		Format: "[${time}] ${status} - ${method} ${path} | ${latency}\n",
	}))
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET, POST, PUT, DELETE, OPTIONS",
	}))

	// 4. Registra todas as rotas da aplicação
	routes.Setup(app)

	// 5. Liga o servidor HTTP na porta 8080
	log.Println("🚀 Servidor SGM_PRO rodando na porta 8080...")
	log.Fatal(app.Listen(":8080"))
}