package services

import (
	"strings"

	"workspace/backend/config"
	"workspace/backend/models"
	"workspace/backend/utils" // Nossa ferramenta de limpeza
)

func ObterLojas(perfil string, refID uint) ([]models.Loja, error) {
	var lojas []models.Loja
	
	if perfil == "LOJA" {
		err := config.DB.Where("id = ?", refID).Find(&lojas).Error
		return lojas, err
	}
	
	err := config.DB.Find(&lojas).Error
	return lojas, err
}

func CriarLoja(loja *models.Loja) error {
	// Aplicando as ferramentas do formatador no POST
	loja.CNPJ = utils.LimparNumeros(loja.CNPJ)
	loja.Telefone = utils.LimparNumeros(loja.Telefone)
	loja.Email = strings.ToLower(strings.TrimSpace(loja.Email))

	return config.DB.Create(loja).Error
}

func AtualizarLoja(id uint, lojaAtualizada *models.Loja) (*models.Loja, error) {
	var loja models.Loja
	if err := config.DB.First(&loja, id).Error; err != nil {
		return nil, err
	}
	
	// Aplicando as ferramentas do formatador no PUT
	lojaAtualizada.CNPJ = utils.LimparNumeros(lojaAtualizada.CNPJ)
	lojaAtualizada.Telefone = utils.LimparNumeros(lojaAtualizada.Telefone)
	lojaAtualizada.Email = strings.ToLower(strings.TrimSpace(lojaAtualizada.Email))
	
	if err := config.DB.Model(&loja).Updates(lojaAtualizada).Error; err != nil {
		return nil, err
	}
	return &loja, nil
}

func DeletarLoja(id string) error {
	return config.DB.Delete(&models.Loja{}, id).Error
}