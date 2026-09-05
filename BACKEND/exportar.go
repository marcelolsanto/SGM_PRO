//go:build ignore

package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Pastas e ficheiros que NÃO queremos no backup
var ignoreList = []string{
	"node_modules", ".git", ".pg_data", "dist", "build", 
	"exportar.go", "recuperar.go", "backup_projeto.txt", "backup_projeto_backend.txt", 
	".DS_Store", "tmp",
}

var treeBuilder strings.Builder
var contentBuilder strings.Builder

func shouldIgnore(name string) bool {
	for _, idx := range ignoreList {
		if name == idx {
			return true
		}
	}
	return false
}

func isBinary(name string) bool {
	exts := []string{".png", ".jpg", ".jpeg", ".gif", ".ico", ".pdf", ".zip", ".exe", ".ttf", ".woff", ".woff2"}
	lower := strings.ToLower(name)
	for _, ext := range exts {
		if strings.HasSuffix(lower, ext) {
			return true
		}
	}
	return false
}

func walkDir(dir string, prefix string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}

	var validEntries []os.DirEntry
	for _, e := range entries {
		if !shouldIgnore(e.Name()) {
			validEntries = append(validEntries, e)
		}
	}

	for i, e := range validEntries {
		isLast := i == len(validEntries)-1
		pointer := "├── "
		if isLast {
			pointer = "└── "
		}

		// Garante que os caminhos usam barras normais (/) para manter padronização
		path := filepath.ToSlash(filepath.Join(dir, e.Name()))

		if e.IsDir() {
			treeBuilder.WriteString(prefix + pointer + e.Name() + "/\n")
			extPrefix := "│   "
			if isLast {
				extPrefix = "    "
			}
			walkDir(path, prefix+extPrefix)
		} else {
			treeBuilder.WriteString(prefix + pointer + e.Name() + "\n")
			
			// Se não for imagem/pdf, lê o conteúdo e guarda
			if !isBinary(e.Name()) {
				bytes, err := os.ReadFile(path)
				if err == nil {
					contentBuilder.WriteString(fmt.Sprintf("\n<<<ARQUIVO: %s>>>\n%s\n<<<FIM_ARQUIVO>>>\n", path, string(bytes)))
				}
			}
		}
	}
}

func main() {
	fmt.Println("⏳ A ler a estrutura e a empacotar o código do backend...")

	treeBuilder.WriteString("=========================================\nESTRUTURA DO PROJETO BACKEND\n=========================================\n\n")
	contentBuilder.WriteString("\n=========================================\nCONTEÚDO DOS ARQUIVOS\n=========================================\n")

	walkDir(".", "")

	finalOutput := treeBuilder.String() + contentBuilder.String()

	err := os.WriteFile("backup_projeto_backend.txt", []byte(finalOutput), 0644)
	if err != nil {
		fmt.Println("❌ Erro ao salvar o backup:", err)
		return
	}

	fmt.Println("✅ Sucesso! O seu backend foi guardado no ficheiro: backup_projeto_backend.txt")
}