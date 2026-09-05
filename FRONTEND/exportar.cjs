const fs = require('fs');
const path = require('path');

// Pastas e ficheiros que NÃO queremos no backup (muito pesados ou irrelevantes)
const ignoreList = [
    'node_modules', '.git', '.pg_data', 'dist', 'build', 
    'exportar.js', 'exportar.cjs', 'recuperar.js', 'recuperar.cjs', 
    'backup_projeto.txt', 'backup_projeto_frontend.txt'
];

const outputFile = 'backup_projeto_frontend.txt';
let tree = '=========================================\nESTRUTURA DO PROJETO FRONTEND\n=========================================\n\n';
let contents = '\n=========================================\nCONTEÚDO DOS ARQUIVOS\n=========================================\n';

function walk(dir, prefix = '') {
    const files = fs.readdirSync(dir);
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (ignoreList.includes(file)) continue;
        
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        const isLast = i === files.length - 1;
        const pointer = isLast ? '└── ' : '├── ';
        
        if (stat.isDirectory()) {
            tree += `${prefix}${pointer}${file}/\n`;
            walk(filePath, prefix + (isLast ? '    ' : '│   '));
        } else {
            tree += `${prefix}${pointer}${file}\n`;
            
            // Ignora ficheiros binários, imagens e PDFs (guarda apenas texto/código)
            if (!file.match(/\.(png|jpg|jpeg|gif|ico|pdf|zip|exe)$/i)) {
                contents += `\n<<<ARQUIVO: ${filePath}>>>\n`;
                contents += fs.readFileSync(filePath, 'utf8');
                contents += `\n<<<FIM_ARQUIVO>>>\n`;
            }
        }
    }
}

console.log('⏳ A ler a estrutura e a empacotar o código do frontend...');
walk('.');
fs.writeFileSync(outputFile, tree + contents);
console.log(`✅ Sucesso! O seu frontend foi guardado no ficheiro: ${outputFile}`);