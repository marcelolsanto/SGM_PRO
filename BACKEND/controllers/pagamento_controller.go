package controllers

import (
	"fmt"
	"strings"
	"time"

	"workspace/backend/config"
	"workspace/backend/models"

	"github.com/gofiber/fiber/v2"
)

// calculaCRC16 gera o checksum CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF) conforme padrão do Banco Central do Brasil (BCB) para PIX EMV
func calculaCRC16(payload string) string {
	crc := uint16(0xFFFF)
	polynomial := uint16(0x1021)
	bytes := []byte(payload)

	for _, b := range bytes {
		crc ^= uint16(b) << 8
		for j := 0; j < 8; j++ {
			if (crc & 0x8000) != 0 {
				crc = (crc << 1) ^ polynomial
			} else {
				crc = crc << 1
			}
		}
	}
	return fmt.Sprintf("%04X", crc&0xFFFF)
}

// formataCampoEMV formata uma tag TLV (Tag, Length, Value)
func formataCampoEMV(id string, valor string) string {
	tamanho := len(valor)
	return fmt.Sprintf("%s%02d%s", id, tamanho, valor)
}

// gerarPayloadPixBrCode monta a string oficial do Pix Copia e Cola (BR Code)
func gerarPayloadPixBrCode(chavePix string, nomeRecebedor string, cidade string, valor float64, txid string) string {
	if nomeRecebedor == "" {
		nomeRecebedor = "SGM PRO INTERMEDIACAO"
	}
	// Limita nome a 25 caracteres (padrão EMV)
	if len(nomeRecebedor) > 25 {
		nomeRecebedor = nomeRecebedor[:25]
	}

	if cidade == "" {
		cidade = "SAO PAULO"
	}
	if len(cidade) > 15 {
		cidade = cidade[:15]
	}

	if txid == "" {
		txid = "***"
	}

	// Tag 26: Merchant Account Information
	gui := formataCampoEMV("00", "br.gov.bcb.pix")
	key := formataCampoEMV("01", chavePix)
	merchantAccount := formataCampoEMV("26", gui+key)

	// Tag 54: Transaction Amount
	valorStr := fmt.Sprintf("%.2f", valor)
	valorEMV := formataCampoEMV("54", valorStr)

	// Tag 62: Additional Data Field (TXID)
	txidEMV := formataCampoEMV("05", txid)
	additionalData := formataCampoEMV("62", txidEMV)

	// Montagem do corpo antes do CRC
	corpo := formataCampoEMV("00", "01") + // Payload Format Indicator
		merchantAccount +
		formataCampoEMV("52", "0000") + // Merchant Category Code
		formataCampoEMV("53", "986") + // Transaction Currency (986 = Real BRL)
		valorEMV +
		formataCampoEMV("58", "BR") + // Country Code
		formataCampoEMV("59", strings.ToUpper(nomeRecebedor)) + // Merchant Name
		formataCampoEMV("60", strings.ToUpper(cidade)) + // Merchant City
		additionalData +
		"6304" // Tag do CRC16 com tamanho 04

	crc := calculaCRC16(corpo)
	return corpo + crc
}

// GerarPixOS gera os dados para cobrança PIX com split automático da OS
func GerarPixOS(c *fiber.Ctx) error {
	id := c.Params("id")

	var os models.OrdemServico
	if err := config.DB.Preload("Loja").Preload("Medidor").Preload("Ambientes").First(&os, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Ordem de serviço não encontrada"})
	}

	gmvTotal := os.ValorTotalOS
	repasseMedidor := os.CustoMedidor
	margemSgm := gmvTotal - repasseMedidor
	if margemSgm < 0 {
		margemSgm = 0
	}

	takeRatePct := 0.0
	if gmvTotal > 0 {
		takeRatePct = (margemSgm / gmvTotal) * 100.0
	}

	// Informações do medidor parceiro para split
	medidorNome := "Aguardando Atribuição"
	chavePixMedidor := "Não cadastrada"
	tipoChaveMedidor := "N/A"

	if os.Medidor != nil {
		medidorNome = os.Medidor.NomeCompleto
		if os.Medidor.ChavePix != "" {
			chavePixMedidor = os.Medidor.ChavePix
			tipoChaveMedidor = os.Medidor.TipoChavePix
		}
	}

	// Chave PIX do SGM para liquidação da OS e split automático
	chavePixSGM := "financeiro@sgm.pro"
	txid := fmt.Sprintf("OS%04d", os.ID)

	// Gera o Pix Copia e Cola padrão BACEN
	pixCopiaECola := gerarPayloadPixBrCode(chavePixSGM, "SGM PRO INTERMEDIACAO", "SAO PAULO", gmvTotal, txid)

	// Salva na OS caso ainda não estivesse salvo
	if os.PixCopiaECola == "" || os.PixCopiaECola != pixCopiaECola {
		os.PixCopiaECola = pixCopiaECola
		config.DB.Model(&os).Update("pix_copia_e_cola", pixCopiaECola)
	}

	return c.JSON(fiber.Map{
		"os_id":            os.ID,
		"cliente_nome":    os.ClienteNome,
		"loja_nome":       os.Loja.NomeFantasia,
		"status_pagamento": os.StatusPagamento,
		"data_pagamento":   os.DataPagamento,
		"valor_total":      gmvTotal,
		"pix_copia_e_cola": pixCopiaECola,
		"split": fiber.Map{
			"gmv_total":                  gmvTotal,
			"repasse_medidor":            repasseMedidor,
			"mao_de_obra_medidor":        os.MaoDeObraMedidor,
			"adicional_urgencia_medidor": os.AdicionalUrgencia,
			"taxa_deslocamento":          os.TaxaDeslocamento,
			"km_deslocamento":            os.KmDeslocamento,
			"tempo_deslocamento_min":     os.TempoDeslocamentoMin,
			"origem_deslocamento":        os.OrigemDeslocamento,
			"urgencia":                   os.Urgencia,
			"medidor_nome":               medidorNome,
			"chave_pix_medidor":          chavePixMedidor,
			"tipo_chave_medidor":         tipoChaveMedidor,
			"margem_sgm":                 margemSgm,
			"take_rate_percentual":       takeRatePct,
		},
	})
}

// ConfirmarPagamentoOS atualiza o status financeiro da OS para PAGO
func ConfirmarPagamentoOS(c *fiber.Ctx) error {
	id := c.Params("id")

	var os models.OrdemServico
	if err := config.DB.Preload("Loja").Preload("Medidor").First(&os, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Ordem de serviço não encontrada"})
	}

	agora := time.Now()
	os.StatusPagamento = "PAGO"
	os.DataPagamento = &agora

	if err := config.DB.Save(&os).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"erro": "Erro ao atualizar status de pagamento"})
	}

	return c.JSON(fiber.Map{
		"mensagem":         "Pagamento registrado com sucesso via PIX!",
		"status_pagamento": os.StatusPagamento,
		"data_pagamento":   os.DataPagamento,
		"os":               os,
	})
}
