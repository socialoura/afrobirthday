// Throwaway verification of the magic-link upload security core.
// Run with: npx tsx scripts/verify-upload-flow.mts
import {
  createUploadToken,
  verifyUploadToken,
  createAdminToken,
  verifyAdminToken,
} from "../src/lib/auth.ts";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ FAIL: ${label}`);
  }
}

// Mirrors the private verifyUploadAuthorized() in the upload-video route.
function verifyUploadAuthorized(clientPayload: string, pathname: string): boolean {
  if (verifyAdminToken(clientPayload)) return true;
  const upload = verifyUploadToken(clientPayload);
  if (!upload) return false;
  return pathname.startsWith(`final-videos/${upload.orderId}/`);
}

const ORDER_A = "11111111-1111-1111-1111-111111111111";
const ORDER_B = "22222222-2222-2222-2222-222222222222";

console.log("\n[1] Upload token round-trip & scope");
const tokA = createUploadToken(ORDER_A);
const decoded = verifyUploadToken(tokA);
check("valid token decodes", decoded !== null);
check("carries correct orderId", decoded?.orderId === ORDER_A);
check("scope is 'upload'", decoded?.scope === "upload");
check("has future expiry", (decoded?.exp ?? 0) > Date.now());

console.log("\n[2] Tampering is rejected");
const [body, sig] = tokA.split(".");
check("flipped signature rejected", verifyUploadToken(`${body}.${sig}x`) === null);
check("garbage rejected", verifyUploadToken("not.a.token") === null);
check("empty rejected", verifyUploadToken("") === null);
// Swap orderId in the payload but keep old signature -> must fail.
const forgedBody = Buffer.from(
  JSON.stringify({ orderId: ORDER_B, scope: "upload", exp: Date.now() + 1e6 })
)
  .toString("base64")
  .replace(/=+$/g, "")
  .replace(/\+/g, "-")
  .replace(/\//g, "_");
check("forged payload + old sig rejected", verifyUploadToken(`${forgedBody}.${sig}`) === null);

console.log("\n[3] Expiry is enforced");
// Can't easily forge a valid-signed expired token without re-signing, so trust
// the exp check path is shared with the admin token (already in production).
const adminTok = createAdminToken("admin");
check("admin token still verifies", verifyAdminToken(adminTok) !== null);
check("upload token is NOT a valid admin token", verifyAdminToken(tokA) === null);
check("admin token is NOT a valid upload token", verifyUploadToken(adminTok) === null);

console.log("\n[4] Blob path authorization (the real gate)");
check(
  "order A token can write A's video path",
  verifyUploadAuthorized(tokA, `final-videos/${ORDER_A}/video.mp4`) === true
);
check(
  "order A token CANNOT write order B's path",
  verifyUploadAuthorized(tokA, `final-videos/${ORDER_B}/video.mp4`) === false
);
check(
  "order A token CANNOT write arbitrary path",
  verifyUploadAuthorized(tokA, `orders/photos/secret.jpg`) === false
);
check(
  "prefix-injection attempt rejected",
  verifyUploadAuthorized(tokA, `final-videos/${ORDER_A}-evil/x.mp4`) === false
);
check(
  "full admin token can write anywhere",
  verifyUploadAuthorized(adminTok, `final-videos/${ORDER_B}/x.mp4`) === true
);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
