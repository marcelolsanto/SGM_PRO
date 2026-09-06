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

// GerarLotesMensaisAutomaticos consolida automaticamente todas as OSs do mês anterior (ou atual) em lotes
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

	// 1. Busca todas as OSs concluídas no período
	var ordens []models.OrdemServico
	err := config.DB.Preload("Medidor").Preload("Loja").
		Where("status IN ('CONCLUIDO', 'CONCLUIDA', 'VALIDADA')").
		Where("medidor_id IS NOT NULL").
		Where("(data_conclusao BETWEEN ? AND ?) OR (data_conclusao IS NULL AND criado_em BETWEEN ? AND ?)", dataInicio, dataFim, dataInicio, dataFim).
		Find(&ordens).Error

	if err != nil {
		return nil, fmt.Errorf("falha ao buscar ordens para fechamento: %v", err)
	}

	// 2. Busca OSs que já estão vinculadas a lotes ativos
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

	// 3. Agrupa por medidor
	ordensPorMedidor := make(map[uint][]models.OrdemServico)
	for _, o := range ordens {
		if mapEmLote[o.ID] {
			continue // Já faturada
		}
		if o.MedidorID != nil {
			ordensPorMedidor[*o.MedidorID] = append(ordensPorMedidor[*o.MedidorID], o)
		}
	}

	var lotesCriados []models.FechamentoMedidor

	// 4. Cria o lote automático para cada medidor que tenha medições
	for medidorID, osLista := range ordensPorMedidor {
		if len(osLista) == 0 {
			continue
		}

		var totalMaoObra, totalDesloc, totalAdic, totalBruto float64
		for _, it := range osLista {
			mObra := it.MaoDeObraMedidor
			if mObra == 0 {
				mObra = it.CustoMedidor - it.TaxaDeslocamento - it.AdicionalUrgencia
				if mObra < 0 {
					mObra = it.CustoMedidor
				}
			}
			totalMaoObra += mObra
			totalDesloc += it.TaxaDeslocamento
			totalAdic += it.AdicionalUrgencia
			totalBruto += it.CustoMedidor
		}

		var medidor models.Medidor
		config.DB.First(&medidor, medidorID)

		// Determina enquadramento fiscal padrão
		tipoFiscal := "MEI"
		var retencoes float64
		// Se CPF tiver menos de 14 caracteres ou não tiver CNPJ, calcula prévia RPA
		if len(medidor.Cpf) <= 14 {
			tipoFiscal = "RPA"
			// 11% INSS até o teto
			inss := totalMaoObra * 0.11
			if inss > 908.85 {
				inss = 908.85
			}
			retencoes = inss
		}

		valorLiquido := totalBruto - retencoes

		// Gera número de protocolo
		var contagem int64
		config.DB.Model(&models.FechamentoMedidor{}).
			Where("periodo_inicio >= ?", dataInicio).
			Count(&contagem)

		numeroLote := fmt.Sprintf("LOT-%04d%02d-M%d-%03d", ano, mes, medidorID, contagem+1)

		fechamento := models.FechamentoMedidor{
			MedidorID:              medidorID,
			NumeroLote:             numeroLote,
			PeriodoInicio:          dataInicio,
			PeriodoFim:             dataFim,
			QuantidadeOS:           len(osLista),
			ValorMaoDeObra:         math.Round(totalMaoObra*100) / 100,
			ValorDeslocamento:      math.Round(totalDesloc*100) / 100,
			ValorAdicionais:        math.Round(totalAdic*100) / 100,
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
			log.Printf("⚠️ Erro ao criar lote automático para medidor %d: %v\n", medidorID, err)
			continue
		}

		// Cria itens
		for _, it := range osLista {
			item := models.FechamentoMedidorItem{
				FechamentoID:      fechamento.ID,
				OrdemServicoID:    it.ID,
				ValorMaoDeObra:    it.MaoDeObraMedidor,
				ValorDeslocamento: it.TaxaDeslocamento,
				ValorAdicionais:   it.AdicionalUrgencia,
				ValorTotalItem:    it.CustoMedidor,
				StatusItem:        "VALIDADO",
			}
			config.DB.Create(&item)
		}

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
