import { describe, expect, it } from "vitest";

import { IMAGE_REFERENCE_SITES } from "./image.server";

import { prisma } from "~/db.server";

interface RuntimeDataModel {
  models: Record<string, { fields: { name: string; kind: string }[] }>;
}

describe("IMAGE_REFERENCE_SITES", () => {
  it("covers every schema relation that targets Image", () => {
    const { models } = (
      prisma as unknown as { _runtimeDataModel: RuntimeDataModel }
    )._runtimeDataModel;

    // Prisma requires a back-relation on Image for every relation targeting
    // it, so Image's object-kind fields enumerate them all. A mismatch means
    // a new context points at Image without teaching the usage/cleanup logic
    // about it — extend the registry in image.server.ts.
    const relationsToImage = models.Image.fields
      .filter((field) => field.kind === "object")
      .map((field) => field.name)
      .sort();

    expect(relationsToImage).toEqual(Object.keys(IMAGE_REFERENCE_SITES).sort());
  });
});
