package routes

import (
	"workspace/backend/controllers"

	"github.com/gofiber/fiber/v2"
)

func RegisterOsRoutes(api fiber.Router) {
	api.Post("/os", controllers.CriarOrdem)
	api.Get("/os", controllers.ListarOrdens)
	api.Get("/os/:id", controllers.ObterOrdem)
	api.Put("/os/:id", controllers.AtualizarOrdem)
	api.Put("/os/:id/status", controllers.AtualizarStatus)
	api.Put("/os/:id/pegar-demanda", controllers.PegarDemanda)
	api.Put("/os/:id/recusar-demanda", controllers.RecusarDemanda)
	api.Put("/os/:id/cheguei", controllers.MarcarChegada)
	api.Put("/os/:id/entregar", controllers.EntregarMedicao)
	api.Put("/os/:id/documentos", controllers.AtualizarDocumentosMedicao)
	api.Delete("/os/:id", controllers.DeletarOrdem)
	api.Get("/os/:id/pix", controllers.GerarPixOS)
	api.Post("/os/:id/confirmar-pagamento", controllers.ConfirmarPagamentoOS)
}
