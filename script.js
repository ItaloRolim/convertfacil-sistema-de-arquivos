    // Inicializa o PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

    // Carrega as animações do Lottie
    let loadingAnim;
    let successAnim;
    let selectedFile = null;
    let convertedData = null;
    let excelBlob = null;

    document.addEventListener('DOMContentLoaded', function () {
      // Inicializa animações
      loadingAnim = lottie.loadAnimation({
        container: document.getElementById('loadingAnimation'),
        renderer: 'svg',
        loop: true,
        autoplay: false,
        path: 'https://assets7.lottiefiles.com/packages/lf20_qjosmr4w.json'
      });

      successAnim = lottie.loadAnimation({
        container: document.getElementById('successAnimation'),
        renderer: 'svg',
        loop: false,
        autoplay: false,
        path: 'https://assets2.lottiefiles.com/packages/lf20_uu0x8lqv.json'
      });

      // Carrega histórico do localStorage
      loadHistory();

      // Elementos
      const dropZone = document.getElementById('dropZone');
      const fileInput = document.getElementById('fileInput');
      const fileInfo = document.getElementById('fileInfo');
      const fileName = document.getElementById('fileName');
      const fileSize = document.getElementById('fileSize');
      const removeFile = document.getElementById('removeFile');
      const convertBtn = document.getElementById('convertBtn');
      const mainCard = document.getElementById('mainCard');
      const processingCard = document.getElementById('processingCard');
      const successCard = document.getElementById('successCard');
      const downloadBtn = document.getElementById('downloadBtn');
      const newConversionBtn = document.getElementById('newConversionBtn');
      const historyBtn = document.getElementById('historyBtn');
      const historyPanel = document.getElementById('historyPanel');
      const closeHistoryBtn = document.getElementById('closeHistoryBtn');
      const historyItems = document.getElementById('historyItems');
      const emptyHistory = document.getElementById('emptyHistory');

      // Event listeners
      dropZone.addEventListener('click', () => fileInput.click());

      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('active');
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('active');
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('active');

        if (e.dataTransfer.files.length) {
          handleFile(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener('change', () => {
        if (fileInput.files.length) {
          handleFile(fileInput.files[0]);
        }
      });

      removeFile.addEventListener('click', resetFileSelection);

      convertBtn.addEventListener('click', startConversion);

      downloadBtn.addEventListener('click', function(e) {
        if (!excelBlob) {
          e.preventDefault();
          return;
        }
      });

      newConversionBtn.addEventListener('click', resetToStart);

      historyBtn.addEventListener('click', toggleHistory);

      closeHistoryBtn.addEventListener('click', toggleHistory);

      // Functions
      function handleFile(file) {
        if (file.type !== 'application/pdf') {
          alert('Por favor, selecione um arquivo PDF.');
          return;
        }

        selectedFile = file;

        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);

        fileInfo.classList.remove('hidden');
        convertBtn.classList.remove('hidden');
      }

      function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' bytes';
        else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        else return (bytes / 1048576).toFixed(1) + ' MB';
      }

      function resetFileSelection() {
        selectedFile = null;
        fileInput.value = '';
        fileInfo.classList.add('hidden');
        convertBtn.classList.add('hidden');
      }

      function startConversion() {
        if (!selectedFile) return;

        mainCard.classList.add('hidden');
        processingCard.classList.remove('hidden');
        loadingAnim.play();

        // Iniciar o processo real de conversão
        const reader = new FileReader();
        reader.onload = function (e) {
          const arrayBuffer = e.target.result;
          extractPdfData(arrayBuffer);
        };
        reader.readAsArrayBuffer(selectedFile);
      }

      function extractPdfData(arrayBuffer) {
        const pdfData = new Uint8Array(arrayBuffer);
        
        // Carregar o PDF usando PDF.js
        const loadingTask = pdfjsLib.getDocument({ data: pdfData });
        
        loadingTask.promise.then(function(pdf) {
          let textContent = [];
          const numPages = pdf.numPages;
          let completedPages = 0;
          
          // Extrair texto de cada página
          for (let i = 1; i <= numPages; i++) {
            pdf.getPage(i).then(function(page) {
              page.getTextContent().then(function(content) {
                // Coletar texto e posições
                let pageText = [];
                let lastY = null;
                let lineText = '';
                
                // Organizar texto por linhas baseado na posição Y
                content.items.sort((a, b) => {
                  if (Math.abs(a.transform[5] - b.transform[5]) < 5) {
                    return a.transform[4] - b.transform[4]; // Mesmo Y, ordenar por X
                  }
                  return b.transform[5] - a.transform[5]; // Diferente Y, ordenar de cima para baixo
                });
                
                content.items.forEach(function(item) {
                  if (lastY === null || Math.abs(item.transform[5] - lastY) < 5) {
                    // Mesmo Y (mesma linha)
                    lineText += item.str + ' ';
                  } else {
                    // Nova linha
                    if (lineText.trim()) {
                      pageText.push(lineText.trim());
                    }
                    lineText = item.str + ' ';
                  }
                  lastY = item.transform[5];
                });
                
                // Adicionar última linha
                if (lineText.trim()) {
                  pageText.push(lineText.trim());
                }
                
                textContent.push(pageText);
                completedPages++;
                
                // Quando todas as páginas forem processadas
                if (completedPages === numPages) {
                  createExcelFromText(textContent);
                }
              });
            });
          }
        }).catch(function(error) {
          console.error('Erro ao carregar o PDF:', error);
          alert('Ocorreu um erro ao processar o PDF. Por favor, tente novamente.');
          resetToStart();
        });
      }

      function createExcelFromText(textContent) {
        // Converter texto extraído em uma estrutura de planilha
        const workbook = XLSX.utils.book_new();
        
        // Processar cada página como uma planilha separada
        textContent.forEach((pageText, pageIndex) => {
          // Converter linhas de texto em dados de tabela
          const rows = pageText.map(line => {
            // Dividir a linha em colunas (você pode ajustar a lógica conforme necessário)
            return line.split(/\s{2,}/); // Dividir por 2 ou mais espaços
          });
          
          // Criar a planilha
          const worksheet = XLSX.utils.aoa_to_sheet(rows);
          XLSX.utils.book_append_sheet(workbook, worksheet, `Página ${pageIndex + 1}`);
        });
        
        // Gerar o arquivo Excel
        const excelData = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        excelBlob = new Blob([excelData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        // Configurar o botão de download
        const excelFileName = selectedFile.name.replace('.pdf', '.xlsx');
        const downloadUrl = URL.createObjectURL(excelBlob);
        downloadBtn.href = downloadUrl;
        downloadBtn.download = excelFileName;
        
        // Salvar no histórico
        convertedData = {
          fileName: excelFileName,
          date: new Date().toISOString(),
          originalSize: selectedFile.size,
          convertedSize: excelBlob.size,
        };
        
        saveToHistory(convertedData);
        
        // Mostrar tela de sucesso
        loadingAnim.stop();
        processingCard.classList.add('hidden');
        successCard.classList.remove('hidden');
        successAnim.play();
      }

      function resetToStart() {
        selectedFile = null;
        convertedData = null;
        excelBlob = null;
        fileInput.value = '';

        successCard.classList.add('hidden');
        fileInfo.classList.add('hidden');
        convertBtn.classList.add('hidden');
        mainCard.classList.remove('hidden');
      }

      function toggleHistory() {
        historyPanel.classList.toggle('hidden');
        loadHistory();
      }

      function saveToHistory(data) {
        let history = JSON.parse(localStorage.getItem('convertFacilHistory') || '[]');
        history.unshift({
          id: Date.now(),
          fileName: data.fileName,
          originalName: selectedFile.name,
          date: data.date,
          originalSize: data.originalSize,
          convertedSize: data.convertedSize
        });

        // Mantém apenas os 10 itens mais recentes
        if (history.length > 10) {
          history = history.slice(0, 10);
        }

        localStorage.setItem('convertFacilHistory', JSON.stringify(history));
      }

      function loadHistory() {
        const history = JSON.parse(localStorage.getItem('convertFacilHistory') || '[]');

        historyItems.innerHTML = '';

        if (history.length === 0) {
          emptyHistory.classList.remove('hidden');
        } else {
          emptyHistory.classList.add('hidden');

          history.forEach(item => {
            const date = new Date(item.date);
            const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

            const historyItem = document.createElement('div');
            historyItem.className = 'history-item bg-blue-50 p-4 rounded-lg flex flex-col sm:flex-row sm:items-center';
            historyItem.innerHTML = `
              <div class="flex-grow mb-2 sm:mb-0">
                <h3 class="font-medium text-gray-900">${item.originalName}</h3>
                <p class="text-sm text-gray-500">Convertido em ${formattedDate}</p>
              </div>
              <div class="flex items-center">
                <span class="text-xs bg-blue-100 text-blue-800 rounded-full px-3 py-1 mr-2">
                  ${formatFileSize(item.originalSize)} → ${formatFileSize(item.convertedSize)}
                </span>
                <button class="download-history-btn text-blue-500 hover:text-blue-700" data-id="${item.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              </div>
            `;

            historyItems.appendChild(historyItem);
          });

          // Adiciona event listeners aos botões de download do histórico
          document.querySelectorAll('.download-history-btn').forEach(btn => {
            btn.addEventListener('click', function () {
              const id = parseInt(this.getAttribute('data-id'));
              const item = history.find(h => h.id === id);

              if (item) {
                // Recria o arquivo Excel para este item do histórico
                const workbook = XLSX.utils.book_new();
                const worksheet = XLSX.utils.json_to_sheet([
                  { Data: "Arquivo recuperado do histórico", Valor: "Versão simplificada" },
                  { Data: "Arquivo original", Valor: item.originalName },
                  { Data: "Data de conversão", Valor: new Date(item.date).toLocaleString() }
                ]);

                XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");
                XLSX.writeFile(workbook, item.fileName);
              }
            });
          });
        }
      }
    });