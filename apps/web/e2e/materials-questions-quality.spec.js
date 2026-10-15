import { test, expect } from "@playwright/test";
import fs from "node:fs";
const out = "test-results/evidence/R33/v1/attempt2";
for (const kind of ["T", "W"])
  test(`${kind} untouched native quality and editable formula persistence`, async ({
    page,
  }) => {
    await page.goto("/fixture/session");
    await page.getByRole("button", { name: "收录", exact: true }).click();
    if (kind === "T")
      await page
        .getByLabel("原始文字")
        .fill(
          fs.readFileSync(
            "test/fixtures/questions/T.txt",
            "utf8",
          ),
        );
    else {
      await page.getByRole("button", { name: "Word", exact: true }).click();
      await page
        .getByLabel("选择原稿")
        .setInputFiles("test/fixtures/questions/W.docx");
    }
    const created = page.waitForResponse(
      (r) =>
        r.url().endsWith("/questions/v2/imports") &&
        r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "保存原稿并整理" }).click();
    const id = (await (await created).json()).id;
    await expect(page.getByLabel("草稿标题")).toBeVisible({ timeout: 25000 });
    const material = await (
      await page.request.get(`/api/modules/questions/v2/imports/${id}`)
    ).json();
    fs.writeFileSync(
      `${out}/browser-native-${kind}.json`,
      JSON.stringify(material, null, 2),
    );
    expect(material.drafts).toHaveLength(6);
    for (let i = 0; i < 6; i++) {
      await page
        .getByRole("button", { name: `${i + 1} 待校对`, exact: true })
        .click();
      await expect(page.getByLabel("草稿标题")).toHaveValue(
        material.drafts[i].title,
      );
      await expect(page.locator(".q-review-result [data-formula-failed]")).toHaveCount(
        0,
      );
      await page.screenshot({ path: `${out}/quality-${kind}-${i + 1}.png` });
      expect(material.drafts[i].answerStatus).toBe(
        i === 5 ? "absent" : "present",
      );
      expect(material.drafts[i].parts.some((p) => p.role === "body")).toBe(
        true,
      );
      expect(material.drafts[i].parts.some((p) => p.role === "solution")).toBe(
        true,
      );
    }
    const first = material.drafts[0];
    expect(first.body.blocks[1].role).toBe("options");
    expect(first.body.blocks[1].items.map((i) => i.label)).toEqual([
      "A",
      "B",
      "C",
      "D",
    ]);
    for (const index of [1, 5])
      expect(
        material.drafts[index].body.blocks.find(
          (b) => b.role === "subquestions",
        ).items,
      ).toHaveLength(2);
    if (kind === "W") {
      for (const index of [1, 4, 5]) {
        const figure = material.drafts[index].body.blocks.find(
          (b) => b.type === "image",
        );
        expect(figure).toBeTruthy();
        const r = await page.request.get(
          `/api/workbench/files/${figure.fileId}/content`,
        );
        expect(r.ok()).toBe(true);
        fs.writeFileSync(`${out}/W-figure-${index + 1}.png`, await r.body());
      }
      expect(JSON.stringify(material.drafts[3].body)).not.toContain("OMML");
      expect(material.fragments.some((f) => f.text.includes("OMML"))).toBe(
        true,
      );
    }
    await page.getByRole("button", { name: "1 待校对", exact: true }).click();
    const source = page.locator(".q-review-result textarea").first();
    await source.fill((await source.inputValue()).replace("x-2", "x+2"));
    await page.getByRole("button", { name: "保存校对", exact: true }).click();
    await expect(page.locator(".q-message")).toContainText("校对已保存");
    await page.reload();
    await expect(source).toHaveValue(/x\+2/);
    fs.writeFileSync(
      `${out}/browser-corrected-${kind}.json`,
      JSON.stringify(
        await (
          await page.request.get(`/api/modules/questions/v2/imports/${id}`)
        ).json(),
        null,
        2,
      ),
    );
    for (const width of [1280, 1024]) {
      await page.setViewportSize({ width, height: width === 1024 ? 768 : 800 });
      await page.screenshot({ path: `${out}/quality-${kind}-${width}.png` });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  });
