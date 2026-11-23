import net from "net";

/**
 * Minimal Guacamole protocol tunnel (https://guacamole.apache.org/doc/gug/guacamole-protocol.html).
 * The browser runs guacamole-common-js; this side speaks to guacd (the Apache Guacamole proxy daemon),
 * which in turn speaks RDP to the target server. Connection parameters (host, credentials) are set
 * here on the server and never pass through the browser.
 */
export const encode = (...el: (string | number)[]) => el.map((e) => { const s = String(e); return `${[...s].length}.${s}`; }).join(",") + ";";

/** Splits a stream into complete instructions; returns [instructions, remainder]. */
export function splitInstructions(buf: string): [string[][], string, string[]] {
  const out: string[][] = []; const raw: string[] = [];
  let i = 0, start = 0;
  let cur: string[] = [];
  while (i < buf.length) {
    const dot = buf.indexOf(".", i);
    if (dot === -1) break;
    const len = Number(buf.slice(i, dot));
    if (!Number.isInteger(len) || len < 0) throw new Error("Malformed Guacamole instruction");
    // advance `len` code points
    let j = dot + 1, n = 0;
    while (n < len && j < buf.length) { const c = buf.charCodeAt(j); j += c >= 0xd800 && c <= 0xdbff ? 2 : 1; n++; }
    if (n < len || j >= buf.length) break; // need more data (terminator not yet received)
    cur.push(buf.slice(dot + 1, j));
    const term = buf[j];
    i = j + 1;
    if (term === ";") { out.push(cur); raw.push(buf.slice(start, i)); cur = []; start = i; }
    else if (term !== ",") throw new Error("Malformed Guacamole instruction");
  }
  return [out, buf.slice(start), raw];
}

export type RdpParams = { hostname: string; port: number; username: string; password?: string; domain?: string | null; ignoreCert: boolean; width: number; height: number; dpi: number };

/** Opens a guacd connection and completes the RDP handshake. Resolves once guacd says "ready". */
export function guacdConnect(p: RdpParams, guacd = { host: process.env.GUACD_HOST ?? "127.0.0.1", port: Number(process.env.GUACD_PORT ?? 4822) }): Promise<{ socket: net.Socket; id: string; leftover: string }> {
  return new Promise((resolve, reject) => {
    const sock = net.connect(guacd);
    sock.setEncoding("utf8");
    let buf = ""; let phase: "args" | "ready" = "args";
    const fail = (e: Error) => { sock.destroy(); reject(e); };
    sock.setTimeout(20_000, () => fail(new Error("guacd did not answer in time")));
    sock.on("error", (e) => fail(new Error(`Cannot reach the RDP gateway (guacd at ${guacd.host}:${guacd.port}): ${e.message}`)));
    sock.on("connect", () => sock.write(encode("select", "rdp")));
    const onData = (d: string) => {
      buf += d;
      let ins: string[][];
      try { [ins, buf] = splitInstructions(buf); } catch (e) { return fail(e as Error); }
      for (const [op, ...args] of ins) {
        if (op === "error") return fail(new Error(`RDP gateway error: ${args[0]}`));
        if (phase === "args" && op === "args") {
          const values: Record<string, string> = {
            hostname: p.hostname, port: String(p.port), username: p.username, password: p.password ?? "", domain: p.domain ?? "",
            security: "any", "ignore-cert": p.ignoreCert ? "true" : "", "enable-wallpaper": "", "disable-audio": "true",
            "enable-drive": "", "enable-printing": "", "disable-copy": "", "disable-paste": "",
          };
          const reply = args.map((name) => (name.startsWith("VERSION_") ? "VERSION_1_3_0" : values[name] ?? ""));
          sock.write(encode("size", p.width, p.height, p.dpi) + encode("audio") + encode("video") + encode("image", "image/png", "image/jpeg", "image/webp") + encode("timezone", "Africa/Cairo") + encode("connect", ...reply));
          phase = "ready";
        } else if (phase === "ready" && op === "ready") {
          sock.removeListener("data", onData); sock.setTimeout(0);
          return resolve({ socket: sock, id: args[0], leftover: buf });
        }
      }
    };
    sock.on("data", onData);
  });
}
