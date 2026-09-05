package routes

import (
	"workspace/backend/controllers"

	"github.com/gofiber/fiber/v2"
)

func RegisterClienteRoutes(api fiber.Router) {
	api.Post("/clientes", controllers.CriarCliente)
	api.Get("/clientes", controllers.ListarClientes)
	api.Get("/clientes/:id", controllers.ObterCliente)
	api.Put("/clientes/:id", controllers.AtualizarCliente)
	api.Delete("/clientes/:id", controllers.DeletarCliente)
}