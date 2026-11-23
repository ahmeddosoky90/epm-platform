import crypto from "crypto";
import { Client, type ConnectConfig } from "ssh2";
import { prisma } from "../db";
import { decryptSecret } from "../crypto";

export type TechConn = { id: string; host: string; port: number; username: string; authType: string; secretEnc: string | null; hostKeySha256: string | null };

export class HostKeyMismatch extends Error {}

/**
 * Opens an SSH connection with host-key pinning: the first successful connection stores the
 * server's key fingerprint; later connections refuse a different key (possible MITM).
 */
export function connectSsh(c: TechConn, timeoutMs = 15_000): Promise<{ client: Client; fingerprint: string; firstUse: boolean }> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    let fingerprint = "";
    let mismatch = false;
    const secret = c.secretEnc ? decryptSecret(c.secretEnc) : undefined;
    const cfg: ConnectConfig = {
      host: c.host, port: c.port, username: c.username, readyTimeout: timeoutMs, keepaliveInterval: 20_000,
      ...(c.authType === "KEY" ? { privateKey: secret } : { password: secret }),
      hostVerifier: (key: Buffer) => {
        fingerprint = crypto.createHash("sha256").update(key).digest("base64");
        if (c.hostKeySha256 && c.hostKeySha256 !== fingerprint) { mismatch = true; return false; }
        return true;
      },
    };
    client.once("ready", async () => {
      const firstUse = !c.hostKeySha256;
      if (firstUse) await prisma.techConnection.update({ where: { id: c.id }, data: { hostKeySha256: fingerprint } });
      resolve({ client, fingerprint, firstUse });
    });
    client.once("error", (e) => reject(mismatch ? new HostKeyMismatch(`Host key changed (now SHA256:${fingerprint}). If the server was rebuilt, an administrator must reset the pinned key.`) : e));
    client.connect(cfg);
  });
}
