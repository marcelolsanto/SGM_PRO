package routes

import (
	"workspace/backend/controllers"
	"workspace/backend/middleware"

	"github.com/gofiber/fiber/v2"
)

// Setup inicializa todas as rotas da aplicação
func Setup(app *fiber.App) {
	// 0. SERVIÇO DE ARQUIVOS ESTÁTICOS
	app.Static("/uploads", "./uploads")

	// 1. ROTAS PÚBLICAS (Sem exigência de Token JWT)
	app.Post("/api/login", controllers.Login)
	app.Post("/api/esqueci-senha", controllers.EsqueciSenha)
	app.Post("/api/resetar-senha", controllers.ResetarSenha)

	// Rota Pública de Contato / Captação de Leads Institucional
	app.Post("/api/contato", controllers.EnviarContato)

	// Rotas do Link Mágico do Cliente (acessível com ou sem /api)
	app.Get("/api/magic/:token", controllers.ObterMagicLink)
	app.Put("/api/magic/:token/aceitar", controllers.AceitarMagicLink)
	app.Get("/magic/:token", controllers.ObterMagicLink)
	app.Put("/magic/:token/aceitar", controllers.AceitarMagicLink)

	// Rotas de Traçado de Rotas Viárias
	app.Get("/api/rotas/tracar", controllers.TracarRota)

	// 2. GRUPO PROTEGIDO (Passa pelo AuthMiddleware)
	apiProtegida := app.Group("/api", middleware.Auth)

	// Upload de arquivos (plantas, fotos, relatórios)
	apiProtegida.Post("/upload", controllers.UploadArquivo)

	// Consulta de Leads de Contato (Admin)
	apiProtegida.Get("/contatos", controllers.ListarLeadsContato)

	// 3. REGISTRO DOS MÓDULOS
	RegisterLojaRoutes(apiProtegida)
	RegisterUsuarioRoutes(apiProtegida)
	RegisterOsRoutes(apiProtegida)
	RegisterClienteRoutes(apiProtegida)
	RegisterMedidorRoutes(apiProtegida)
	RegisterAmbienteRoutes(apiProtegida)
	RegisterRotasRoutes(apiProtegida)
	RegisterFinanceiroRoutes(apiProtegida)
}