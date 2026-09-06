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

// ObterFluxoCaixa retorna o DRE operacional, fluxo de caixa e saldo consolidado com filtros
func ObterFluxoCaixa(c *fiber.Ctx) error {
	perfil, refID := getPerfilERefID(c)
	redeID := getRedeID(c)

	anoStr := c.Query("ano", "2026")
	mesStr := c.Query("mes", "TODOS")
	lojaIDStr := c.Query("loja_id", "TODAS")
	medidorIDStr := c.Query("medidor_id", "TODOS")

	ano := time.Now().Year()
	if a, err := strconv.Atoi(anoStr); err == nil && a > 2000 {
		ano = a
	}

	var dataInicio, dataFim time.Time
	mesInt, errMes := strconv.Atoi(mesStr)
	temFiltroMes := errMes == nil && mesInt >= 1 && mesInt <= 12

	if temFiltroMes {
		dataInicio = time.Date(ano, time.Month(mesInt), 1, 0, 0, 0, 0, time.Local)
		dataFim = dataInicio.AddDate(0, 1, 0).Add(-time.Nanosecond)
	} else {
		dataInicio = time.Date(ano, 1, 1, 0, 0, 0, 0, time.Local)
		dataFim = time.Date(ano, 12, 31, 23, 59, 59, 999999999, time.Local)
	}

	// 1. Consulta agregada de Ordens de Serviço (Receitas / Faturamento das Lojas)
	type ResumoMes struct {
		Mes   int     `gorm:"column:mes"`
		Total float64 `gorm:"column:total"`
	}
	var resumos []ResumoMes
	qOS := config.DB.Table("ordem_servicos").
		Select("EXTRACT(MONTH FROM criado_em)::int AS mes, COALESCE(SUM(valor_total_os), 0) AS total").
		Where("criado_em BETWEEN ? AND ?", dataInicio, dataFim)

	// Filtro multi-tenant de loja/rede
	if perfil == "LOJA" {
		if redeID > 0 {
			if lojaIDStr != "" && lojaIDStr != "TODAS" {
				qOS = qOS.Where("loja_id = ? AND loja_id IN (SELECT id FROM lojas WHERE rede_id = ? OR id = ?)", lojaIDStr, redeID, refID)
			} else {
				qOS = qOS.Where("loja_id IN (SELECT id FROM lojas WHERE rede_id = ? OR id = ?)", redeID, refID)
			}
		} else {
			qOS = qOS.Where("loja_id = ?", refID)
		}
	} else {
		if lojaIDStr != "" && lojaIDStr != "TODAS" {
			qOS = qOS.Where("loja_id = ?", lojaIDStr)
		}
	}

	// Filtro de medidor
	if perfil == "MEDIDOR" {
		qOS = qOS.Where("medidor_id = ?", refID)
	} else {
		if medidorIDStr != "" && medidorIDStr != "TODOS" {
			qOS = qOS.Where("medidor_id = ?", medidorIDStr)
		}
	}

	qOS.Group("EXTRACT(MONTH FROM criado_em)").Scan(&resumos)

	// 2. Consulta de Lançamentos Financeiros (Saídas / Repasses / Despesas / Entradas Manuais)
	qLanc := config.DB.Where("data_competencia BETWEEN ? AND ?", dataInicio, dataFim)

	if perfil == "LOJA" {
		if redeID > 0 {
			if lojaIDStr != "" && lojaIDStr != "TODAS" {
				qLanc = qLanc.Where("(loja_id = ? OR fechamento_medidor_id IN (SELECT fmi.fechamento_id FROM fechamento_medidor_itens fmi JOIN ordem_servicos os ON os.id = fmi.ordem_servico_id WHERE os.loja_id = ?))", lojaIDStr, lojaIDStr)
			} else {
				qLanc = qLanc.Where("(loja_id IN (SELECT id FROM lojas WHERE rede_id = ? OR id = ?) OR fechamento_medidor_id IN (SELECT fmi.fechamento_id FROM fechamento_medidor_itens fmi JOIN ordem_servicos os ON os.id = fmi.ordem_servico_id WHERE os.loja_id IN (SELECT id FROM lojas WHERE rede_id = ? OR id = ?)))", redeID, refID, redeID, refID)
			}
		} else {
			qLanc = qLanc.Where("(loja_id = ? OR fechamento_medidor_id IN (SELECT fmi.fechamento_id FROM fechamento_medidor_itens fmi JOIN ordem_servicos os ON os.id = fmi.ordem_servico_id WHERE os.loja_id = ?))", refID, refID)
		}
	} else {
		if lojaIDStr != "" && lojaIDStr != "TODAS" {
			qLanc = qLanc.Where("(loja_id = ? OR fechamento_medidor_id IN (SELECT fmi.fechamento_id FROM fechamento_medidor_itens fmi JOIN ordem_servicos os ON os.id = fmi.ordem_servico_id WHERE os.loja_id = ?))", lojaIDStr, lojaIDStr)
		}
	}

	if perfil == "MEDIDOR" {
		qLanc = qLanc.Where("fechamento_medidor_id IN (SELECT id FROM fechamento_medidores WHERE medidor_id = ?)", refID)
	} else {
		if medidorIDStr != "" && medidorIDStr != "TODOS" {
			qLanc = qLanc.Where("fechamento_medidor_id IN (SELECT id FROM fechamento_medidores WHERE medidor_id = ?)", medidorIDStr)
		}
	}

	var lancamentos []models.LancamentoFinanceiro
	qLanc.Order("data_competencia ASC").Find(&lancamentos)

	var totalEntradas, totalSaidas float64
	mesesEntradas := make([]float64, 12)
	mesesSaidas := make([]float64, 12)

	// Processa receitas de OSs
	for _, r := range resumos {
		mesIdx := r.Mes - 1
		if mesIdx >= 0 && mesIdx < 12 {
			totalEntradas += r.Total
			mesesEntradas[mesIdx] += r.Total
		}
	}

	// Processa lançamentos registrados
	for _, l := range lancamentos {
		mesIdx := int(l.DataCompetencia.Month()) - 1
		if mesIdx >= 0 && mesIdx < 12 {
			if l.Tipo == "SAIDA" {
				totalSaidas += l.Valor
				mesesSaidas[mesIdx] += l.Valor
			} else if l.Tipo == "ENTRADA" {
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
		"mes_filtrado":      mesStr,
		"total_entradas":    math.Round(totalEntradas*100) / 100,
		"total_saidas":      math.Round(totalSaidas*100) / 100,
		"lucro_liquido":     math.Round(lucroLiquido*100) / 100,
		"margem_percentual": math.Round(margemPercentual*10) / 10,
		"grafico_mensal":    graficoMensal,
	})
}

// ListarLancamentos retorna os registros do Livro Caixa com suporte a filtros
func ListarLancamentos(c *fiber.Ctx) error {
	perfil, refID := getPerfilERefID(c)
	redeID := getRedeID(c)

	query := config.DB.Preload("FechamentoMedidor.Medidor").
		Preload("Loja").
		Order("data_competencia DESC")

	anoStr := c.Query("ano")
	if a, err := strconv.Atoi(anoStr); err == nil && a > 2000 {
		query = query.Where("EXTRACT(YEAR FROM data_competencia) = ?", a)
	}

	mesStr := c.Query("mes")
	if m, err := strconv.Atoi(mesStr); err == nil && m >= 1 && m <= 12 {
		query = query.Where("EXTRACT(MONTH FROM data_competencia) = ?", m)
	}

	lojaIDStr := c.Query("loja_id")
	if perfil == "LOJA" {
		if redeID > 0 {
			if lojaIDStr != "" && lojaIDStr != "TODAS" {
				query = query.Where("(loja_id = ? OR fechamento_medidor_id IN (SELECT fmi.fechamento_id FROM fechamento_medidor_itens fmi JOIN ordem_servicos os ON os.id = fmi.ordem_servico_id WHERE os.loja_id = ?))", lojaIDStr, lojaIDStr)
			} else {
				query = query.Where("(loja_id IN (SELECT id FROM lojas WHERE rede_id = ? OR id = ?) OR fechamento_medidor_id IN (SELECT fmi.fechamento_id FROM fechamento_medidor_itens fmi JOIN ordem_servicos os ON os.id = fmi.ordem_servico_id WHERE os.loja_id IN (SELECT id FROM lojas WHERE rede_id = ? OR id = ?)))", redeID, refID, redeID, refID)
			}
		} else {
			query = query.Where("(loja_id = ? OR fechamento_medidor_id IN (SELECT fmi.fechamento_id FROM fechamento_medidor_itens fmi JOIN ordem_servicos os ON os.id = fmi.ordem_servico_id WHERE os.loja_id = ?))", refID, refID)
		}
	} else {
		if lojaIDStr != "" && lojaIDStr != "TODAS" {
			query = query.Where("(loja_id = ? OR fechamento_medidor_id IN (SELECT fmi.fechamento_id FROM fechamento_medidor_itens fmi JOIN ordem_servicos os ON os.id = fmi.ordem_servico_id WHERE os.loja_id = ?))", lojaIDStr, lojaIDStr)
		}
	}

	medidorIDStr := c.Query("medidor_id")
	if perfil == "MEDIDOR" {
		query = query.Where("fechamento_medidor_id IN (SELECT id FROM fechamento_medidores WHERE medidor_id = ?)", refID)
	} else {
		if medidorIDStr != "" && medidorIDStr != "TODOS" {
			query = query.Where("fechamento_medidor_id IN (SELECT id FROM fechamento_medidores WHERE medidor_id = ?)", medidorIDStr)
		}
	}

	if tipo := c.Query("tipo"); tipo != "" && tipo != "TODOS" {
		query = query.Where("tipo = ?", strings.ToUpper(tipo))
	}
	if cat := c.Query("categoria"); cat != "" && cat != "TODAS" {
		query = query.Where("categoria = ?", strings.ToUpper(cat))
	}
	if status := c.Query("status"); status != "" && status != "TODOS" {
		query = query.Where("status = ?", strings.ToUpper(status))
	}

	var lancamentos []models.LancamentoFinanceiro
	if err := query.Limit(200).Find(&lancamentos).Error; err != nil {
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

// ExportarRelatorioContabil gera o arquivo CSV padronizado respeitando os filtros ativos
func ExportarRelatorioContabil(c *fiber.Ctx) error {
	perfil, refID := getPerfilERefID(c)
	redeID := getRedeID(c)

	query := config.DB.Preload("FechamentoMedidor.Medidor").
		Preload("Loja").
		Order("data_competencia ASC")

	anoStr := c.Query("ano")
	if a, err := strconv.Atoi(anoStr); err == nil && a > 2000 {
		query = query.Where("EXTRACT(YEAR FROM data_competencia) = ?", a)
	}

	mesStr := c.Query("mes")
	if m, err := strconv.Atoi(mesStr); err == nil && m >= 1 && m <= 12 {
		query = query.Where("EXTRACT(MONTH FROM data_competencia) = ?", m)
	}

	lojaIDStr := c.Query("loja_id")
	if perfil == "LOJA" {
		if redeID > 0 {
			if lojaIDStr != "" && lojaIDStr != "TODAS" {
				query = query.Where("(loja_id = ? OR fechamento_medidor_id IN (SELECT fmi.fechamento_id FROM fechamento_medidor_itens fmi JOIN ordem_servicos os ON os.id = fmi.ordem_servico_id WHERE os.loja_id = ?))", lojaIDStr, lojaIDStr)
			} else {
				query = query.Where("(loja_id IN (SELECT id FROM lojas WHERE rede_id = ? OR id = ?) OR fechamento_medidor_id IN (SELECT fmi.fechamento_id FROM fechamento_medidor_itens fmi JOIN ordem_servicos os ON os.id = fmi.ordem_servico_id WHERE os.loja_id IN (SELECT id FROM lojas WHERE rede_id = ? OR id = ?)))", redeID, refID, redeID, refID)
			}
		} else {
			query = query.Where("(loja_id = ? OR fechamento_medidor_id IN (SELECT fmi.fechamento_id FROM fechamento_medidor_itens fmi JOIN ordem_servicos os ON os.id = fmi.ordem_servico_id WHERE os.loja_id = ?))", refID, refID)
		}
	} else {
		if lojaIDStr != "" && lojaIDStr != "TODAS" {
			query = query.Where("(loja_id = ? OR fechamento_medidor_id IN (SELECT fmi.fechamento_id FROM fechamento_medidor_itens fmi JOIN ordem_servicos os ON os.id = fmi.ordem_servico_id WHERE os.loja_id = ?))", lojaIDStr, lojaIDStr)
		}
	}

	medidorIDStr := c.Query("medidor_id")
	if perfil == "MEDIDOR" {
		query = query.Where("fechamento_medidor_id IN (SELECT id FROM fechamento_medidores WHERE medidor_id = ?)", refID)
	} else {
		if medidorIDStr != "" && medidorIDStr != "TODOS" {
			query = query.Where("fechamento_medidor_id IN (SELECT id FROM fechamento_medidores WHERE medidor_id = ?)", medidorIDStr)
		}
	}

	var lancamentos []models.LancamentoFinanceiro
	query.Find(&lancamentos)

	var sb strings.Builder
	sb.WriteString("ID;DATA_COMPETENCIA;TIPO;CATEGORIA;DESCRICAO;VALOR;FORMA_PAGAMENTO;STATUS;BENEFICIARIO_DOCUMENTO\n")

	for _, l := range lancamentos {
		beneficiario := "SGM PRO"
		if l.FechamentoMedidor != nil {
			beneficiario = fmt.Sprintf("%s (CPF: %s)", l.FechamentoMedidor.Medidor.NomeCompleto, l.FechamentoMedidor.Medidor.Cpf)
		} else if l.Loja != nil {
			beneficiario = fmt.Sprintf("%s (CNPJ: %s)", l.Loja.NomeFantasia, l.Loja.CNPJ)
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

	nomeArquivo := "relatorio_contabil_sgm_pro"
	if anoStr != "" && anoStr != "TODOS" {
		nomeArquivo += "_" + anoStr
	}
	if mesStr != "" && mesStr != "TODOS" {
		nomeArquivo += "_" + mesStr
	}
	nomeArquivo += ".csv"

	c.Set("Content-Type", "text/csv; charset=utf-8")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", nomeArquivo))
	return c.SendString(sb.String())
}
