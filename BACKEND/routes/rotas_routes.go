package routes

import (
	"workspace/backend/controllers"

	"github.com/gofiber/fiber/v2"
)

func RegisterRotasRoutes(api fiber.Router) {
	api.Get("/rotas/tracar", controllers.TracarRota)
	api.Get("/rotas/os/:id", controllers.TracarRotaOS)
}
