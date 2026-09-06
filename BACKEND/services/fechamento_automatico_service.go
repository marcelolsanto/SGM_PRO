package services

import (
	"fmt"
	"log"
	"math"
	"time"

	"workspace/backend/config"
	"workspace/backend/models"
)

// CalcularQuintoDiaUtil calcula a data exata do 5º dia útil do mês
func CalcularQuintoDiaUtil(ano int, mes int) time.Time {
	diaUtilCount := 0
	dia := 1
	var t time.Time

	for dia <= 20 {
		t = time.Date(ano, time.Month(mes), dia, 18, 0, 0, 0, time.Local)
		if t.Month() != time.Month(mes) {
			break
		}
		// Segunda a Sexta são dias úteis (não considera feriados bancários móveis para cálculo padrão)
		if t.Weekday() != time.Saturday && t.Weekday() != time.Sunday {
			diaUtilCount++
			if diaUtilCount == 5 {
				return t
			}
		}
		dia++
	}
	return t
}

// ProvisionarFinanceiroOS registra em tempo real a receita e a provisão de repasse no Livro Caixa
func ProvisionarFinanceiroOS(os *models.OrdemServico) {
	if os == nil || os.ID == 0 {
		return
	}

	now := time.Now()
	dataComp := now
	if os.DataConclusao != nil {
		dataComp = *os.DataConclusao
	}

	// 1. Provisão de Saída (Repasse ao Medidor)
	if os.CustoMedidor > 0 {
		var existeRepasse int64
		config.DB.Model(&models.LancamentoFinanceiro{}).
			Where("ordem_servico_id = ? AND categoria = 'REPASSE_MEDIDOR'", os.ID).
			Count(&existeRepasse)

		if existeRepasse == 0 {
			vencimento := CalcularQuintoDiaUtil(now.Year(), int(now.Month()))
			repasse := models.LancamentoFinanceiro{
				Tipo:            "SAIDA",
				Categoria:       "REPASSE_MEDIDOR",
				Valor:           os.CustoMedidor,
				DataCompetencia: dataComp,
				DataVencimento:  vencimento,
				Status:          "PREVISTO",
				FormaPagamento:  "PIX",
				OrdemServicoID:  &os.ID,
				Descricao:       fmt.Sprintf("Provisão de Repasse OS #%04d - %s", os.ID, os.ClienteNome),
			}
			config.DB.Create(&repasse)
		}
	}

	// 2. Receita da Loja (Faturamento da Plataforma)
	if os.ValorTotalOS > 0 {
		var existeEntrada int64
		config.DB.Model(&models.LancamentoFinanceiro{}).
			Where("ordem_servico_id = ? AND categoria = 'FATURAMENTO_LOJA'", os.ID).
			Count(&existeEntrada)

		if existeEntrada == 0 {
			entrada := models.LancamentoFinanceiro{
				Tipo:            "ENTRADA",
				Categoria:       "FATURAMENTO_LOJA",
				Valor:           os.ValorTotalOS,
				DataCompetencia: dataComp,
				DataVencimento:  dataComp,
				DataLiquidacao:  &now,
				Status:          "REALIZADO",
				FormaPagamento:  "PIX",
				OrdemServicoID:  &os.ID,
				LojaID:          &os.LojaID,
				Descricao:       fmt.Sprintf("Faturamento Loja OS #%04d - %s", os.ID, os.ClienteNome),
			}
			config.DB.Create(&entrada)
		}
	}
}

// GerarLotesMensaisAutomaticos consolida automaticamente todas as OSs do mês em lotes
func GerarLotesMensaisAutomaticos(ano int, mes int) ([]models.FechamentoMedidor, error) {
	agora := time.Now()

	// Se não informado, adota o mês anterior (ciclo fechado com vencimento no 5º dia útil deste mês)
	if ano == 0 || mes == 0 {
		mesAnterior := agora.AddDate(0, -1, 0)
		ano = mesAnterior.Year()
		mes = int(mesAnterior.Month())
	}

	dataInicio := time.Date(ano, time.Month(mes), 1, 0, 0, 0, 0, time.Local)
	dataFim := time.Date(ano, time.Month(mes+1), 0, 23, 59, 59, 999999999, time.Local)

	// 1. Agregação em SQL de alta performance das OSs concluídas por medidor
	type AgregadoMedidor struct {
		MedidorID         uint    `gorm:"column:medidor_id"`
		QtdOS             int     `gorm:"column:qtd_os"`
		TotalBruto        float64 `gorm:"column:total_bruto"`
		TotalMaoDeObra    float64 `gorm:"column:total_mao_de_obra"`
		TotalDeslocamento float64 `gorm:"column:total_deslocamento"`
		TotalAdicionais   float64 `gorm:"column:total_adicionais"`
	}

	var agregados []AgregadoMedidor
	subQuery := config.DB.Table("fechamento_medidor_itens").
		Select("ordem_servico_id").
		Joins("JOIN fechamento_medidores ON fechamento_medidores.id = fechamento_medidor_itens.fechamento_id").
		Where("fechamento_medidores.status != 'RECUSADO'")

	err := config.DB.Table("ordem_servicos").
		Select(`medidor_id,
			COUNT(*) AS qtd_os,
			COALESCE(SUM(custo_medidor), 0) AS total_bruto,
			COALESCE(SUM(mao_de_obra_medidor), 0) AS total_mao_de_obra,
			COALESCE(SUM(taxa_deslocamento), 0) AS total_deslocamento,
			COALESCE(SUM(adicional_urgencia), 0) AS total_adicionais`).
		Where("status IN ('CONCLUIDO', 'CONCLUIDA', 'VALIDADA')").
		Where("medidor_id IS NOT NULL").
		Where("criado_em BETWEEN ? AND ?", dataInicio, dataFim).
		Where("id NOT IN (?)", subQuery).
		Group("medidor_id").
		Scan(&agregados).Error

	if err != nil {
		return nil, fmt.Errorf("falha ao agregar ordens para fechamento: %v", err)
	}

	if len(agregados) == 0 {
		return []models.FechamentoMedidor{}, nil
	}

	// 2. Busca dados cadastrais dos medidores envolvidos em uma única consulta
	var medidorIDs []uint
	for _, a := range agregados {
		medidorIDs = append(medidorIDs, a.MedidorID)
	}
	var medidores []models.Medidor
	config.DB.Where("id IN (?)", medidorIDs).Find(&medidores)
	mapMedidores := make(map[uint]models.Medidor)
	for _, m := range medidores {
		mapMedidores[m.ID] = m
	}

	var lotesCriados []models.FechamentoMedidor

	// 3. Criação dos lotes consolidados e vinculação rápida de itens
	for i, ag := range agregados {
		medidor := mapMedidores[ag.MedidorID]
		totalBruto := ag.TotalBruto
		totalMaoObra := ag.TotalMaoDeObra
		if totalMaoObra == 0 {
			totalMaoObra = totalBruto - ag.TotalDeslocamento - ag.TotalAdicionais
			if totalMaoObra < 0 {
				totalMaoObra = totalBruto
			}
		}

		// Determina enquadramento fiscal padrão
		tipoFiscal := "MEI"
		var retencoes float64
		if len(medidor.Cpf) <= 14 {
			tipoFiscal = "RPA"
			inss := totalMaoObra * 0.11
			if inss > 908.85 {
				inss = 908.85
			}
			retencoes = inss
		}

		valorLiquido := totalBruto - retencoes
		numeroLote := fmt.Sprintf("LOT-%04d%02d-M%d-%03d", ano, mes, ag.MedidorID, i+1)

		fechamento := models.FechamentoMedidor{
			MedidorID:              ag.MedidorID,
			NumeroLote:             numeroLote,
			PeriodoInicio:          dataInicio,
			PeriodoFim:             dataFim,
			QuantidadeOS:           ag.QtdOS,
			ValorMaoDeObra:         math.Round(totalMaoObra*100) / 100,
			ValorDeslocamento:      math.Round(ag.TotalDeslocamento*100) / 100,
			ValorAdicionais:        math.Round(ag.TotalAdicionais*100) / 100,
			ValorBruto:             math.Round(totalBruto*100) / 100,
			ValorRetencoesImpostos: math.Round(retencoes*100) / 100,
			ValorLiquido:           math.Round(valorLiquido*100) / 100,
			Status:                 "ENVIADO_CONFERENCIA",
			TipoDocumentoFiscal:    tipoFiscal,
			ChavePix:               medidor.ChavePix,
			TipoChavePix:           medidor.TipoChavePix,
			ObservacoesFinanceiro:  "Lote consolidado automaticamente pelo motor do SGM.PRO. Vencimento previsto para o 5º dia útil.",
		}

		if err := config.DB.Create(&fechamento).Error; err != nil {
			log.Printf("⚠️ Erro ao criar lote para medidor %d: %v\n", ag.MedidorID, err)
			continue
		}

		// Vincula as OSs ao lote em um único comando SQL em lote
		sqlVincular := `INSERT INTO fechamento_medidor_itens 
			(fechamento_id, ordem_servico_id, valor_mao_de_obra, valor_deslocamento, valor_adicionais, valor_total_item, status_item, criado_em, atualizado_em)
			SELECT ?, id, mao_de_obra_medidor, taxa_deslocamento, adicional_urgencia, custo_medidor, 'VALIDADO', NOW(), NOW()
			FROM ordem_servicos
			WHERE medidor_id = ? 
			  AND status IN ('CONCLUIDO', 'CONCLUIDA', 'VALIDADA')
			  AND criado_em BETWEEN ? AND ?
			  AND id NOT IN (
				  SELECT ordem_servico_id FROM fechamento_medidor_itens fmi
				  JOIN fechamento_medidores fm ON fm.id = fmi.fechamento_id
				  WHERE fm.status != 'RECUSADO'
			  )`
		config.DB.Exec(sqlVincular, fechamento.ID, ag.MedidorID, dataInicio, dataFim)

		lotesCriados = append(lotesCriados, fechamento)
	}

	return lotesCriados, nil
}

// IniciarSchedulerFinanceiro roda em segundo plano verificando a virada de mês
func IniciarSchedulerFinanceiro() {
	go func() {
		log.Println("⏱️ Scheduler Financeiro iniciado: monitorando viradas de mês e provisões automáticas...")
		// Roda uma verificação inicial 30 segundos após o boot
		time.Sleep(30 * time.Second)
		lotes, err := GerarLotesMensaisAutomaticos(0, 0)
		if err == nil && len(lotes) > 0 {
			log.Printf("⚡ [Auto-Fechamento] %d lote(s) mensal(is) gerado(s) automaticamente na inicialização!\n", len(lotes))
		}

		// Roda a cada 6 horas
		ticker := time.NewTicker(6 * time.Hour)
		defer ticker.Stop()

		for range ticker.C {
			agora := time.Now()
			// Executa a conferência automática
			lotes, err := GerarLotesMensaisAutomaticos(0, 0)
			if err == nil && len(lotes) > 0 {
				log.Printf("⚡ [Auto-Fechamento] %s: %d lote(s) gerado(s) automaticamente!\n", agora.Format("02/01 15:04"), len(lotes))
			}
		}
	}()
}
