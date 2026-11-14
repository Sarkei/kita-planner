import { jsPDF } from 'jspdf';
import { OfferData, OfferCategory } from '../types';
import { preparationItemsForList } from './preparationFormat';

// Check if we're on mobile
const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const isIOS = () => {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
};

export const generatePDF = async (offer: OfferData): Promise<void> => {
  const doc = (offer.input?.category === OfferCategory.KAMISHIBAI) && offer.kamishibaiScenes
    ? generateKamishibaiPDFDoc(offer)
    : generateStandardPDFDoc(offer);

  const fileName = (offer.input?.category === OfferCategory.KAMISHIBAI) 
    ? `${offer.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_kamishibai.pdf`
    : `${offer.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;

  // Handle mobile differently
  if (isMobile()) {
    const pdfBlob = doc.output('blob');
    
    // iOS: Create download link with blob URL
    if (isIOS()) {
      const blobUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up blob URL after a delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    } 
    // Android: Try share API with file support check
    else if (navigator.share && navigator.canShare) {
      try {
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
        const shareData = { files: [file], title: offer.title };
        
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
        } else {
          // Fallback to download
          doc.save(fileName);
        }
      } catch (error) {
        console.log('Share cancelled or failed:', error);
        doc.save(fileName);
      }
    } else {
      // Fallback for other mobile devices
      doc.save(fileName);
    }
  } else {
    // Desktop: normal download
    doc.save(fileName);
  }
};

const generateStandardPDFDoc = (offer: OfferData): jsPDF => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let yPos = margin;

  // Set Font globally to Helvetica (clean sans-serif)
  doc.setFont("helvetica", "normal");

  // --- Header ---
  doc.setFontSize(24);
  doc.setTextColor(234, 88, 12); // Orange-600
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(offer.title, contentWidth);
  doc.text(titleLines, margin, yPos);
  yPos += (titleLines.length * 10) + 5;

  // Metadata
  doc.setFontSize(11);
  doc.setTextColor(107, 114, 128); // Gray-500
  doc.setFont("helvetica", "normal");
  doc.text(`${offer.input?.category ?? ''}  |  ${offer.input?.targetGroup ?? ''}  |  ${offer.input?.duration ?? ''}`, margin, yPos);
  yPos += 10;

  // Separator
  doc.setDrawColor(229, 231, 235); // Gray-200
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 15;

  /** Sorgt dafür, dass `height` noch auf die Seite passt — sonst neue Seite. */
  const ensureSpace = (height: number) => {
    if (yPos + height > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
    }
  };

  const lineHeight = 6;

  // --- Goals ---
  doc.setFontSize(14);
  doc.setTextColor(31, 41, 55);
  doc.setFont("helvetica", "bold");
  ensureSpace(16);
  doc.text("Pädagogische Ziele", margin, yPos);
  yPos += 8;

  doc.setFontSize(11);
  doc.setTextColor(55, 65, 81);
  doc.setFont("helvetica", "normal");
  offer.goals.forEach((goal) => {
    const lines = doc.splitTextToSize(`• ${goal}`, contentWidth);
    ensureSpace(lines.length * lineHeight + 2);
    doc.text(lines, margin, yPos);
    yPos += lines.length * lineHeight + 2;
  });
  yPos += 10;

  // --- Materials ---
  const materialLines = offer.materials.map(
    (mat) => `• ${mat.item}${mat.amount ? ` (${mat.amount})` : ''}`,
  );
  const materialWrapped = materialLines.map((line) => doc.splitTextToSize(line, contentWidth - 10));
  const materialBodyHeight = materialWrapped.reduce((sum, lines) => sum + lines.length * lineHeight, 0);
  const materialsHeight = 18 + materialBodyHeight + 8;

  ensureSpace(materialsHeight);

  doc.setFillColor(255, 247, 237); // Orange-50
  doc.roundedRect(margin, yPos, contentWidth, materialsHeight, 3, 3, 'F');

  let matY = yPos + 10;
  doc.setFontSize(14);
  doc.setTextColor(154, 52, 18); // Orange-800
  doc.setFont("helvetica", "bold");
  doc.text("Materialien", margin + 5, matY);
  matY += 8;

  doc.setFontSize(11);
  doc.setTextColor(55, 65, 81); // Gray-700
  doc.setFont("helvetica", "normal");
  materialWrapped.forEach((lines) => {
    doc.text(lines, margin + 5, matY);
    matY += lines.length * lineHeight;
  });
  yPos += materialsHeight + 15;

  // --- Preparation ---
  const prepItems = preparationItemsForList(offer.preparation);
  const prepWrapped = prepItems.map((item, idx) =>
    doc.splitTextToSize(`${idx + 1}. ${item}`, contentWidth),
  );
  const prepBodyHeight = prepWrapped.reduce((sum, lines) => sum + lines.length * lineHeight + 3, 0);
  const prepTotalHeight = 8 + prepBodyHeight + 7;

  // Passt die Vorbereitung nicht mehr hierher, auf einer leeren Seite aber schon:
  // dann komplett umbrechen, statt sie mitten in der Liste zu zerschneiden.
  if (yPos + prepTotalHeight > pageHeight - margin && prepTotalHeight <= pageHeight - 2 * margin) {
    doc.addPage();
    yPos = margin;
  }

  doc.setFontSize(14);
  doc.setTextColor(31, 41, 55);
  doc.setFont("helvetica", "bold");
  ensureSpace(16);
  doc.text("Vorbereitung", margin, yPos);
  yPos += 8;

  doc.setFontSize(11);
  doc.setTextColor(55, 65, 81);
  doc.setFont("helvetica", "normal");
  prepWrapped.forEach((lines) => {
    ensureSpace(lines.length * lineHeight + 3);
    doc.text(lines, margin, yPos);
    yPos += lines.length * lineHeight + 3;
  });
  yPos += 7;

  // --- Execution (Durchführung) - ALWAYS NEW PAGE ---
  doc.addPage();
  yPos = margin;

  doc.setFontSize(18);
  doc.setTextColor(234, 88, 12); // Orange-600
  doc.setFont("helvetica", "bold");
  doc.text("Durchführung", margin, yPos);
  yPos += 15;

  // Steps Loop
  offer.steps.forEach((step, index) => {
      // Calculate required height for this step
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      const stepTitle = `Schritt ${step.step}`;
      const titleHeight = 8;

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      const stepTextLines = doc.splitTextToSize(step.instruction, contentWidth);
      const textHeight = stepTextLines.length * 6;

      let imgHeight = 0;
      let imgWidth = 0;
      let renderWidth = 72; // so passen in der Regel zwei Schritte auf eine Seite
      let renderHeight = 0;

      if (step.imageUrl) {
          try {
             const props = doc.getImageProperties(step.imageUrl);
             const ratio = props.height / props.width;
             renderHeight = renderWidth * ratio;
             imgHeight = renderHeight;
          } catch (e) {
             // Fallback if image props fail
             renderHeight = 100;
             imgHeight = 100;
          }
      }

      const totalStepHeight = titleHeight + textHeight + (step.imageUrl ? imgHeight + 10 : 0) + 15;

      // Check if it fits
      if (yPos + totalStepHeight > pageHeight - margin) {
          doc.addPage();
          yPos = margin;
      }

      // Render Step
      // Title
      doc.setFontSize(12);
      doc.setTextColor(234, 88, 12);
      doc.setFont("helvetica", "bold");
      doc.text(stepTitle, margin, yPos);
      yPos += 6;

      // Text
      doc.setFontSize(11);
      doc.setTextColor(55, 65, 81);
      doc.setFont("helvetica", "normal");
      doc.text(stepTextLines, margin, yPos);
      yPos += textHeight + 5;

      // Image
      if (step.imageUrl) {
          try {
             const imgFormat = step.imageUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
             doc.addImage(step.imageUrl, imgFormat, margin, yPos, renderWidth, renderHeight);
             yPos += renderHeight + 10;
          } catch (e) {
              console.warn("Image add failed", e);
          }
      }
      
      yPos += 5; // Spacing
  });

  return doc;
};

const generateKamishibaiPDFDoc = (offer: OfferData): jsPDF => {
  // 1. Images Part (Landscape)
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  doc.setFont("helvetica", "normal");

  if (!offer.kamishibaiScenes) return;

  // --- Cover Page ---
  const coverImage = offer.kamishibaiScenes[0]?.imageUrl;
  
  if (coverImage) {
      try {
        doc.addImage(coverImage, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
      } catch (e) {}
  }
  
  // Title Box
  doc.setFillColor(255, 255, 255);
  doc.rect(pageWidth / 2 - 90, pageHeight / 2 - 40, 180, 80, 'F');
  doc.setDrawColor(249, 115, 22);
  doc.setLineWidth(1);
  doc.rect(pageWidth / 2 - 88, pageHeight / 2 - 38, 176, 76, 'S');

  doc.setFontSize(24);
  doc.setTextColor(234, 88, 12);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(offer.title, 160);
  doc.text(titleLines, pageWidth / 2, pageHeight / 2 - 5, { align: 'center' });

  doc.setFontSize(14);
  doc.setTextColor(107, 114, 128);
  doc.setFont("helvetica", "normal");
  doc.text("Ein Kamishibai Erzähltheater", pageWidth / 2, pageHeight / 2 + 25, { align: 'center' });

  // --- Image Pages (Landscape) ---
  offer.kamishibaiScenes.forEach((scene, index) => {
    doc.addPage("a4", "landscape");
    if (scene.imageUrl) {
      try {
        doc.addImage(scene.imageUrl, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
        
        // Label
        doc.setFillColor(255, 255, 255);
        doc.rect(pageWidth - 35, pageHeight - 15, 25, 10, 'F');
        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.text(`Bild ${index + 1}`, pageWidth - 22.5, pageHeight - 8, { align: 'center' });
      } catch (e) {
        doc.text("Bild konnte nicht geladen werden.", pageWidth / 2, pageHeight / 2, { align: 'center'});
      }
    } else {
        doc.text(`[Bild für Szene ${index + 1}]`, pageWidth / 2, pageHeight / 2, { align: 'center'});
    }
  });

  // --- Text Part (Portrait) ---
  doc.addPage("a4", "portrait");
  const pWidth = 210; // A4 width in mm
  const pHeight = 297; // A4 height in mm
  const margin = 20;
  let yPos = margin;

  doc.setFontSize(20);
  doc.setTextColor(31, 41, 55);
  doc.setFont("helvetica", "bold");
  doc.text("Erzähltexte & Ablauf", margin, yPos);
  yPos += 15;

  // Goals Summary
  doc.setFontSize(12);
  doc.setTextColor(107, 114, 128);
  doc.setFont("helvetica", "bold");
  doc.text("Pädagogische Ziele:", margin, yPos);
  yPos += 6;
  doc.setFontSize(10);
  doc.setTextColor(55, 65, 81);
  doc.setFont("helvetica", "normal");
  offer.goals.forEach(goal => {
      doc.text(`• ${goal}`, margin, yPos);
      yPos += 5;
  });
  yPos += 10;
  doc.setDrawColor(229, 231, 235);
  doc.line(margin, yPos, pWidth - margin, yPos);
  yPos += 10;

  // Scenes Text
  offer.kamishibaiScenes.forEach((scene, index) => {
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      const splitText = doc.splitTextToSize(scene.storyText, pWidth - 40);
      const textHeight = splitText.length * 5; 
      const blockHeight = 15 + textHeight + 10;

      if (yPos + blockHeight > pHeight - margin) {
          doc.addPage("a4", "portrait");
          yPos = margin;
      }

      // Scene Header
      doc.setFontSize(12);
      doc.setTextColor(234, 88, 12);
      doc.setFont("helvetica", "bold");
      doc.text(`Bild ${index + 1}: Szene ${scene.sceneNumber}`, margin, yPos);
      yPos += 6;

      // Scene Text
      doc.setFontSize(11);
      doc.setTextColor(55, 65, 81);
      doc.setFont("helvetica", "normal");
      doc.text(splitText, margin, yPos);
      yPos += textHeight + 8;
      
      // Separator
      if (index < offer.kamishibaiScenes!.length - 1) {
        doc.setDrawColor(243, 244, 246);
        doc.line(margin, yPos - 4, pWidth - margin, yPos - 4);
      }
  });

  return doc;
};