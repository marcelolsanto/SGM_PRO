package controllers

import (
	"crypto/sha256"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"workspace/backend/config"
	"workspace/backend/models"
	"workspace/backend/services"

	"github.com/gofiber/fiber/v2"
)

// SimularFechamentoRequest DTO de entrada para simulação
type SimularFechamentoRequest struct {
	MedidorID     uint   `json:"medidor_id"`
	PeriodoInicio string `json:"periodo_inicio"` // YYYY-MM-DD
	PeriodoFim    string `json:"periodo_fim"`    // YYYY-MM-DD
}

// SimularFechamento identifica todas as OSs concluídas no período e totaliza valores
func SimularFechamento(c *fiber.Ctx) error {
	var req SimularFechamentoRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Requisição inválida: " + err.Error()})
	}

	perfil := c.Locals("perfil").(string)
	if perfil == "MEDIDOR" {
		var refID uint
		if r, ok := c.Locals("ref_id").(float64); ok {
			refID = uint(r)
		} else if r, ok := c.Locals("ref_id").(uint); ok {
			refID = r
		}
		req.MedidorID = refID
	}

	if req.MedidorID == 0 {
		return c.Status(400).JSON(fiber.Map{"erro": "Medidor não especificado."})
	}

	var dataInicio, dataFim time.Time
	var err error
	if req.PeriodoInicio != "" {
		dataInicio, err = time.Parse("2006-01-02", req.PeriodoInicio)
	}
	if err != nil || dataInicio.IsZero() {
		// Padrão: início do mês atual
		agora := time.Now()
		dataInicio = time.Date(agora.Year(), agora.Month(), 1, 0, 0, 0, 0, agora.Location())
	}

	if req.PeriodoFim != "" {
		dataFim, err = time.Parse("2006-01-02", req.PeriodoFim)
	}
	if err != nil || dataFim.IsZero() {
		dataFim = time.Now()
	}
	dataFim = time.Date(dataFim.Year(), dataFim.Month(), dataFim.Day(), 23, 59, 59, 999999999, dataFim.Location())

	// Busca OSs concluídas vinculadas ao medidor
	var ordens []models.OrdemServico
	query := config.DB.Preload("Loja").
		Where("medidor_id = ?", req.MedidorID).
		Where("status IN ('CONCLUIDA', 'VALIDADA')")

	// Filtra por data de conclusão se disponível, senão por criado_em
	query = query.Where("(data_conclusao BETWEEN ? AND ?) OR (data_conclusao IS NULL AND criado_em BETWEEN ? AND ?)",
		dataInicio, dataFim, dataInicio, dataFim)

	if err := query.Find(&ordens).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"erro": "Falha ao buscar ordens de serviço."})
	}

	// Filtra OSs que já estejam em lotes ativos (não recusados)
	var idsEmLotes []uint
	config.DB.Table("fechamento_medidor_itens").
		Select("fechamento_medidor_itens.ordem_servico_id").
		Joins("JOIN fechamento_medidores ON fechamento_medidores.id = fechamento_medidor_itens.fechamento_id").
		Where("fechamento_medidores.status != 'RECUSADO'").
		Pluck("ordem_servico_id", &idsEmLotes)

	mapEmLote := make(map[uint]bool)
	for _, id := range idsEmLotes {
		mapEmLote[id] = true
	}

	var ordensDisponiveis []models.OrdemServico
	var totalMaoDeObra, totalDeslocamento, totalAdicionais, totalGeral float64

	for _, osItem := range ordens {
		if mapEmLote[osItem.ID] {
			continue // Já faturada em outro lote
		}
		ordensDisponiveis = append(ordensDisponiveis, osItem)

		maoObra := osItem.MaoDeObraMedidor
		if maoObra == 0 {
			maoObra = osItem.CustoMedidor - osItem.TaxaDeslocamento - osItem.AdicionalUrgencia
			if maoObra < 0 {
				maoObra = osItem.CustoMedidor
			}
		}

		totalMaoDeObra += maoObra
		totalDeslocamento += osItem.TaxaDeslocamento
		totalAdicionais += osItem.AdicionalUrgencia
		totalGeral += osItem.CustoMedidor
	}

	// Busca dados do medidor para obter chave PIX padrão
	var medidor models.Medidor
	config.DB.First(&medidor, req.MedidorID)

	return c.JSON(fiber.Map{
		"medidor":            medidor,
		"periodo_inicio":     dataInicio.Format("2006-01-02"),
		"periodo_fim":        dataFim.Format("2006-01-02"),
		"quantidade_os":      len(ordensDisponiveis),
		"valor_mao_de_obra":  math.Round(totalMaoDeObra*100) / 100,
		"valor_deslocamento": math.Round(totalDeslocamento*100) / 100,
		"valor_adicionais":   math.Round(totalAdicionais*100) / 100,
		"valor_bruto":        math.Round(totalGeral*100) / 100,
		"ordens":             ordensDisponiveis,
	})
}

// UploadPlanilhaMedidor recebe o arquivo da planilha e concilia automaticamente
func UploadPlanilhaMedidor(c *fiber.Ctx) error {
	file, err := c.FormFile("planilha")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Nenhuma planilha enviada."})
	}

	medidorIDStr := c.FormValue("medidor_id")
	medidorID, _ := strconv.ParseUint(medidorIDStr, 10, 32)

	perfil := c.Locals("perfil").(string)
	if perfil == "MEDIDOR" {
		if r, ok := c.Locals("ref_id").(float64); ok {
			medidorID = uint64(r)
		} else if r, ok := c.Locals("ref_id").(uint); ok {
			medidorID = uint64(r)
		}
	}

	if medidorID == 0 {
		return c.Status(400).JSON(fiber.Map{"erro": "ID do medidor obrigatório."})
	}

	_ = os.MkdirAll("./uploads/planilhas", os.ModePerm)
	nomeUnico := fmt.Sprintf("%d_%s", time.Now().UnixNano(), strings.ReplaceAll(file.Filename, " ", "_"))
	caminhoFisico := filepath.Join("./uploads/planilhas", nomeUnico)

	if err := c.SaveFile(file, caminhoFisico); err != nil {
		return c.Status(500).JSON(fiber.Map{"erro": "Falha ao salvar planilha no servidor."})
	}

	resultado, err := services.ProcessarEConciliarPlanilha(caminhoFisico, uint(medidorID))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": err.Error()})
	}

	urlPlanilha := fmt.Sprintf("/uploads/planilhas/%s", nomeUnico)

	return c.JSON(fiber.Map{
		"url_planilha": urlPlanilha,
		"resultado":    resultado,
	})
}

// SolicitarFechamentoRequest DTO para criação formal do lote de pagamento
type SolicitarFechamentoRequest struct {
	MedidorID             uint    `json:"medidor_id"`
	PeriodoInicio         string  `json:"periodo_inicio"`
	PeriodoFim            string  `json:"periodo_fim"`
	OsIDs                 []uint  `json:"os_ids"`
	TipoDocumentoFiscal   string  `json:"tipo_documento_fiscal"` // MEI, NFSE, RPA
	NumeroDocumentoFiscal string  `json:"numero_documento_fiscal"`
	UrlDocumentoFiscal    string  `json:"url_documento_fiscal"`
	UrlPlanilhaEnviada    string  `json:"url_planilha_enviada"`
	ChavePix              string  `json:"chave_pix"`
	TipoChavePix          string  `json:"tipo_chave_pix"`
	DivergenciasJson      string  `json:"divergencias_json"`
}

// SolicitarFechamento submete o lote para aprovação e conferência
func SolicitarFechamento(c *fiber.Ctx) error {
	var req SolicitarFechamentoRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Dados inválidos: " + err.Error()})
	}

	perfil := c.Locals("perfil").(string)
	if perfil == "MEDIDOR" {
		if r, ok := c.Locals("ref_id").(float64); ok {
			req.MedidorID = uint(r)
		} else if r, ok := c.Locals("ref_id").(uint); ok {
			req.MedidorID = r
		}
	}

	if req.MedidorID == 0 || len(req.OsIDs) == 0 {
		return c.Status(400).JSON(fiber.Map{"erro": "Informe o medidor e selecione ao menos uma OS."})
	}

	// Validação de dados fiscais (Conformidade CLT / Fiscal)
	if req.TipoDocumentoFiscal == "" {
		req.TipoDocumentoFiscal = "MEI"
	}

	// Busca as OSs reais do banco
	var ordens []models.OrdemServico
	config.DB.Where("id IN ? AND medidor_id = ?", req.OsIDs, req.MedidorID).Find(&ordens)
	if len(ordens) == 0 {
		return c.Status(400).JSON(fiber.Map{"erro": "Nenhuma das OSs selecionadas pertence ao medidor."})
	}

	var totalMaoDeObra, totalDeslocamento, totalAdicionais, totalBruto float64
	for _, osItem := range ordens {
		maoObra := osItem.MaoDeObraMedidor
		if maoObra == 0 {
			maoObra = osItem.CustoMedidor - osItem.TaxaDeslocamento - osItem.AdicionalUrgencia
			if maoObra < 0 {
				maoObra = osItem.CustoMedidor
			}
		}
		totalMaoDeObra += maoObra
		totalDeslocamento += osItem.TaxaDeslocamento
		totalAdicionais += osItem.AdicionalUrgencia
		totalBruto += osItem.CustoMedidor
	}

	// Cálculo de retenção de impostos se for RPA (Autônomo PF sem CNPJ)
	var retencoes float64
	if req.TipoDocumentoFiscal == "RPA" {
		// INSS autônomo: 11% sobre o total da mão de obra (teto INSS 2026 ~ R$ 908,85)
		inss := totalMaoDeObra * 0.11
		if inss > 908.85 {
			inss = 908.85
		}
		retencoes = inss
	}

	valorLiquido := totalBruto - retencoes

	// Gera número de lote único ex: LOTE-202609-001
	agora := time.Now()
	var contagemLotes int64
	config.DB.Model(&models.FechamentoMedidor{}).
		Where("periodo_inicio >= ?", time.Date(agora.Year(), agora.Month(), 1, 0, 0, 0, 0, agora.Location())).
		Count(&contagemLotes)

	numeroLote := fmt.Sprintf("LOT-%04d%02d-%03d", agora.Year(), agora.Month(), contagemLotes+1)

	pInicio, _ := time.Parse("2006-01-02", req.PeriodoInicio)
	if pInicio.IsZero() {
		pInicio = time.Date(agora.Year(), agora.Month(), 1, 0, 0, 0, 0, agora.Location())
	}
	pFim, _ := time.Parse("2006-01-02", req.PeriodoFim)
	if pFim.IsZero() {
		pFim = agora
	}

	fechamento := models.FechamentoMedidor{
		MedidorID:              req.MedidorID,
		NumeroLote:             numeroLote,
		PeriodoInicio:          pInicio,
		PeriodoFim:             pFim,
		QuantidadeOS:           len(ordens),
		ValorMaoDeObra:         math.Round(totalMaoDeObra*100) / 100,
		ValorDeslocamento:      math.Round(totalDeslocamento*100) / 100,
		ValorAdicionais:        math.Round(totalAdicionais*100) / 100,
		ValorBruto:             math.Round(totalBruto*100) / 100,
		ValorRetencoesImpostos: math.Round(retencoes*100) / 100,
		ValorLiquido:           math.Round(valorLiquido*100) / 100,
		Status:                 "ENVIADO_CONFERENCIA",
		TipoDocumentoFiscal:    req.TipoDocumentoFiscal,
		NumeroDocumentoFiscal:  req.NumeroDocumentoFiscal,
		UrlDocumentoFiscal:     req.UrlDocumentoFiscal,
		UrlPlanilhaEnviada:     req.UrlPlanilhaEnviada,
		ChavePix:               req.ChavePix,
		TipoChavePix:           req.TipoChavePix,
		DivergenciasJson:       req.DivergenciasJson,
	}

	if err := config.DB.Create(&fechamento).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"erro": "Falha ao criar lote de fechamento: " + err.Error()})
	}

	// Cria itens vinculados
	for _, osItem := range ordens {
		item := models.FechamentoMedidorItem{
			FechamentoID:      fechamento.ID,
			OrdemServicoID:    osItem.ID,
			ValorMaoDeObra:    osItem.MaoDeObraMedidor,
			ValorDeslocamento: osItem.TaxaDeslocamento,
			ValorAdicionais:   osItem.AdicionalUrgencia,
			ValorTotalItem:    osItem.CustoMedidor,
			StatusItem:        "VALIDADO",
		}
		config.DB.Create(&item)
	}

	return c.Status(201).JSON(fiber.Map{
		"mensagem":   "Lote de fechamento submetido com sucesso para conferência.",
		"fechamento": fechamento,
	})
}

// ListarFechamentos lista os lotes com filtros
func ListarFechamentos(c *fiber.Ctx) error {
	perfil := c.Locals("perfil").(string)
	var refID uint
	if r, ok := c.Locals("ref_id").(float64); ok {
		refID = uint(r)
	} else if r, ok := c.Locals("ref_id").(uint); ok {
		refID = r
	}

	query := config.DB.Preload("Medidor").Order("criado_em DESC")

	if perfil == "MEDIDOR" {
		query = query.Where("medidor_id = ?", refID)
	} else if medidorID := c.Query("medidor_id"); medidorID != "" {
		query = query.Where("medidor_id = ?", medidorID)
	}

	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	var fechamentos []models.FechamentoMedidor
	if err := query.Find(&fechamentos).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"erro": "Falha ao listar fechamentos."})
	}

	return c.JSON(fechamentos)
}

// ObterFechamento busca um lote com todos os seus itens detalhados
func ObterFechamento(c *fiber.Ctx) error {
	id := c.Params("id")
	var fechamento models.FechamentoMedidor
	err := config.DB.Preload("Medidor").
		Preload("Itens.OrdemServico.Loja").
		First(&fechamento, id).Error

	if err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Lote de fechamento não encontrado."})
	}

	perfil := c.Locals("perfil").(string)
	if perfil == "MEDIDOR" {
		var refID uint
		if r, ok := c.Locals("ref_id").(float64); ok {
			refID = uint(r)
		} else if r, ok := c.Locals("ref_id").(uint); ok {
			refID = r
		}
		if fechamento.MedidorID != refID {
			return c.Status(403).JSON(fiber.Map{"erro": "Acesso não autorizado a este lote."})
		}
	}

	return c.JSON(fechamento)
}

// AprovarFechamentoRequest DTO para aprovação financeira
type AprovarFechamentoRequest struct {
	ValorDescontos        float64 `json:"valor_descontos"`
	ValorAdicionais       float64 `json:"valor_adicionais"`
	ObservacoesFinanceiro string  `json:"observacoes_financeiro"`
}

// AprovarFechamento aprova o lote e define valor final líquido
func AprovarFechamento(c *fiber.Ctx) error {
	id := c.Params("id")
	var req AprovarFechamentoRequest
	_ = c.BodyParser(&req)

	var fechamento models.FechamentoMedidor
	if err := config.DB.First(&fechamento, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Lote não encontrado."})
	}

	if req.ValorDescontos > 0 {
		fechamento.ValorDescontos = req.ValorDescontos
	}
	if req.ValorAdicionais > 0 {
		fechamento.ValorAdicionais = req.ValorAdicionais
	}
	fechamento.ObservacoesFinanceiro = req.ObservacoesFinanceiro
	fechamento.ValorLiquido = (fechamento.ValorBruto + fechamento.ValorAdicionais) - (fechamento.ValorDescontos + fechamento.ValorRetencoesImpostos)

	agora := time.Now()
	fechamento.AprovadoEm = &agora
	fechamento.Status = "APROVADO"

	config.DB.Save(&fechamento)
	return c.JSON(fiber.Map{
		"mensagem":   "Lote aprovado pelo financeiro com sucesso.",
		"fechamento": fechamento,
	})
}

// PagarFechamentoRequest DTO para baixa bancária do lote
type PagarFechamentoRequest struct {
	UrlComprovantePix string `json:"url_comprovante_pix"`
}

// PagarFechamento registra a liquidação PIX, anexa comprovante bancário e gera termo de quitação
func PagarFechamento(c *fiber.Ctx) error {
	id := c.Params("id")
	var req PagarFechamentoRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Dados inválidos."})
	}

	var fechamento models.FechamentoMedidor
	if err := config.DB.Preload("Medidor").Preload("Itens").First(&fechamento, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Lote não encontrado."})
	}

	if fechamento.Status == "PAGO" {
		return c.Status(400).JSON(fiber.Map{"erro": "Este lote já foi pago anteriormente."})
	}

	agora := time.Now()
	ipCliente := c.IP()

	// Gera HASH Criptográfico do Termo de Quitação (Art. 320 do Código Civil & Marco Civil)
	hashData := fmt.Sprintf("%d|%s|%.2f|%s|%s|%s",
		fechamento.ID, fechamento.NumeroLote, fechamento.ValorLiquido, fechamento.ChavePix, agora.Format(time.RFC3339), ipCliente)
	hashSum := sha256.Sum256([]byte(hashData))
	hashHex := fmt.Sprintf("%x", hashSum)

	fechamento.Status = "PAGO"
	fechamento.UrlComprovantePix = req.UrlComprovantePix
	fechamento.PagoEm = &agora
	fechamento.TermoQuitacaoEm = &agora
	fechamento.TermoQuitacaoIp = ipCliente
	fechamento.TermoQuitacaoHash = hashHex

	config.DB.Save(&fechamento)

	// 1. Gera lançamento automático no FLUXO DE CAIXA / LIVRO RAZÃO
	lancamento := models.LancamentoFinanceiro{
		Tipo:                "SAIDA",
		Categoria:           "REPASSE_MEDIDOR",
		Valor:               fechamento.ValorLiquido,
		DataCompetencia:     fechamento.PeriodoFim,
		DataVencimento:      agora,
		DataLiquidacao:      &agora,
		Status:              "REALIZADO",
		FormaPagamento:      "PIX",
		FechamentoMedidorID: &fechamento.ID,
		Descricao:           fmt.Sprintf("Repasse Medições %s - %s (%s)", fechamento.NumeroLote, fechamento.Medidor.NomeCompleto, fechamento.TipoDocumentoFiscal),
		ComprovanteUrl:      req.UrlComprovantePix,
	}
	config.DB.Create(&lancamento)

	// 2. Atualiza o status de pagamento de cada OS individual para 'PAGO'
	var osIDs []uint
	for _, it := range fechamento.Itens {
		osIDs = append(osIDs, it.OrdemServicoID)
	}
	if len(osIDs) > 0 {
		config.DB.Model(&models.OrdemServico{}).
			Where("id IN ?", osIDs).
			Updates(map[string]interface{}{
				"status_pagamento": "PAGO",
				"data_pagamento":   agora,
			})
	}

	return c.JSON(fiber.Map{
		"mensagem":            "Lote liquidado via PIX com sucesso. Quitação plena gerada e fluxo de caixa atualizado.",
		"fechamento":          fechamento,
		"termo_quitacao_hash": hashHex,
	})
}

// GerarTermoQuitacaoHTML emite o documento oficial de quitação plena para impressão/PDF
func GerarTermoQuitacaoHTML(c *fiber.Ctx) error {
	id := c.Params("id")
	var fechamento models.FechamentoMedidor
	if err := config.DB.Preload("Medidor").Preload("Itens.OrdemServico.Loja").First(&fechamento, id).Error; err != nil {
		return c.Status(404).SendString("Lote não encontrado")
	}

	pagoEmStr := "Pendente"
	if fechamento.PagoEm != nil {
		pagoEmStr = fechamento.PagoEm.Format("02/01/2006 às 15:04:05")
	}

	html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Recibo de Quitação Plena - %s</title>
<style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #1e293b; line-height: 1.6; }
  .header { border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center; }
  .title { font-size: 20px; font-weight: bold; text-transform: uppercase; color: #0f172a; }
  .badge { background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 12px; }
  .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 20px; font-size: 13px; }
  table { width: 100%%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
  th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
  th { background: #f1f5f9; font-weight: bold; }
  .legal { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px; font-size: 11px; color: #1e3a8a; margin: 20px 0; }
  .footer { margin-top: 40px; border-top: 1px solid #cbd5e1; padding-top: 15px; font-size: 11px; color: #64748b; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="title">SGM.PRO - TERMO DE QUITAÇÃO PLENA DE MEDIÇÕES</div>
    <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Protocolo / Lote: <strong>%s</strong></div>
  </div>
  <div class="badge">STATUS: %s</div>
</div>

<div class="box">
  <p><strong>PRESTADOR DE SERVIÇOS (MEDIDOR PARCEIRO):</strong> %s</p>
  <p><strong>CPF / CNPJ:</strong> %s | <strong>TELEFONE:</strong> %s</p>
  <p><strong>ENQUADRAMENTO FISCAL:</strong> %s | <strong>DOC FISCAL / RECIBO:</strong> %s</p>
  <p><strong>CHAVE PIX DESTINO:</strong> %s (%s)</p>
  <p><strong>PERÍODO DE COMPETÊNCIA:</strong> %s até %s</p>
  <p><strong>DATA E HORA DO PAGAMENTO:</strong> %s</p>
</div>

<div class="legal">
  <strong>FUNDAMENTAÇÃO JURÍDICA (LEGISLAÇÃO TRABALHISTA E CIVIL):</strong><br>
  O presente termo atesta a relação de prestação de serviços de medição técnica executada com plena autonomia profissional, sem qualquer subordinação hierárquica, exclusividade ou controle de jornada, nos exatos termos do <strong>Artigo 442-B da Consolidação das Leis do Trabalho (CLT)</strong> e do <strong>Tema 725 do Supremo Tribunal Federal (STF)</strong>.<br>
  Com o efetivo recebimento do valor líquido acordado, o prestador acima identificado concede à contratante e suas lojas parceiras a mais ampla, geral, rasa e irrevogável <strong>QUITAÇÃO</strong> (Artigo 320 do Código Civil Brasileiro), nada mais tendo a reclamar a qualquer título (mão de obra, transporte, deslocamentos ou adicionais) referente às Ordens de Serviço integrantes deste lote.
</div>

<h3>Ordens de Serviço Integrantes do Fechamento</h3>
<table>
  <thead>
    <tr>
      <th>OS ID</th>
      <th>Cliente / Obra</th>
      <th>Loja Contratante</th>
      <th>Mão de Obra</th>
      <th>Deslocamento</th>
      <th>Total Devido</th>
    </tr>
  </thead>
  <tbody>`,
		fechamento.NumeroLote, fechamento.NumeroLote, fechamento.Status,
		fechamento.Medidor.NomeCompleto, fechamento.Medidor.Cpf, fechamento.Medidor.Telefone,
		fechamento.TipoDocumentoFiscal, fechamento.NumeroDocumentoFiscal,
		fechamento.ChavePix, fechamento.TipoChavePix,
		fechamento.PeriodoInicio.Format("02/01/2006"), fechamento.PeriodoFim.Format("02/01/2006"),
		pagoEmStr,
	)

	for _, item := range fechamento.Itens {
		lojaNome := "N/A"
		if item.OrdemServico.Loja.NomeFantasia != "" {
			lojaNome = item.OrdemServico.Loja.NomeFantasia
		}
		html += fmt.Sprintf(`
    <tr>
      <td>#%04d</td>
      <td>%s</td>
      <td>%s</td>
      <td>R$ %.2f</td>
      <td>R$ %.2f</td>
      <td><strong>R$ %.2f</strong></td>
    </tr>`,
			item.OrdemServicoID, item.OrdemServico.ClienteNome, lojaNome,
			item.ValorMaoDeObra, item.ValorDeslocamento, item.ValorTotalItem)
	}

	html += fmt.Sprintf(`
  </tbody>
  <tfoot>
    <tr>
      <th colspan="5" style="text-align: right;">VALOR BRUTO DAS MEDIÇÕES:</th>
      <th>R$ %.2f</th>
    </tr>
    <tr>
      <th colspan="5" style="text-align: right;">RETENÇÕES FISCAIS / DESCONTOS:</th>
      <th>- R$ %.2f</th>
    </tr>
    <tr style="background: #e2e8f0; font-size: 14px;">
      <th colspan="5" style="text-align: right;">VALOR LÍQUIDO PAGO VIA PIX:</th>
      <th>R$ %.2f</th>
    </tr>
  </tfoot>
</table>

<div class="footer">
  <p><strong>Carimbo Criptográfico de Autenticidade Digital:</strong></p>
  <p style="font-family: monospace; font-size: 10px; word-break: break-all;">SHA-256: %s</p>
  <p>IP Registrado: %s | Assinatura e Quitação Digital efetuada em conformidade com o Art. 15 da Lei 12.965/2014 (Marco Civil da Internet).</p>
</div>
</body>
</html>`,
		fechamento.ValorBruto, (fechamento.ValorDescontos + fechamento.ValorRetencoesImpostos),
		fechamento.ValorLiquido, fechamento.TermoQuitacaoHash, fechamento.TermoQuitacaoIp)

	c.Set("Content-Type", "text/html; charset=utf-8")
	return c.SendString(html)
}

// GerarFechamentoAutomaticoTrigger aciona o preenchimento automático de lotes sob demanda
func GerarFechamentoAutomaticoTrigger(c *fiber.Ctx) error {
	ano, _ := strconv.Atoi(c.Query("ano"))
	mes, _ := strconv.Atoi(c.Query("mes"))

	lotes, err := services.GerarLotesMensaisAutomaticos(ano, mes)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"erro": err.Error()})
	}

	return c.JSON(fiber.Map{
		"mensagem":      fmt.Sprintf("%d lote(s) gerado(s) automaticamente com sucesso!", len(lotes)),
		"total_criados": len(lotes),
		"lotes":         lotes,
	})
}
