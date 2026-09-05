package main

import (
	"log"
	"workspace/backend/config"
	"workspace/backend/models"
)

// ExecutarSeed insere dados mínimos compatíveis com as structs atuais do banco
func ExecutarSeed() {
	log.Println("🌱 Iniciando o cadastro de dados de teste...")

	// 1. CADASTRAR UMA LOJA EXEMPLO (usando models.Loja)
	loja := models.Loja{
		NomeFantasia: "Marcenaria Imperial",
		CNPJ:         "12.345.678/0001-90",
		Email:        "contato@marcenariaimperial.com",
		Endereco:     "Avenida Paulista, 1000, São Paulo, SP",
		Telefone:     "(11) 99999-9999", // Adicionado para espelhar a estrutura completa
	}
	
	// Substituído 'db.' por 'config.DB.' para usar a conexão do MVC
	config.DB.Where(models.Loja{CNPJ: loja.CNPJ}).FirstOrCreate(&loja)

	// 2. CADASTRAR MEDIDOR EXEMPLO
	medidor1 := models.Medidor{
		NomeCompleto: "Ricardo Aguiar (Medidor 01)",
		Cpf:          "111.222.333-44",
		Telefone:     "(11) 91234-5678",
		TaxaPorM2:    1.55,
		EstaAtivo:    true,
	}
	config.DB.Where(models.Medidor{Cpf: medidor1.Cpf}).FirstOrCreate(&medidor1)

	// 3. CADASTRAR ORDEM DE SERVIÇO PENDENTE (Para o Radar)
	osPendente := models.OrdemServico{
		LojaID:           loja.ID,
		ClienteNome:      "Marcelo Silva (Teste Radar)",
		EnderecoObra:     "Rua das Flores, 500, São Paulo, SP",
		Status:           "PENDENTE_LOJA",
		Urgencia:         false,
		ValorBaseM2:      1.55,
		TaxaDeslocamento: 15.00,
		ValorTotalOS:     125.40,
		CustoMedidor:     105.00,
		Token:            "token_radar_teste",
		Ambientes: []models.Ambiente{
			{Nome: "Cozinha", AreaEstimadaM2: 10.0, Complexidade: 1.5},
		},
	}
	config.DB.Create(&osPendente)

	log.Println("✅ Dados de teste cadastrados com sucesso!")
}