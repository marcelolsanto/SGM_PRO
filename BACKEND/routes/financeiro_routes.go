package routes

import (
	"workspace/backend/controllers"

	"github.com/gofiber/fiber/v2"
)

func RegisterFinanceiroRoutes(router fiber.Router) {
	// Fechamentos / Lotes de Medidores
	router.Post("/fechamentos/simular", controllers.SimularFechamento)
	router.Post("/fechamentos/upload-planilha", controllers.UploadPlanilhaMedidor)
	router.Post("/fechamentos/solicitar", controllers.SolicitarFechamento)
	router.Get("/fechamentos", controllers.ListarFechamentos)
	router.Get("/fechamentos/:id", controllers.ObterFechamento)
	router.Put("/fechamentos/:id/aprovar", controllers.AprovarFechamento)
	router.Post("/fechamentos/:id/pagar", controllers.PagarFechamento)
	router.Get("/fechamentos/:id/termo-quitacao", controllers.GerarTermoQuitacaoHTML)
	router.Post("/fechamentos/gerar-automatico", controllers.GerarFechamentoAutomaticoTrigger)

	// Fluxo de Caixa e Contabilidade
	router.Get("/financeiro/fluxo-caixa", controllers.ObterFluxoCaixa)
	router.Get("/financeiro/lancamentos", controllers.ListarLancamentos)
	router.Post("/financeiro/lancamentos", controllers.CriarLancamento)
	router.Get("/financeiro/exportar-contabil", controllers.ExportarRelatorioContabil)
}
