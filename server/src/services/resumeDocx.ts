import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  UnderlineType,
  ShadingType,
} from 'docx';

export interface StructuredResume {
  header: {
    name: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    website?: string;
  };
  summary?: string;
  skills?: string[];
  experience?: Array<{
    title: string;
    company: string;
    dates: string;
    bullets: string[];
  }>;
  education?: Array<{
    degree: string;
    institution: string;
    dates: string;
    details?: string;
  }>;
  projects?: Array<{
    name: string;
    description: string;
    bullets?: string[];
  }>;
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: 22,
        color: '1a1a2e',
      }),
    ],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 60 },
    border: {
      bottom: {
        color: '2563EB',
        space: 1,
        style: BorderStyle.SINGLE,
        size: 12,
      },
    },
  });
}

function bulletPoint(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: `• ${text}`,
        size: 20,
        color: '374151',
      }),
    ],
    spacing: { before: 40, after: 40 },
    indent: { left: 360 },
  });
}

function buildDocxFromStructured(resume: StructuredResume): Promise<Buffer> {
  const children: Paragraph[] = [];

  // ---- Header ----
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: resume.header.name || 'Resume',
          bold: true,
          size: 36,
          color: '111827',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    })
  );

  const contactParts: string[] = [];
  if (resume.header.email) contactParts.push(resume.header.email);
  if (resume.header.phone) contactParts.push(resume.header.phone);
  if (resume.header.location) contactParts.push(resume.header.location);
  if (resume.header.linkedin) contactParts.push(resume.header.linkedin);
  if (resume.header.github) contactParts.push(resume.header.github);
  if (resume.header.website) contactParts.push(resume.header.website);

  if (contactParts.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: contactParts.join('  |  '),
            size: 18,
            color: '4B5563',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
      })
    );
  }

  // ---- Summary ----
  if (resume.summary) {
    children.push(sectionHeading('Professional Summary'));
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: resume.summary,
            size: 20,
            color: '374151',
          }),
        ],
        spacing: { before: 60, after: 100 },
      })
    );
  }

  // ---- Skills ----
  if (resume.skills && resume.skills.length > 0) {
    children.push(sectionHeading('Technical Skills'));
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: resume.skills.join('  •  '),
            size: 20,
            color: '374151',
          }),
        ],
        spacing: { before: 60, after: 100 },
      })
    );
  }

  // ---- Experience ----
  if (resume.experience && resume.experience.length > 0) {
    children.push(sectionHeading('Work Experience'));
    for (const exp of resume.experience) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: exp.title, bold: true, size: 22, color: '111827' }),
            new TextRun({ text: '  —  ', size: 20, color: '6B7280' }),
            new TextRun({ text: exp.company, size: 21, color: '1D4ED8' }),
          ],
          spacing: { before: 120, after: 30 },
        })
      );
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: exp.dates, size: 18, color: '6B7280', italics: true }),
          ],
          spacing: { before: 0, after: 60 },
        })
      );
      for (const bullet of exp.bullets) {
        children.push(bulletPoint(bullet));
      }
    }
  }

  // ---- Education ----
  if (resume.education && resume.education.length > 0) {
    children.push(sectionHeading('Education'));
    for (const edu of resume.education) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: edu.degree, bold: true, size: 22, color: '111827' }),
            new TextRun({ text: '  —  ', size: 20, color: '6B7280' }),
            new TextRun({ text: edu.institution, size: 21, color: '1D4ED8' }),
          ],
          spacing: { before: 120, after: 30 },
        })
      );
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: edu.dates, size: 18, color: '6B7280', italics: true }),
          ],
          spacing: { before: 0, after: 40 },
        })
      );
      if (edu.details) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: edu.details, size: 20, color: '374151' })],
            spacing: { before: 0, after: 80 },
          })
        );
      }
    }
  }

  // ---- Projects ----
  if (resume.projects && resume.projects.length > 0) {
    children.push(sectionHeading('Projects'));
    for (const proj of resume.projects) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: proj.name, bold: true, size: 22, color: '111827' }),
          ],
          spacing: { before: 120, after: 30 },
        })
      );
      if (proj.description) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: proj.description, size: 20, color: '374151' })],
            spacing: { before: 0, after: 40 },
          })
        );
      }
      if (proj.bullets) {
        for (const bullet of proj.bullets) {
          children.push(bulletPoint(bullet));
        }
      }
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 20,
            color: '374151',
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              bottom: 720,
              left: 900,
              right: 900,
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

function buildDocxFromPlainText(resumeText: string): Promise<Buffer> {
  const lines = resumeText.split('\n').filter(l => l.trim());
  const children: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({ text: 'Resume', bold: true, size: 36, color: '111827' }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const isLikelyHeading =
      trimmed === trimmed.toUpperCase() && trimmed.length < 50 && trimmed.length > 2;
    if (isLikelyHeading) {
      children.push(sectionHeading(trimmed));
    } else if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
      children.push(bulletPoint(trimmed.replace(/^[•\-*]\s*/, '')));
    } else {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: trimmed, size: 20, color: '374151' })],
          spacing: { before: 40, after: 40 },
        })
      );
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 20, color: '374151' },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 900, right: 900 },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

export { buildDocxFromStructured, buildDocxFromPlainText };
