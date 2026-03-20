/**
 * PRISM PDF Renderer
 *
 * Generates print-ready PDF from the executive memo HTML
 * using Playwright headless Chromium.
 *
 * Strategy:
 * 1. Render the executive memo HTML (self-contained, no external deps)
 * 2. Open in a headless browser
 * 3. Print to PDF with proper margins, headers, and page breaks
 *
 * The PDF is generated on-demand via the export API,
 * not pre-cached during COMPLETE phase.
 */

import type { IRGraph } from "@/lib/pipeline/ir-types";
import type { Renderer, RenderOutput } from "./types";
import { executiveMemoRenderer } from "./executive-memo";

async function renderPDF(
  ir: IRGraph,
  options?: Record<string, unknown>,
): Promise<RenderOutput> {
  // 1. First render the executive memo HTML (self-contained)
  const memoOutput = await executiveMemoRenderer.render(ir, options);
  const html = memoOutput.content as string;

  // 2. Launch headless browser and render to PDF
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();

    // Set content directly (self-contained HTML, no external deps)
    await page.setContent(html, { waitUntil: "networkidle" });

    // Wait for any CSS animations to settle
    await page.waitForTimeout(500);

    // Generate PDF with print-optimized settings
    const pdfBuffer = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: {
        top: "0.75in",
        right: "0.75in",
        bottom: "1in",
        left: "0.75in",
      },
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size: 8px; color: #666; width: 100%; text-align: right; padding-right: 0.75in;">
          PRISM Strategic Intelligence
        </div>
      `,
      footerTemplate: `
        <div style="font-size: 8px; color: #666; width: 100%; display: flex; justify-content: space-between; padding: 0 0.75in;">
          <span>Confidential</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      `,
    });

    const query = (options?.query as string) ?? "intelligence-report";
    const slug = query
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 50);

    return {
      format: "pdf",
      mimeType: "application/pdf",
      content: Buffer.from(pdfBuffer),
      filename: `prism-${slug}.pdf`,
    };
  } finally {
    await browser.close();
  }
}

export const pdfRenderer: Renderer = {
  format: "pdf",
  name: "PDF Report",
  description: "Print-ready PDF generated from the executive memo via Playwright",
  canRender(ir: IRGraph): boolean {
    // Same requirements as the executive memo
    return executiveMemoRenderer.canRender(ir);
  },
  render: renderPDF,
};
