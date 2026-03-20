import { describe, expect, it } from "vitest";
import { ComponentCatalog } from "../present/component-catalog";
import { buildRemediationContext } from "../present/remediator";
import type { RemediationInput } from "../present/types";

function makeInput(overrides?: Partial<RemediationInput>): RemediationInput {
  return {
    slideNumber: 3,
    slideType: "executive-summary",
    templateId: "CO-06",
    componentHints: [],
    originalHtml: `
      <section class="slide gradient-dark" data-slide-type="executive-summary">
        <div class="slide-bg-glow"></div>
        <div class="slide-inner">
          <div class="callout"></div>
          <div class="summary-card-stack"></div>
        </div>
        <div class="slide-footer"></div>
      </section>
    `,
    validatorIssues: [],
    exemplarHtml: "<section>executive exemplar</section>",
    chartFragments: [],
    ...overrides,
  };
}

describe("remediator context", () => {
  it("keeps the slide-specific exemplar and vocabulary for executive summary slides", () => {
    const catalog = new ComponentCatalog();
    const context = buildRemediationContext(makeInput(), catalog);

    expect(context.slideType).toBe("executive-summary");
    expect(context.slideLabel).toBe("executive-summary slide (CO-06)");
    expect(context.exemplarHtml).toContain("executive exemplar");
    expect(context.componentRef).toContain("`.callout`");
    expect(context.componentRef).toContain("`.summary-card-stack`");
    expect(context.componentRef).toContain("`.stat-grid`");
    expect(context.componentRef).toContain("`.slide-title`");
  });

  it("infers slide type from rendered HTML when metadata is missing", () => {
    const catalog = new ComponentCatalog();
    const context = buildRemediationContext(
      makeInput({
        slideType: undefined,
        templateId: "CL-08",
        exemplarHtml: "",
        originalHtml: `
          <section class="slide gradient-dark" data-slide-type="findings-toc">
            <div class="slide-bg-glow"></div>
            <div class="slide-inner">
              <div class="toc-group-header">Context</div>
              <div class="toc-item">Item</div>
            </div>
            <div class="slide-footer"></div>
          </section>
        `,
      }),
      catalog,
    );

    expect(context.slideType).toBe("findings-toc");
    expect(context.slideLabel).toBe("findings-toc slide (CL-08)");
    expect(context.exemplarHtml.length).toBeGreaterThan(0);
    expect(context.componentRef).toContain("`.toc-group-header`");
    expect(context.componentRef).toContain("`.toc-item`");
  });
});
