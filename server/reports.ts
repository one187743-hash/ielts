import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import type { ResultReportDetail } from '../src/lib/types';

export async function generateQrDataUrl(verificationUrl: string): Promise<string> {
  return QRCode.toDataURL(verificationUrl, {
    width: 180,
    margin: 1,
    color: {
      dark: '#0B1F3A',
      light: '#FFFFFF',
    },
  });
}

export async function generateReportPdfBuffer(
  report: ResultReportDetail,
  verifyUrl: string
): Promise<Buffer> {
  const qrBuffer = await QRCode.toBuffer(verifyUrl, {
    width: 140,
    margin: 1,
    color: { dark: '#0B1F3A', light: '#FFFFFF' },
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header band
    doc.rect(0, 0, 595.28, 92).fill('#0B1F3A');
    doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold').text('MERIDIAN ASSESSMENT', 48, 28);
    doc
      .fillColor('#CBD5E1')
      .fontSize(10)
      .font('Helvetica')
      .text('INDEPENDENT ENGLISH LANGUAGE PROFICIENCY & PRACTICE REPORT', 48, 56);

    // Notice banner
    doc.rect(48, 108, 499, 34).fill('#FEF3C7');
    doc
      .fillColor('#92400E')
      .fontSize(8.5)
      .font('Helvetica-Bold')
      .text(
        'UNOFFICIAL PRACTICE ASSESSMENT: Independent diagnostic record. Not an official IELTS, Pearson PTE, or ETS TOEFL certificate.',
        58,
        120,
        { width: 479 }
      );

    // Candidate & Report metadata
    let y = 160;
    doc.fillColor('#0F172A').fontSize(13).font('Helvetica-Bold').text(report.examTitle, 48, y);
    y += 22;

    doc.fontSize(9.5).font('Helvetica').fillColor('#475569');
    doc.text(`Candidate Name: ${report.candidateName}`, 48, y);
    doc.text(`Candidate Ref: ${report.candidateRef}`, 320, y);
    y += 16;
    doc.text(`Report Reference: ${report.reportRef}`, 48, y);
    doc.text(`Attempt #${report.attemptNumber}  |  Status: ${report.status.toUpperCase()}`, 320, y);
    y += 16;
    doc.text(`Assessment Date: ${new Date(report.examDate).toUTCString()}`, 48, y);
    doc.text(`CEFR Equivalent: ${report.cefrLevel}`, 320, y);

    // Overall score & QR box
    y += 28;
    doc.rect(48, y, 360, 86).lineWidth(1).strokeColor('#CBD5E1').stroke();
    doc.fillColor('#475569').fontSize(9).font('Helvetica').text('OVERALL ESTIMATED SCORE', 64, y + 16);
    doc
      .fillColor('#0B1F3A')
      .fontSize(26)
      .font('Helvetica-Bold')
      .text(report.overallLabel, 64, y + 34);
    doc
      .fillColor('#475569')
      .fontSize(9)
      .font('Helvetica')
      .text(`CEFR Band Estimate: ${report.cefrLevel}`, 64, y + 66);

    // QR box on right
    doc.image(qrBuffer, 438, y - 4, { width: 92, height: 92 });
    doc
      .fillColor('#475569')
      .fontSize(7.5)
      .font('Helvetica')
      .text(`Verify: ${report.verificationCode}`, 426, y + 90, { width: 118, align: 'center' });

    // Skill Breakdown
    y += 112;
    doc.fillColor('#0F172A').fontSize(12).font('Helvetica-Bold').text('Skill Performance Breakdown', 48, y);
    y += 18;

    for (const s of report.skillScores) {
      doc.rect(48, y, 499, 28).fill('#F8FAFC');
      doc.fillColor('#0F172A').fontSize(10).font('Helvetica-Bold').text(s.skill, 60, y + 9);
      doc
        .fillColor('#1D4ED8')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(s.label || String(s.score), 420, y + 9, { width: 115, align: 'right' });
      y += 32;
    }

    // AI / Examiner Feedback
    if (report.aiFeedback.length > 0) {
      y += 12;
      doc.fillColor('#0F172A').fontSize(12).font('Helvetica-Bold').text('Assessment Feedback & Recommendations', 48, y);
      y += 18;
      for (const fb of report.aiFeedback.slice(0, 3)) {
        if (y > 700) break;
        doc.fillColor('#0B1F3A').fontSize(10).font('Helvetica-Bold').text(`${fb.skill} Evaluation`, 48, y);
        y += 14;
        doc.fillColor('#334155').fontSize(9).font('Helvetica').text(fb.rawSummary, 48, y, { width: 499 });
        y += 34;
        if (fb.recommendations.length > 0) {
          doc
            .fillColor('#475569')
            .fontSize(8.5)
            .text(`Recommendations: ${fb.recommendations.slice(0, 2).join(' | ')}`, 48, y, { width: 499 });
          y += 24;
        }
      }
    }

    // Footer
    doc
      .fillColor('#64748B')
      .fontSize(8)
      .font('Helvetica')
      .text(
        `${report.disclaimer}  |  Verification URL: ${verifyUrl}`,
        48,
        772,
        { width: 499, align: 'center' }
      );

    doc.end();
  });
}
