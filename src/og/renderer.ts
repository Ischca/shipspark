import { initWasm, Resvg } from "@resvg/resvg-wasm";
// @ts-expect-error -- wasm binary import
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
import { decodeSoraFont } from "./font-data";

let initialized = false;
let fontBuffer: Uint8Array | null = null;

const ensureInit = async (): Promise<void> => {
  if (initialized) return;
  await initWasm(resvgWasm);
  fontBuffer = decodeSoraFont();
  initialized = true;
};

export const renderSvgToPng = async (svg: string): Promise<Uint8Array> => {
  await ensureInit();
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
    font: {
      fontBuffers: [fontBuffer!],
      defaultFontFamily: "Sora",
      sansSerifFamily: "Sora",
    },
  });
  const rendered = resvg.render();
  const png = rendered.asPng();
  rendered.free();
  return png;
};
