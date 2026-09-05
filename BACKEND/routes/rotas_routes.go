package routes

import (
	"workspace/backend/controllers"

	"github.com/gofiber/fiber/v2"
)

func RegisterRotasRoutes(api fiber.Router) {
	api.Get("/rotas/tracar", controllers.TracarRota)
	api.Get("/rotas/os/:id", controllers.TracarRotaOS)
	api.Get("/rotas/meu-roteiro", controllers.ObterMeuRoteiro)
	api.Put("/rotas/reordenar", controllers.ReordenarRoteiro)
	api.Post("/rotas/adicionar/:id", controllers.AdicionarAoRoteiro)
	api.Put("/rotas/otimizar", controllers.OtimizarPorProximidade)
}
