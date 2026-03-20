import { describe, it, expect } from "vitest";
import {
  bakeAnimations,
  bakeCounters,
  recoverTruncation,
  stripEmbeddedStyles,
  enhanceAnimations,
  addBackgroundVariants,
} from "@/lib/pipeline/html-post-process";

describe("stripEmbeddedStyles", () => {
  it("removes a single embedded <style> block", () => {
    const html = '<head><style>.eyebrow{color:red}</style></head><body>Content</body>';
    expect(stripEmbeddedStyles(html)).toBe("<head></head><body>Content</body>");
  });

  it("removes multiple embedded <style> blocks", () => {
    const html = '<style>a{}</style><div>Hi</div><style>b{}</style>';
    expect(stripEmbeddedStyles(html)).toBe("<div>Hi</div>");
  });

  it("removes <style> with attributes", () => {
    const html = '<style type="text/css">.foo{}</style><body></body>';
    expect(stripEmbeddedStyles(html)).toBe("<body></body>");
  });

  it("preserves HTML with no <style> tags", () => {
    const html = '<head><link rel="stylesheet" href="/styles/presentation.css"></head>';
    expect(stripEmbeddedStyles(html)).toBe(html);
  });

  it("handles multiline style blocks", () => {
    const html = `<style>\n  .eyebrow {\n    color: var(--accent);\n  }\n</style><body></body>`;
    expect(stripEmbeddedStyles(html)).toBe("<body></body>");
  });
});

describe("bakeAnimations", () => {
  it("adds 'visible' to anim elements", () => {
    const html = '<div class="anim d1">Hello</div>';
    expect(bakeAnimations(html)).toBe('<div class="anim d1 visible">Hello</div>');
  });

  it("adds 'visible' to anim-scale elements", () => {
    const html = '<div class="anim-scale">Hello</div>';
    expect(bakeAnimations(html)).toBe('<div class="anim-scale visible">Hello</div>');
  });

  it("adds 'visible' to anim-blur elements", () => {
    const html = '<div class="anim-blur d3">Hello</div>';
    expect(bakeAnimations(html)).toBe('<div class="anim-blur d3 visible">Hello</div>');
  });

  it("does not double-add 'visible'", () => {
    const html = '<div class="anim visible">Hello</div>';
    expect(bakeAnimations(html)).toBe('<div class="anim visible">Hello</div>');
  });

  it("adds 'animate' to bar-fill elements", () => {
    const html = '<div class="bar-fill" style="width: 50%"></div>';
    expect(bakeAnimations(html)).toBe('<div class="bar-fill animate" style="width: 50%"></div>');
  });

  it("does not double-add 'animate'", () => {
    const html = '<div class="bar-fill animate" style="width: 50%"></div>';
    expect(bakeAnimations(html)).toBe(html);
  });

  it("adds 'is-visible' to chart elements", () => {
    const html = '<div class="bar-chart">Chart</div>';
    expect(bakeAnimations(html)).toBe('<div class="bar-chart is-visible">Chart</div>');
  });

  it("adds 'is-visible' to donut-chart elements", () => {
    const html = '<div class="donut-chart">Chart</div>';
    expect(bakeAnimations(html)).toBe('<div class="donut-chart is-visible">Chart</div>');
  });

  it("does not double-add 'is-visible'", () => {
    const html = '<div class="line-chart is-visible">Chart</div>';
    expect(bakeAnimations(html)).toBe(html);
  });

  it("handles multiple elements in one HTML string", () => {
    const html = '<div class="anim">A</div><div class="bar-fill">B</div><div class="sparkline">C</div>';
    const result = bakeAnimations(html);
    expect(result).toContain('anim visible');
    expect(result).toContain('bar-fill animate');
    expect(result).toContain('sparkline is-visible');
  });
});

describe("bakeCounters", () => {
  it("replaces stat-number inner text with data-target value", () => {
    const html = '<span class="stat-number" data-target="1500">0</span>';
    const result = bakeCounters(html);
    expect(result).toContain("1,500");
  });

  it("formats counter with prefix and suffix", () => {
    const html = '<span class="stat-number" data-target="2500" data-prefix="$" data-suffix="M">0</span>';
    const result = bakeCounters(html);
    expect(result).toContain("$");
    expect(result).toContain("2,500");
  });

  it("does not modify HTML without stat-number", () => {
    const html = '<span class="regular-text">Hello</span>';
    expect(bakeCounters(html)).toBe(html);
  });
});

describe("recoverTruncation", () => {
  it("returns HTML unchanged if </body> is present", () => {
    const html = "<html><body><section>Content</section></body></html>";
    expect(recoverTruncation(html)).toBe(html);
  });

  it("closes unclosed sections and appends </body></html>", () => {
    const html = "<html><body><section>Content";
    const result = recoverTruncation(html);
    expect(result).toContain("</section>");
    expect(result).toContain("</body>");
    expect(result).toContain("</html>");
  });

  it("handles multiple unclosed sections", () => {
    const html = "<html><body><section>A<section>B";
    const result = recoverTruncation(html);
    // 2 open, 0 closed = 2 unclosed
    expect((result.match(/<\/section>/g) || []).length).toBe(2);
    expect(result).toContain("</body>");
  });

  it("appends </body></html> even with no sections", () => {
    const html = "<html><body><div>Content</div>";
    const result = recoverTruncation(html);
    expect(result).toContain("</body>");
    expect(result).toContain("</html>");
  });
});

describe("enhanceAnimations", () => {
  it("upgrades slide-title .anim to .anim-blur", () => {
    const html = '<h1 class="slide-title anim">Title</h1>';
    const result = enhanceAnimations(html);
    expect(result).toContain("anim-blur");
    expect(result).not.toMatch(/\banim\b[^-]/);
  });

  it("upgrades hero-title .anim to .anim-blur", () => {
    const html = '<h1 class="hero-title anim d1">Big Title</h1>';
    const result = enhanceAnimations(html);
    expect(result).toContain("anim-blur");
  });

  it("upgrades grid-3 .anim to .stagger-children", () => {
    const html = '<div class="grid-3 anim">Grid</div>';
    const result = enhanceAnimations(html);
    expect(result).toContain("stagger-children");
  });

  it("upgrades hero-stats .anim to .anim-spring", () => {
    const html = '<div class="hero-stats anim">Stats</div>';
    const result = enhanceAnimations(html);
    expect(result).toContain("anim-spring");
  });

  it("upgrades source-list .anim to .anim-fade", () => {
    const html = '<div class="source-list anim">Sources</div>';
    const result = enhanceAnimations(html);
    expect(result).toContain("anim-fade");
  });

  it("upgrades emergent-number .anim to .anim-zoom", () => {
    const html = '<span class="emergent-number anim">42</span>';
    const result = enhanceAnimations(html);
    expect(result).toContain("anim-zoom");
  });

  it("does not upgrade if already has enhanced animation", () => {
    const html = '<h1 class="slide-title anim-spring d1">Title</h1>';
    const result = enhanceAnimations(html);
    expect(result).toBe(html);
  });

  it("does not modify elements without matching context classes", () => {
    const html = '<div class="some-div anim">Content</div>';
    const result = enhanceAnimations(html);
    expect(result).toBe(html);
  });
});

describe("addBackgroundVariants", () => {
  it("adds background variant classes to bare slide sections", () => {
    const html = '<section class="slide" id="s1"><div>Slide 1</div></section>';
    const result = addBackgroundVariants(html);
    expect(result).toMatch(/gradient-dark|gradient-blue|dark-particles|dark-mesh|gradient-radial/);
  });

  it("rotates through variants for multiple slides", () => {
    const html = [
      '<section class="slide" id="s1"><div>1</div></section>',
      '<section class="slide" id="s2"><div>2</div></section>',
      '<section class="slide" id="s3"><div>3</div></section>',
      '<section class="slide" id="s4"><div>4</div></section>',
      '<section class="slide" id="s5"><div>5</div></section>',
    ].join("\n");
    const result = addBackgroundVariants(html);
    // First two should be gradient-dark, next two gradient-blue, fifth dark-particles
    expect(result).toContain('slide gradient-dark" id="s1"');
    expect(result).toContain('slide gradient-dark" id="s2"');
    expect(result).toContain('slide gradient-blue" id="s3"');
    expect(result).toContain('slide gradient-blue" id="s4"');
    expect(result).toContain('slide dark-particles" id="s5"');
  });

  it("does not modify sections that already have background variants", () => {
    const html = '<section class="slide gradient-radial" id="s1"><div>1</div></section>';
    const result = addBackgroundVariants(html);
    // Should remain unchanged (already has gradient-radial)
    expect(result).toBe(html);
  });
});
