const fs = require('fs');
const path = 'c:\\Users\\lenin\\OneDrive\\Documentos\\Cielito Home\\Checador Version 2\\frontend\\src\\pages\\Usuarios.jsx';
let content = fs.readFileSync(path, 'utf8');

// The optimized version of the function
const cleanFunction = `  const imprimirExpediente = async () => {
    const printArea = document.getElementById('expediente-print-area');
    if (!printArea) return;

    try {
      const loadingToast = toast.loading('Generando PDF de alta calidad...');
      
      // Better modal handling for capture
      const modalDialog = printArea.closest('.modal-dialog');
      let originalClass = '';
      if (modalDialog) {
        originalClass = modalDialog.className;
        modalDialog.classList.remove('modal-dialog-scrollable');
        // Ensure it doesn't have a max-height during capture
        modalDialog.style.maxHeight = 'none';
        modalDialog.style.width = '210mm'; // Standard A4 width
      }

      // Small delay to let reflow and images load
      await new Promise(r => setTimeout(r, 500));

      const canvas = await html2canvas(printArea, {
        scale: 3, // Higher resolution for "prints poorly" fix
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff', // Professional white background
        windowWidth: printArea.scrollWidth,
        windowHeight: printArea.scrollHeight,
        onclone: (clonedDoc) => {
          // Adjust cloned element styles for printing if needed
          const clonedArea = clonedDoc.getElementById('expediente-print-area');
          if (clonedArea) {
             clonedArea.style.padding = '20mm';
             clonedArea.style.background = 'white';
             // Remove any shadows or borders that look bad on paper
             const cards = clonedArea.querySelectorAll('.card, .bg-white');
             cards.forEach(c => {
               c.style.boxShadow = 'none';
               c.style.border = '1px solid #eee';
             });
          }
        }
      });

      // Restore modal styles
      if (modalDialog) {
        modalDialog.className = originalClass;
        modalDialog.style.maxHeight = '';
        modalDialog.style.width = '';
      }

      const imgData = canvas.toDataURL('image/png'); // PNG for better quality
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      // Add subsequent pages if content is taller than 1 A4 page
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      pdf.save(\`Expediente_\${expedienteUsuario?.nombre?.replace(/\\s+/g, '_') || 'Empleado'}.pdf\`);
      
      toast.dismiss(loadingToast);
      toast.success('Expediente PDF generado exitosamente');
    } catch (error) {
      console.error('Error generando PDF:', error);
      toast.error('Error al generar el PDF. Revisa la consola.');
    }
  };`;

// Regex to find the entire block of repeated functions
// It starts from the first 'const imprimirExpediente' and goes until the last trace of the duplicate block
// Looking at the findstr output, it seems they are all back-to-back.
const startPattern = /const imprimirExpediente = async \(\) => \{/;
const firstMatch = content.search(startPattern);

if (firstMatch !== -1) {
    // Find the last occurrence of the function header to get a sense of where it ends
    const lastHeaderMatch = content.lastIndexOf('const imprimirExpediente = async () => {');
    // From that last header, find the closing brace index
    // We'll look for the next few chars that look like the end of the function block
    let endOfBlock = content.indexOf('};', lastHeaderMatch);
    if (endOfBlock !== -1) {
        endOfBlock += 2; // include the };
        
        // Safety check: is there another one right after?
        while (content.substr(endOfBlock, 100).includes('const imprimirExpediente')) {
             let nextHeader = content.indexOf('const imprimirExpediente', endOfBlock);
             let nextEnd = content.indexOf('};', nextHeader);
             if (nextEnd !== -1) {
                 endOfBlock = nextEnd + 2;
             } else {
                 break;
             }
        }

        console.log(`Replacing block from ${firstMatch} to ${endOfBlock}`);
        const before = content.substring(0, firstMatch);
        const after = content.substring(endOfBlock);
        
        fs.writeFileSync(path, before + cleanFunction + after, 'utf8');
        console.log('Successfully cleaned and optimized imprimirExpediente');
    } else {
        console.log('Could not find end of block');
    }
} else {
    console.log('Could not find start of block');
}
