package routes

import (
	"workspace/backend/controllers"

	"github.com/gofiber/fiber/v2"
)

func RegisterAmbienteRoutes(api fiber.Router) {
	api.Post("/ambientes", controllers.CriarAmbiente)
	api.Get("/ambientes", controllers.ListarAmbientes)
	api.Get("/ambientes/:id", controllers.ObterAmbiente)
	api.Put("/ambientes/:id", controllers.AtualizarAmbiente)
	api.Delete("/ambientes/:id", controllers.DeletarAmbiente)
}
