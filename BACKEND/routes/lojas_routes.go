package routes

import (
	"workspace/backend/controllers"

	"github.com/gofiber/fiber/v2"
)

// RegisterLojaRoutes recebe o grupo de rotas (fiber.Router) em vez da aplicação toda
func RegisterLojaRoutes(api fiber.Router) {
	
	// As rotas ficam penduradas diretamente no '/api'
	// O caminho final será: /api/lojas (exatamente como no seu código original)
	
	api.Get("/lojas", controllers.ListarLojas)
	api.Post("/lojas", controllers.CriarLoja)
	api.Put("/lojas/:id", controllers.AtualizarLoja)
	api.Delete("/lojas/:id", controllers.DeletarLoja)
}