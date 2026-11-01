import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { readFile } from "node:fs/promises";

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

test("renders the session-three scenario, questions and references as Markdown", async () => {
  const exam = JSON.parse(
    await readFile(
      new URL("../../practice/tests/03-v2.json", import.meta.url),
      "utf8",
    ),
  );
  const scenario = new JSDOM(renderPracticeMarkdown(exam.scenario)).window
    .document;
  assert.equal(scenario.querySelector("strong")?.textContent, "AAA");
  assert.equal(scenario.querySelector("code")?.textContent, "100");
  assert.equal(scenario.querySelectorAll("ul li").length, 6);
  assert.equal(exam.questions.length, 6);
  for (const question of exam.questions) {
    const prompt = new JSDOM(renderPracticeMarkdown(question.prompt)).window
      .document;
    assert.ok(prompt.querySelector("strong"), question.id);
    assert.equal(prompt.querySelectorAll("ul > li").length, 3, question.id);
    const reference = new JSDOM(renderPracticeMarkdown(question.reference))
      .window.document;
    assert.ok(reference.querySelector("strong"), question.id);
    assert.ok(reference.body.textContent.trim(), question.id);
  }
});

test("renders grade summaries and feedback safely, including historical plain text", () => {
  for (const source of [
    "**Đạt** và *cần ôn* `resync`\nDòng tiếp\n\n- Nhận xét",
    "**Đúng** và *cần bổ sung* `snapshot`\nDòng tiếp\n\n- Giải thích",
  ]) {
    const html = renderPracticeMarkdown(
      source + "\n\n<script>alert(1)</script>\n\n[độc](javascript:alert(1))",
    );
    const document = new JSDOM(html).window.document;
    assert.ok(document.querySelector("strong"));
    assert.ok(document.querySelector("em"));
    assert.ok(document.querySelector("code"));
    assert.ok(document.querySelector("br"));
    assert.ok(document.querySelector("ul li"));
    assert.equal(document.querySelector('script, [href^="javascript:"]'), null);
  }
  for (const source of [
    "Tổng kết cũ: cần củng cố.",
    "Nhận xét cũ không có Markdown.",
  ]) {
    const document = new JSDOM(renderPracticeMarkdown(source)).window.document;
    assert.equal(document.body.textContent.trim(), source);
  }
});
