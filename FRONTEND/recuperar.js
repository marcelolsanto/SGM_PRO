const fs = require('fs');
const path = require('path');

const inputFile = 'backup_projeto.txt';

if (!fs.existsSync(inputFile)) {
    console.error('❌ Erro: O ficheiro backup_projeto.txt não foi encontrado!');
    process.exit(1);
}

console.log('⏳ A iniciar a reconstrução do projeto...');
const data = fs.readFileSync(inputFile, 'utf8');

// Regex para encontrar os blocos de código marcados
const fileRegex = /<<<ARQUIVO: (.*?)>>>\n([\s\S]*?)\n<<<FIM_ARQUIVO>>>/g;

let match;
let contador = 0;

while ((match = fileRegex.exec(data)) !== null) {
    const filePath = match[1];
    const fileContent = match[2];

    // Cria as pastas necessárias caso não existam
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // Escreve o ficheiro
    fs.writeFileSync(filePath, fileContent);
    console.log(`📄 Restaurado: ${filePath}`);
    contador++;
}

console.log(`\n✅ Recuperação concluída com sucesso! ${contador} ficheiros recriados.`);