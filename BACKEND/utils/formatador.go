package utils

import (
	"regexp"
	"strings"
)

// Compilação global das expressões regulares para performance máxima
var (
	regexNumeros = regexp.MustCompile(`[^0-9]`)
	regexEmail   = regexp.MustCompile(`^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,4}$`)
	regexEspacos = regexp.MustCompile(`\s+`) // Pega espaços duplos, triplos, quebras de linha...
)

// ==========================================
// 1. SANITIZAÇÃO (LIMPEZA PARA SALVAR NO BANCO)
// ==========================================

// SomenteNumeros: Remove pontuação, letras e espaços. 
// Ideal para guardar CPF, CNPJ, Telefone e CEP de forma limpa no banco.
func SomenteNumeros(str string) string {
	return regexNumeros.ReplaceAllString(str, "")
}

// LimparNumeros é um alias para SomenteNumeros
func LimparNumeros(str string) string {
	return SomenteNumeros(str)
}

// PadronizarEmail: Remove espaços ocultos nas pontas e converte tudo para minúsculo.
func PadronizarEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// SanitizarTexto: Remove espaços extras no meio da frase e nas pontas.
// Ideal para "Nome Fantasia", "Endereço" e "Nome do Cliente".
// Exemplo: "  Rua   das  Flores  " vira "Rua das Flores"
func SanitizarTexto(texto string) string {
	limpo := strings.TrimSpace(texto)
	return regexEspacos.ReplaceAllString(limpo, " ")
}

// ==========================================
// 2. VALIDAÇÕES (CHEGAR SE ESTÁ CERTO ANTES DE SALVAR)
// ==========================================

// ValidarEmail: Confere se o e-mail tem o formato "nome@dominio.com"
func ValidarEmail(email string) bool {
	return regexEmail.MatchString(PadronizarEmail(email))
}

// ==========================================
// 3. MÁSCARAS (DEVOLVER BONITO PARA O FRONTEND SE PRECISAR)
// ==========================================

// FormatarCPF: Recebe "11122233344" e devolve "111.222.333-44"
func FormatarCPF(cpf string) string {
	limpo := SomenteNumeros(cpf)
	if len(limpo) != 11 {
		return cpf // Se não tiver 11 números, devolve como está para não quebrar
	}
	return limpo[:3] + "." + limpo[3:6] + "." + limpo[6:9] + "-" + limpo[9:]
}

// FormatarCNPJ: Recebe "11111111000111" e devolve "11.111.111/0001-11"
func FormatarCNPJ(cnpj string) string {
	limpo := SomenteNumeros(cnpj)
	if len(limpo) != 14 {
		return cnpj
	}
	return limpo[:2] + "." + limpo[2:5] + "." + limpo[5:8] + "/" + limpo[8:12] + "-" + limpo[12:]
}

// FormatarTelefone: Formata celular (11 dígitos) ou fixo (10 dígitos)
func FormatarTelefone(telefone string) string {
	limpo := SomenteNumeros(telefone)
	if len(limpo) == 11 { // Celular: (XX) XXXXX-XXXX
		return "(" + limpo[:2] + ") " + limpo[2:7] + "-" + limpo[7:]
	} else if len(limpo) == 10 { // Fixo: (XX) XXXX-XXXX
		return "(" + limpo[:2] + ") " + limpo[2:6] + "-" + limpo[6:]
	}
	return telefone
}