import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";

const dom = new JSDOM("");
globalThis.window = dom.window;
const { renderPracticeMarkdown } = await import("./practiceMarkdown.js");

test("renders paragraphs, line breaks, lists, emphasis and inline code", () => {
  const html = renderPracticeMarkdown(
    "**Đậm** và *nghiêng* với `mã`\ndòng tiếp\n\n- Một\n- Hai\n\nĐoạn cuối",
  );
  const document = new JSDOM(html).window.document;
  assert.equal(document.querySelector("strong")?.textContent, "Đậm");
  assert.equal(document.querySelector("em")?.textContent, "nghiêng");
  assert.equal(document.querySelector("code")?.textContent, "mã");
  assert.ok(document.querySelector("br"));
  assert.equal(document.querySelectorAll("ul li").length, 2);
  assert.equal(document.querySelectorAll("p").length, 2);
});

test("removes executable HTML and dangerous links", () => {
  const html = renderPracticeMarkdown(
    '<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n[độc](javascript:alert(1))\n\n<a href="javascript:alert(1)" onclick="alert(1)">x</a>',
  );
  const document = new JSDOM(html).window.document;
  assert.equal(
    document.querySelector("script, img, [onclick], [onerror]"),
    null,
  );
  assert.equal(document.querySelector('a[href^="javascript:"]'), null);
});

test("keeps ordinary legacy plain-text questions readable", () => {
  const document = new JSDOM(
    renderPracticeMarkdown("Câu hỏi cũ không có Markdown?"),
  ).window.document;
  assert.equal(
    document.body.textContent.trim(),
    "Câu hỏi cũ không có Markdown?",
  );
});
