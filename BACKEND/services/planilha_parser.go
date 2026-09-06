package services

import (
	"archive/zip"
	"bytes"
	"encoding/csv"
	"encoding/xml"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"workspace/backend/config"
	"workspace/backend/models"
)

// LinhaPlanilha representa uma linha processada da planilha de medições
type LinhaPlanilha struct {
	LinhaNumero    int                  `json:"linha_numero"`
	OsID           uint                 `json:"os_id"`
	ClienteNome    string               `json:"cliente_nome"`
	DataMedicao    string               `json:"data_medicao"`
	ValorMaoDeObra float64              `json:"valor_mao_de_obra"`
	Deslocamento   float64              `json:"deslocamento"`
	ValorTotal     float64              `json:"valor_total"`
	Status         string               `json:"status"` // CONCILIADO, DIVERGENCIA_VALOR, OS_NAO_ENCONTRADA, OS_OUTRO_MEDIDOR, OS_NAO_CONCLUIDA
	Mensagem       string               `json:"mensagem"`
	OsSistema      *models.OrdemServico `json:"os_sistema,omitempty"`
}

// ResultadoConciliacao resume o cruzamento da planilha enviada com o banco de dados
type ResultadoConciliacao struct {
	TotalLinhasPlanilha int             `json:"total_linhas_planilha"`
	TotalConciliadas    int             `json:"total_conciliadas"`
	TotalDivergentes    int             `json:"total_divergentes"`
	TotalNaoEncontradas int             `json:"total_nao_encontradas"`
	ValorTotalPlanilha  float64         `json:"valor_total_planilha"`
	ValorTotalSistema   float64         `json:"valor_total_sistema"`
	Diferenca           float64         `json:"diferenca"`
	StatusGeral         string          `json:"status_geral"` // 100%_CONCILIADO, DIVERGENCIAS_ENCONTRADAS
	Linhas              []LinhaPlanilha `json:"linhas"`
}

// ProcessarEConciliarPlanilha lê o arquivo (XLSX ou CSV) e compara com as OSs do medidor no banco
func ProcessarEConciliarPlanilha(caminhoArquivo string, medidorID uint) (*ResultadoConciliacao, error) {
	ext := strings.ToLower(filepath.Ext(caminhoArquivo))
	var matriz [][]string
	var err error

	if ext == ".csv" {
		matriz, err = lerCSV(caminhoArquivo)
	} else if ext == ".xlsx" {
		matriz, err = lerXLSX(caminhoArquivo)
	} else {
		return nil, fmt.Errorf("formato de arquivo não suportado (%s). Envie .xlsx ou .csv", ext)
	}

	if err != nil {
		return nil, fmt.Errorf("falha ao processar arquivo: %v", err)
	}

	if len(matriz) < 2 {
		return nil, fmt.Errorf("a planilha está vazia ou contém apenas o cabeçalho")
	}

	// 1. Identifica índices das colunas no cabeçalho
	cabecalho := matriz[0]
	idxOS := -1
	idxCliente := -1
	idxData := -1
	idxMaoDeObra := -1
	idxDeslocamento := -1
	idxTotal := -1

	for i, col := range cabecalho {
		c := strings.ToLower(strings.TrimSpace(col))
		c = strings.ReplaceAll(c, "ã", "a")
		c = strings.ReplaceAll(c, "ç", "c")
		c = strings.ReplaceAll(c, "ú", "u")

		if strings.Contains(c, "os") || strings.Contains(c, "ordem") || strings.Contains(c, "codigo") || strings.Contains(c, "numero") || strings.Contains(c, "id") {
			if idxOS == -1 {
				idxOS = i
			}
		} else if strings.Contains(c, "cliente") || strings.Contains(c, "nome") {
			if idxCliente == -1 {
				idxCliente = i
			}
		} else if strings.Contains(c, "data") {
			if idxData == -1 {
				idxData = i
			}
		} else if strings.Contains(c, "mao") || strings.Contains(c, "servico") || strings.Contains(c, "obra") {
			if idxMaoDeObra == -1 {
				idxMaoDeObra = i
			}
		} else if strings.Contains(c, "desloc") || strings.Contains(c, "km") || strings.Contains(c, "transporte") || strings.Contains(c, "gasolina") {
			if idxDeslocamento == -1 {
				idxDeslocamento = i
			}
		} else if strings.Contains(c, "total") || strings.Contains(c, "valor") || strings.Contains(c, "receber") || strings.Contains(c, "liquido") {
			if idxTotal == -1 {
				idxTotal = i
			}
		}
	}

	// Se não achou colunas específicas, adota padrão posicional (Col 0 = OS, Col 1 = Cliente, Col 2 = Data, Col 3 = Total)
	if idxOS == -1 {
		idxOS = 0
	}

	resultado := &ResultadoConciliacao{
		Linhas: make([]LinhaPlanilha, 0),
	}

	// 2. Itera sobre as linhas de dados da planilha
	for numLinha := 1; numLinha < len(matriz); numLinha++ {
		row := matriz[numLinha]
		if len(row) == 0 || (len(row) == 1 && strings.TrimSpace(row[0]) == "") {
			continue
		}

		osRaw := getCol(row, idxOS)
		osID := extrairID(osRaw)
		if osID == 0 {
			continue // Linha vazia ou totalizadora
		}

		cliente := getCol(row, idxCliente)
		dataStr := getCol(row, idxData)
		maoDeObra := parseDinheiro(getCol(row, idxMaoDeObra))
		desloc := parseDinheiro(getCol(row, idxDeslocamento))
		total := parseDinheiro(getCol(row, idxTotal))

		if total == 0 && (maoDeObra > 0 || desloc > 0) {
			total = maoDeObra + desloc
		}

		linha := LinhaPlanilha{
			LinhaNumero:    numLinha + 1,
			OsID:           osID,
			ClienteNome:    cliente,
			DataMedicao:    dataStr,
			ValorMaoDeObra: maoDeObra,
			Deslocamento:   desloc,
			ValorTotal:     total,
		}

		resultado.TotalLinhasPlanilha++
		resultado.ValorTotalPlanilha += total

		// 3. Cruzamento com o banco de dados
		var os models.OrdemServico
		err := config.DB.Preload("Loja").Where("id = ?", osID).First(&os).Error
		if err != nil {
			linha.Status = "OS_NAO_ENCONTRADA"
			linha.Mensagem = fmt.Sprintf("OS #%d não existe no banco de dados.", osID)
			resultado.TotalNaoEncontradas++
			resultado.Linhas = append(resultado.Linhas, linha)
			continue
		}

		linha.OsSistema = &os
		if linha.ClienteNome == "" {
			linha.ClienteNome = os.ClienteNome
		}

		if os.MedidorID == nil || *os.MedidorID != medidorID {
			linha.Status = "OS_OUTRO_MEDIDOR"
			linha.Mensagem = fmt.Sprintf("OS #%d pertence a outro medidor ou não foi atribuída a você.", osID)
			resultado.TotalDivergentes++
			resultado.Linhas = append(resultado.Linhas, linha)
			continue
		}

		if os.Status != "CONCLUIDA" && os.Status != "VALIDADA" {
			linha.Status = "OS_NAO_CONCLUIDA"
			linha.Mensagem = fmt.Sprintf("OS #%d ainda está com status '%s'. Somente medições concluídas podem ser faturadas.", osID, os.Status)
			resultado.TotalDivergentes++
			resultado.Linhas = append(resultado.Linhas, linha)
			continue
		}

		valorEsperado := os.CustoMedidor
		resultado.ValorTotalSistema += valorEsperado

		// Tolerância de 5 centavos para arredondamentos
		if math.Abs(total-valorEsperado) > 0.05 && total > 0 {
			linha.Status = "DIVERGENCIA_VALOR"
			linha.Mensagem = fmt.Sprintf("Valor divergente: Planilha informa R$ %.2f, mas sistema calculou R$ %.2f.", total, valorEsperado)
			resultado.TotalDivergentes++
		} else {
			linha.Status = "CONCILIADO"
			linha.Mensagem = "OS conferida e 100% conciliada com o sistema."
			resultado.TotalConciliadas++
		}

		resultado.Linhas = append(resultado.Linhas, linha)
	}

	resultado.Diferenca = resultado.ValorTotalPlanilha - resultado.ValorTotalSistema
	if resultado.TotalDivergentes == 0 && resultado.TotalNaoEncontradas == 0 && resultado.TotalConciliadas > 0 {
		resultado.StatusGeral = "100%_CONCILIADO"
	} else {
		resultado.StatusGeral = "DIVERGENCIAS_ENCONTRADAS"
	}

	return resultado, nil
}

// Helpers de Leitura
func getCol(row []string, idx int) string {
	if idx >= 0 && idx < len(row) {
		return strings.TrimSpace(row[idx])
	}
	return ""
}

func extrairID(val string) uint {
	re := regexp.MustCompile(`\d+`)
	match := re.FindString(val)
	if match == "" {
		return 0
	}
	n, _ := strconv.ParseUint(match, 10, 32)
	return uint(n)
}

func parseDinheiro(val string) float64 {
	if val == "" {
		return 0
	}
	limpo := strings.ReplaceAll(val, "R$", "")
	limpo = strings.ReplaceAll(limpo, " ", "")
	limpo = strings.TrimSpace(limpo)

	// Formato brasileiro: 1.250,50 -> 1250.50
	if strings.Contains(limpo, ",") {
		limpo = strings.ReplaceAll(limpo, ".", "")
		limpo = strings.ReplaceAll(limpo, ",", ".")
	}

	f, _ := strconv.ParseFloat(limpo, 64)
	return f
}

func lerCSV(caminho string) ([][]string, error) {
	dados, err := os.ReadFile(caminho)
	if err != nil {
		return nil, err
	}

	// Remove BOM UTF-8 se presente
	dados = bytes.TrimPrefix(dados, []byte("\xef\xbb\xbf"))

	// Detecta delimitador (; ou , ou \t)
	primeiraLinha := string(bytes.Split(dados, []byte("\n"))[0])
	delimitador := rune(';')
	if strings.Count(primeiraLinha, ",") > strings.Count(primeiraLinha, ";") {
		delimitador = ','
	} else if strings.Count(primeiraLinha, "\t") > strings.Count(primeiraLinha, ";") {
		delimitador = '\t'
	}

	r := csv.NewReader(bytes.NewReader(dados))
	r.Comma = delimitador
	r.LazyQuotes = true
	r.FieldsPerRecord = -1

	return r.ReadAll()
}

// Estruturas para Parsing XML de XLSX
type sharedStringsXML struct {
	XMLName xml.Name `xml:"sst"`
	Si      []struct {
		T string `xml:"t"`
	} `xml:"si"`
}

type worksheetXML struct {
	XMLName   xml.Name `xml:"worksheet"`
	SheetData struct {
		Rows []struct {
			C []struct {
				R string `xml:"r,attr"`
				T string `xml:"t,attr"`
				V string `xml:"v"`
			} `xml:"c"`
		} `xml:"row"`
	} `xml:"sheetData"`
}

func lerXLSX(caminho string) ([][]string, error) {
	z, err := zip.OpenReader(caminho)
	if err != nil {
		return nil, err
	}
	defer z.Close()

	// 1. Lê Strings Compartilhadas (sharedStrings.xml)
	var sharedStrings []string
	for _, f := range z.File {
		if strings.HasSuffix(f.Name, "sharedStrings.xml") {
			rc, err := f.Open()
			if err == nil {
				var sst sharedStringsXML
				dec := xml.NewDecoder(rc)
				if err := dec.Decode(&sst); err == nil {
					for _, item := range sst.Si {
						sharedStrings = append(sharedStrings, item.T)
					}
				}
				rc.Close()
			}
			break
		}
	}

	// 2. Lê a primeira planilha (sheet1.xml)
	var sheetFile *zip.File
	for _, f := range z.File {
		if strings.HasPrefix(f.Name, "xl/worksheets/sheet") && strings.HasSuffix(f.Name, ".xml") {
			sheetFile = f
			break
		}
	}

	if sheetFile == nil {
		return nil, fmt.Errorf("nenhuma planilha encontrada no arquivo .xlsx")
	}

	rc, err := sheetFile.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()

	var ws worksheetXML
	dec := xml.NewDecoder(rc)
	if err := dec.Decode(&ws); err != nil {
		return nil, err
	}

	var matriz [][]string
	for _, r := range ws.SheetData.Rows {
		var linha []string
		for _, c := range r.C {
			val := c.V
			if c.T == "s" { // shared string index
				idx, err := strconv.Atoi(val)
				if err == nil && idx >= 0 && idx < len(sharedStrings) {
					val = sharedStrings[idx]
				}
			}
			linha = append(linha, val)
		}
		if len(linha) > 0 {
			matriz = append(matriz, linha)
		}
	}

	return matriz, nil
}
