import { randomUUID } from "node:crypto";
import { CareersImageKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type ImageType = {
  contentType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
};

function detectImageType(bytes: Uint8Array): ImageType | null {
  const starts = (...signature: number[]) =>
    signature.every((value, index) => bytes[index] === value);

  if (bytes.length >= 3 && starts(0xff, 0xd8, 0xff)) {
    return { contentType: "image/jpeg" };
  }

  if (
    bytes.length >= 8 &&
    starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
  ) {
    return { contentType: "image/png" };
  }

  if (
    bytes.length >= 12 &&
    starts(0x52, 0x49, 0x46, 0x46) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { contentType: "image/webp" };
  }

  if (
    bytes.length >= 6 &&
    /^GIF8[79]a$/.test(String.fromCharCode(...bytes.subarray(0, 6)))
  ) {
    return { contentType: "image/gif" };
  }

  return null;
}

export async function uploadCareersImage(input: {
  schoolId: string;
  schoolSlug: string;
  kind: "logo" | "cover";
  bytes: Uint8Array;
}) {
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Images must be greater than 0 bytes and no larger than 5 MB.");
  }

  const imageType = detectImageType(input.bytes);
  if (!imageType) {
    throw new Error("Unsupported image. Use a valid JPEG, PNG, WebP, or GIF image.");
  }

  const id = randomUUID();
  const kind = input.kind === "logo"
    ? CareersImageKind.LOGO
    : CareersImageKind.COVER;

  await prisma.careersImage.create({
    data: {
      id,
      schoolId: input.schoolId,
      kind,
      contentType: imageType.contentType,
      sizeBytes: input.bytes.byteLength,
      data: Buffer.from(input.bytes),
    },
    select: { id: true },
  });

  return {
    id,
    key: id,
    url: "/api/public/careers/" +
      encodeURIComponent(input.schoolSlug) +
      "/images/" + encodeURIComponent(id),
    contentType: imageType.contentType,
    size: input.bytes.byteLength,
  };
}
