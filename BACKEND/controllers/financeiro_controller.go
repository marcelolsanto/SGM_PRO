package controllers

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"workspace/backend/config"
	"workspace/backend/models"

	"github.com/gofiber/fiber/v2"
)

// ObterFluxoCaixa retorna o DRE operacional, fluxo de caixa e saldo consolidado
func ObterFluxoCaixa(c *fiber.Ctx) error {
	anoStr := c.Query("ano")
	ano := time.Now().Year()
	if a, err := strconv.Atoi(anoStr); err == nil && a > 2000 {
		ano = a
	}

	dataInicio := time.Date(ano, 1, 1, 0, 0, 0, 0, time.Local)
	dataFim := time.Date(ano, 12, 31, 23, 59, 59, 999999999, time.Local)

	var lancamentos []models.LancamentoFinanceiro
	config.DB.Where("data_competencia BETWEEN ? AND ?", dataInicio, dataFim).
		Order("data_competencia ASC").
		Find(&lancamentos)

	// Também computa entradas oriundas das Ordens de Serviço faturadas no ano
	var ordens []models.OrdemServico
	config.DB.Where("criado_em BETWEEN ? AND ?", dataInicio, dataFim).
		Find(&ordens)

	var totalEntradas, totalSaidas float64
	mesesEntradas := make([]float64, 12)
	mesesSaidas := make([]float64, 12)

	// 1. Processa receitas de OSs das lojas
	for _, osItem := range ordens {
		mesIdx := int(osItem.CriadoEm.Month()) - 1
		if mesIdx >= 0 && mesIdx < 12 {
			totalEntradas += osItem.ValorTotalOS
			mesesEntradas[mesIdx] += osItem.ValorTotalOS
		}
	}

	// 2. Processa lançamentos registrados (repasses de medidores, despesas)
	for _, l := range lancamentos {
		mesIdx := int(l.DataCompetencia.Month()) - 1
		if mesIdx >= 0 && mesIdx < 12 {
			if l.Tipo == "SAIDA" {
				totalSaidas += l.Valor
				mesesSaidas[mesIdx] += l.Valor
			} else if l.Tipo == "ENTRADA" {
				// Entradas avulsas adicionais
				totalEntradas += l.Valor
				mesesEntradas[mesIdx] += l.Valor
			}
		}
	}

	lucroLiquido := totalEntradas - totalSaidas
	var margemPercentual float64
	if totalEntradas > 0 {
		margemPercentual = (lucroLiquido / totalEntradas) * 100
	}

	// Resumo por mês para gráficos
	nomesMeses := []string{"Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"}
	graficoMensal := make([]fiber.Map, 12)
	for i := 0; i < 12; i++ {
		graficoMensal[i] = fiber.Map{
			"mes":      nomesMeses[i],
			"entradas": math.Round(mesesEntradas[i]*100) / 100,
			"saidas":   math.Round(mesesSaidas[i]*100) / 100,
			"saldo":    math.Round((mesesEntradas[i]-mesesSaidas[i])*100) / 100,
		}
	}

	return c.JSON(fiber.Map{
		"ano":               ano,
		"total_entradas":    math.Round(totalEntradas*100) / 100,
		"total_saidas":      math.Round(totalSaidas*100) / 100,
		"lucro_liquido":     math.Round(lucroLiquido*100) / 100,
		"margem_percentual": math.Round(margemPercentual*10) / 10,
		"grafico_mensal":    graficoMensal,
	})
}

// ListarLancamentos retorna os registros do Livro Caixa
func ListarLancamentos(c *fiber.Ctx) error {
	query := config.DB.Preload("FechamentoMedidor.Medidor").
		Preload("Loja").
		Order("data_competencia DESC")

	if tipo := c.Query("tipo"); tipo != "" {
		query = query.Where("tipo = ?", strings.ToUpper(tipo))
	}
	if cat := c.Query("categoria"); cat != "" {
		query = query.Where("categoria = ?", strings.ToUpper(cat))
	}
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", strings.ToUpper(status))
	}

	var lancamentos []models.LancamentoFinanceiro
	if err := query.Limit(100).Find(&lancamentos).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"erro": "Falha ao listar lançamentos."})
	}

	return c.JSON(lancamentos)
}

// CriarLancamentoRequest DTO para lançamento avulso
type CriarLancamentoRequest struct {
	Tipo            string  `json:"tipo"` // ENTRADA, SAIDA
	Categoria       string  `json:"categoria"`
	Valor           float64 `json:"valor"`
	Descricao       string  `json:"descricao"`
	DataCompetencia string  `json:"data_competencia"`
	FormaPagamento  string  `json:"forma_pagamento"`
	Status          string  `json:"status"`
}

// CriarLancamento insere uma despesa ou receita manual no livro caixa
func CriarLancamento(c *fiber.Ctx) error {
	var req CriarLancamentoRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Dados inválidos."})
	}

	if req.Valor <= 0 || req.Descricao == "" {
		return c.Status(400).JSON(fiber.Map{"erro": "Informe uma descrição e um valor maior que zero."})
	}

	dataComp, err := time.Parse("2006-01-02", req.DataCompetencia)
	if err != nil || dataComp.IsZero() {
		dataComp = time.Now()
	}

	tipo := strings.ToUpper(req.Tipo)
	if tipo != "ENTRADA" && tipo != "SAIDA" {
		tipo = "SAIDA"
	}

	status := strings.ToUpper(req.Status)
	if status == "" {
		status = "REALIZADO"
	}

	forma := req.FormaPagamento
	if forma == "" {
		forma = "PIX"
	}

	agora := time.Now()
	lanc := models.LancamentoFinanceiro{
		Tipo:            tipo,
		Categoria:       strings.ToUpper(req.Categoria),
		Valor:           math.Round(req.Valor*100) / 100,
		DataCompetencia: dataComp,
		DataVencimento:  dataComp,
		DataLiquidacao:  &agora,
		Status:          status,
		FormaPagamento:  forma,
		Descricao:       req.Descricao,
	}

	if err := config.DB.Create(&lanc).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"erro": "Falha ao gravar lançamento: " + err.Error()})
	}

	return c.Status(201).JSON(lanc)
}

// ExportarRelatorioContabil gera o arquivo CSV padronizado para escritórios de contabilidade
func ExportarRelatorioContabil(c *fiber.Ctx) error {
	var lancamentos []models.LancamentoFinanceiro
	config.DB.Preload("FechamentoMedidor.Medidor").
		Order("data_competencia ASC").
		Find(&lancamentos)

	var sb strings.Builder
	sb.WriteString("ID;DATA_COMPETENCIA;TIPO;CATEGORIA;DESCRICAO;VALOR;FORMA_PAGAMENTO;STATUS;BENEFICIARIO_DOCUMENTO\n")

	for _, l := range lancamentos {
		beneficiario := "SGM PRO"
		if l.FechamentoMedidor != nil {
			beneficiario = fmt.Sprintf("%s (CPF: %s)", l.FechamentoMedidor.Medidor.NomeCompleto, l.FechamentoMedidor.Medidor.Cpf)
		}

		linha := fmt.Sprintf("%d;%s;%s;%s;%s;%.2f;%s;%s;%s\n",
			l.ID,
			l.DataCompetencia.Format("02/01/2006"),
			l.Tipo,
			l.Categoria,
			strings.ReplaceAll(l.Descricao, ";", "-"),
			l.Valor,
			l.FormaPagamento,
			l.Status,
			beneficiario,
		)
		sb.WriteString(linha)
	}

	c.Set("Content-Type", "text/csv; charset=utf-8")
	c.Set("Content-Disposition", "attachment; filename=relatorio_contabil_sgm_pro.csv")
	return c.SendString(sb.String())
}
