import fs from "fs";
import replaceSection from "replace-section";
import { generateHtml } from "./degen-sponsors/generate-html";
import { z } from "zod";

async function main() {
  const FARCASTER_USERNAME = z.string().parse(process.env.FARCASTER_USERNAME);
  const DUNE_API_KEY = z.string().parse(process.env.DUNE_API_KEY);
  const code = await generateHtml(FARCASTER_USERNAME, DUNE_API_KEY);

  const readme = await fs.promises.readFile("README.md", "utf8");
  const startWith = "<!-- replace-degen-sponsors -->";
  const endWith = "<!-- replace-degen-sponsors -->";
  await fs.promises.writeFile(
    "README.md",
    replaceSection({
      input: readme,
      startWith,
      endWith,
      replaceWith: `${startWith}
${code}
${endWith}`,
    }),
    "utf-8"
  );
}

main();
