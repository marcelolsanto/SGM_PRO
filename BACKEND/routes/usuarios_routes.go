package routes

import (
	"workspace/backend/controllers"

	"github.com/gofiber/fiber/v2"
)

func RegisterUsuarioRoutes(api fiber.Router) {
	api.Post("/usuarios", controllers.CriarUsuario)
	api.Get("/usuarios", controllers.ListarUsuarios)
	api.Get("/usuarios/:id", controllers.ObterUsuario)
	api.Put("/usuarios/:id", controllers.AtualizarUsuario)
	api.Delete("/usuarios/:id", controllers.DeletarUsuario)
}
