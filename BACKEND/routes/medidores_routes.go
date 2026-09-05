package routes

import (
	"workspace/backend/controllers"

	"github.com/gofiber/fiber/v2"
)

func RegisterMedidorRoutes(api fiber.Router) {
	api.Post("/medidores", controllers.CriarMedidor)
	api.Get("/medidores", controllers.ListarMedidores)
	api.Get("/medidores/:id", controllers.ObterMedidor)
	api.Put("/medidores/:id", controllers.AtualizarMedidor)
	api.Put("/medidores/:id/localizacao", controllers.AtualizarLocalizacaoMedidor)
	api.Get("/medidores/:id/localizacao", controllers.ObterLocalizacaoMedidor)
	api.Put("/medidores/:id/disponibilidade", controllers.AtualizarDisponibilidadeMedidor)
	api.Delete("/medidores/:id", controllers.DeletarMedidor)
}
