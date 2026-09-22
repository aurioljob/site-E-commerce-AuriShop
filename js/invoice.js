// js/invoice.js
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';
import QRCode from 'https://esm.sh/qrcode@1.5.3';

/* ============================================================
   GÉNÉRATION DE FACTURE PDF
   ============================================================ */
export async function generateInvoice(order) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  let y = height - margin;

  // Couleurs AuriShop
  const orange = rgb(1, 0.55, 0);
  const bleuNuit = rgb(0.06, 0.12, 0.24);
  const gris = rgb(0.4, 0.45, 0.5);
  const grisClair = rgb(0.9, 0.92, 0.95);

  /* ==========================================================
     1. LOGO (image en haut à gauche)
     ========================================================== */
  let logoDrawn = false;
  let logoWidth = 0;

  try {
    // Charger le PNG depuis assets/
    const logoBytes = await fetch('assets/logo.png').then(r => {
      if (!r.ok) throw new Error('Logo introuvable');
      return r.arrayBuffer();
    });

    const logo = await pdfDoc.embedPng(logoBytes);

    // Redimensionner : hauteur 60px, largeur proportionnelle
    const logoHeight = 60;
    const logoScale = logoHeight / logo.height;
    logoWidth = logo.width * logoScale;

    page.drawImage(logo, {
      x: margin,
      y: height - margin - logoHeight + 15, // aligné en haut
      width: logoWidth,
      height: logoHeight
    });

    logoDrawn = true;
  } catch (err) {
    console.warn('Impossible de charger le logo :', err);
  }

  /* ==========================================================
     2. EN-TÊTE : Texte AuriShop + FACTURE
     ========================================================== */
  // Texte "AuriShop" décalé à droite du logo (ou à gauche si pas de logo)
  const headerTextX = logoDrawn ? margin + logoWidth + 15 : margin;

  page.drawText('AuriShop', {
    x: headerTextX, y,
    size: 24, font: bold, color: orange
  });

  page.drawText('Tout ce dont vous avez besoin', {
    x: headerTextX, y: y - 16,
    size: 9, font, color: gris
  });

  // Bloc droit : FACTURE + n° + date
  const rightX = width - margin;
  const drawRight = (text, size, f, color, yPos) => {
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, { x: rightX - w, y: yPos, size, font: f, color });
  };

  drawRight('FACTURE', 20, bold, bleuNuit, y);
  drawRight(`N° ${order.invoice_number || '#' + order.id}`, 11, bold, bleuNuit, y - 22);
  drawRight(new Date(order.created_at).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric'
  }), 10, font, gris, y - 37);
  drawRight(`Statut : ${order.status}`, 10, font, gris, y - 52);

  /* ==========================================================
     3. Ligne de séparation
     ========================================================== */
  y = height - margin - 100;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1.5, color: orange
  });

  /* ==========================================================
     4. Adresse de facturation
     ========================================================== */
  y -= 40;
  page.drawText('FACTURÉ À', {
    x: margin, y,
    size: 9, font: bold, color: gris
  });

  y -= 18;
  const addr = order.addresses || {};
  page.drawText(addr.full_name || 'Client', {
    x: margin, y, size: 12, font: bold, color: bleuNuit
  });

  y -= 16;
  if (addr.phone) {
    page.drawText(`Tél : ${addr.phone}`, { x: margin, y, size: 10, font, color: bleuNuit });
    y -= 14;
  }
  page.drawText(`Adresse : ${addr.street || ''}`, { x: margin, y, size: 10, font, color: bleuNuit });
  y -= 14;
  page.drawText(
    [addr.city, addr.region, addr.country].filter(Boolean).join(', '),
    { x: margin, y, size: 10, font, color: bleuNuit }
  );

  /* ==========================================================
     5. Tableau des articles
     ========================================================== */
  y -= 50;
  const colArticle = margin;
  const colQty = margin + 280;
  const colPrice = margin + 360;
  const colTotal = width - margin;

  page.drawRectangle({
    x: margin - 8,
    y: y - 6,
    width: width - 2 * margin + 16,
    height: 24,
    color: grisClair
  });

  page.drawText('Article', { x: colArticle, y, size: 10, font: bold, color: bleuNuit });
  page.drawText('Qté', { x: colQty, y, size: 10, font: bold, color: bleuNuit });

  const drawRightAt = (text, xRight, size, f, color, yPos) => {
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, { x: xRight - w, y: yPos, size, font: f, color });
  };

  drawRightAt('Prix unit.', colPrice + 50, 10, bold, bleuNuit, y);
  drawRightAt('Total', colTotal, 10, bold, bleuNuit, y);

  y -= 25;

  for (const item of order.order_items || []) {
    const lineTotal = Number(item.price) * item.quantity;
    const name = item.product_name.length > 45
      ? item.product_name.slice(0, 42) + '...'
      : item.product_name;

    page.drawText(name, { x: colArticle, y, size: 10, font, color: bleuNuit });
    page.drawText(String(item.quantity), { x: colQty, y, size: 10, font, color: bleuNuit });
    drawRightAt(`${Number(item.price).toFixed(2)} €`, colPrice + 50, 10, font, bleuNuit, y);
    drawRightAt(`${lineTotal.toFixed(2)} €`, colTotal, 10, bold, bleuNuit, y);

    y -= 22;

    if (y < margin + 140) {
      const p = pdfDoc.addPage([595, 842]);
      y = p.getSize().height - margin;
    }
  }

  /* ==========================================================
     6. Totaux
     ========================================================== */
  y -= 15;
  page.drawLine({
    start: { x: colQty - 20, y },
    end: { x: colTotal, y },
    thickness: 0.5, color: grisClair
  });

  y -= 22;
  drawRightAt('Sous-total', colPrice + 50, 10, font, gris, y);
  drawRightAt(`${Number(order.subtotal).toFixed(2)} €`, colTotal, 10, font, bleuNuit, y);

  y -= 18;
  drawRightAt('Livraison', colPrice + 50, 10, font, gris, y);
  drawRightAt(
    Number(order.shipping_fee) === 0 ? 'Gratuite' : `${Number(order.shipping_fee).toFixed(2)} €`,
    colTotal, 10, font, bleuNuit, y
  );

  y -= 28;
  page.drawLine({
    start: { x: colQty - 20, y: y + 10 },
    end: { x: colTotal, y: y + 10 },
    thickness: 1.5, color: bleuNuit
  });

    y -= 18;
  drawRightAt('TOTAL TTC', colPrice + 50, 13, bold, bleuNuit, y);
  drawRightAt(`${Number(order.total).toFixed(2)} €`, colTotal, 15, bold, orange, y);

  /* ==========================================================
     7. QR CODE (en bas à droite)
     ========================================================== */
  try {
    const qrUrl = `https://aurishop.netlify.app/order-details.html?id=${order.id}`;
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      margin: 1,
      width: 200,
      color: {
        dark: '#0f1e3d',  // bleu nuit AuriShop
        light: '#ffffff'
      }
    });

    // Convertir dataURL en Uint8Array
    const qrBytes = await (await fetch(qrDataUrl)).arrayBuffer();
    const qrPng = await pdfDoc.embedPng(qrBytes);

    const qrSize = 70;
    const qrX = width - margin - qrSize;
    const qrY = margin + 20;

    // Fond blanc arrondi
    page.drawRectangle({
      x: qrX - 6,
      y: qrY - 6,
      width: qrSize + 12,
      height: qrSize + 12,
      color: rgb(1, 1, 1),
      borderColor: grisClair,
      borderWidth: 1
    });

    page.drawImage(qrPng, {
      x: qrX,
      y: qrY,
      width: qrSize,
      height: qrSize
    });

    // Légende sous le QR
    page.drawText('Vérifier la commande', {
      x: qrX - 5,
      y: qrY - 18,
      size: 8,
      font,
      color: gris
    });

  } catch (err) {
    console.warn('Impossible de générer le QR code :', err);
  }

  /* ==========================================================
     8. Pied de page
     ========================================================== */
  const footerY = margin + 40;
  page.drawLine({
    start: { x: margin, y: footerY + 15 },
    end: { x: width - margin, y: footerY + 15 },
    thickness: 0.5, color: grisClair
  });

  page.drawText('Merci pour votre achat chez AuriShop !', {
    x: margin, y: footerY,
    size: 10, font: bold, color: orange
  });

  page.drawText('AuriShop — Tout ce dont vous avez besoin, en un clic.', {
    x: margin, y: footerY - 14,
    size: 8, font, color: gris
  });

  page.drawText(
    'support@aurishop.com  ·  +237 691 217 270  ·  aurishop.com',
    { x: margin, y: footerY - 26, size: 8, font, color: gris }
  );

  /* ==========================================================
     9. Sauvegarde & téléchargement
     ========================================================== */
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `facture-${order.invoice_number || order.id}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}