# Ubiquitous Language

## Pages

| Term                    | Definition                                                                                                  | Aliases to avoid              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **Editable Page**       | A code-registered public page whose content can be managed through the CMS.                                 | CMS route, dynamic page       |
| **Page Key**            | A stable external identifier for an editable page.                                                          | Slug, path, route id          |
| **Page Definition**     | The developer-owned specification of an editable page's defaults, rules, allowed blocks, and migrations.    | Page config, page schema      |
| **Default-backed Page** | An editable page currently loaded from code defaults because no persisted page exists yet.                  | Seeded page, unsaved page     |
| **Persisted Page**      | An editable page whose current source of truth is stored in the database.                                   | Materialized page, live page  |
| **Page Snapshot**       | The canonical in-memory representation of a page at read or mutation time.                                  | DTO, Prisma page              |
| **Projection**          | A caller-specific view derived from a page snapshot.                                                        | View model, transformed page  |
| **Public Projection**   | The minimal render-ready view of a page for the public site.                                                | Public snapshot, public DTO   |
| **Editor Model**        | The precomputed admin-facing view of a page snapshot with capabilities, options, and status.                | Client-derived state, UI glue |
| **Page Rule**           | A declarative constraint on which blocks a page may contain and where they may appear.                      | Validator, custom logic       |
| **Page Migration**      | A stepwise transformation that updates a persisted page's structure to the current page-definition version. | Normalizer, upgrade script    |

## Blocks

| Term                     | Definition                                                                                                                       | Aliases to avoid                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **Block Definition**     | The developer-owned contract for one block type, including schema, defaults, migrations, editor, renderer, and helpers.          | Block config, block module       |
| **Block Type**           | A stable external identifier for a kind of block.                                                                                | Component name, block key        |
| **Block Instance**       | One ordered occurrence of a block on a specific page.                                                                            | Block row, block item            |
| **Definition Key**       | A stable developer-owned identifier for a default block slot within a page definition.                                           | Slot id, semantic id, editor key |
| **Block Ref**            | A domain-level pointer that lets commands target a block by definition key before persistence and by block id after persistence. | Block selector, row id           |
| **Supported Block**      | A block instance whose type exists and whose data can be migrated, validated, and resolved.                                      | Normal block, valid block        |
| **Unsupported Block**    | A block instance whose stored block type no longer exists in the active block registry.                                          | Deleted block, unknown block     |
| **Broken Block**         | A block instance whose type exists but whose data cannot be migrated, validated, or resolved.                                    | Invalid block, corrupt block     |
| **Tombstone Definition** | A lightweight definition for a removed block type used only to label and recover unsupported blocks.                             | Legacy block, deleted definition |
| **Render Model**         | The render-ready data produced from canonical block data plus resolved dependencies.                                             | View props, resolved data        |

## Media And Linking

| Term                | Definition                                                                                       | Aliases to avoid          |
| ------------------- | ------------------------------------------------------------------------------------------------ | ------------------------- |
| **Image Reference** | A block-level reference to either a code asset or an uploaded image.                             | Src, image path           |
| **Asset Image**     | A code-defined image reference that points to a static app asset and is read-only in admin.      | Default image, static src |
| **Uploaded Image**  | A CMS-managed image reference that points to an uploaded image record by id.                     | Stored src, media URL     |
| **Resolved Image**  | The shared minimal render-ready image object derived from an image reference and image metadata. | Image DTO, file payload   |
| **Link Target**     | A developer-registered internal destination that blocks may link to by stable key.               | Href, route option        |
| **Link Target Key** | The stable key stored in block data for an internal destination.                                 | Path, URL                 |

## Operations And Recovery

| Term                  | Definition                                                                                                                        | Aliases to avoid                  |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **Page Command**      | A typed mutation request applied to a page snapshot, such as updating meta, adding a block, or resetting the page.                | Action type, route action         |
| **Revision**          | The monotonic concurrency token on a persisted page used to reject stale writes.                                                  | updatedAt check, version          |
| **Diagnostic**        | A typed machine-readable signal describing noteworthy read, write, migration, or resolution outcomes.                             | Log message, toast string         |
| **Provenance**        | The explicit record of whether a page snapshot came from defaults or persisted data.                                              | Source hint, inferred state       |
| **Materialization**   | The first successful write that snapshots a default-backed page into persisted page and block records.                            | Initial save, bootstrap persist   |
| **Healing**           | Persisting a newly valid normalized snapshot that repairs a previously invalid persisted page.                                    | Auto-fix, repair save             |
| **Reset to Defaults** | The destructive action that deletes a persisted page so reads fall back to code defaults again.                                   | Re-seed, revert                   |
| **Safe Recovery**     | The public-side fallback from invalid persisted content to known-good defaults while preserving persisted state for admin repair. | Graceful fallback, partial render |

## Relationships

- An **Editable Page** is identified by exactly one **Page Key** and specified by exactly one **Page Definition**.
- A **Page Definition** governs both the **Default-backed Page** state and every future **Persisted Page** state for the same **Page Key**.
- A **Page Snapshot** contains an ordered list of **Block Instances** and can be transformed into a **Public Projection** or an **Editor Model**.
- A **Block Definition** owns exactly one **Block Type** and may appear only where a **Page Rule** allows it.
- A default **Block Instance** may carry one **Definition Key**; editor-added block instances do not.
- A **Page Command** targets a **Block Instance** through a **Block Ref** when block-level mutation is required.
- An **Uploaded Image** is referenced through **Image References** stored inside block data, not through separate relational CMS link tables.
- **Diagnostics** can be produced during reads, commands, migrations, resolution, and recovery.

## Example Dialogue

> **Dev:** "When `/admin/pages/home` has no row yet, am I editing a **Persisted Page**?"
>
> **Domain expert:** "No. You are editing a **Default-backed Page** identified by the `home` **Page Key**. The first successful **Page Command** will **Materialize** it."
>
> **Dev:** "Before that first save, how do I target the hero block?"
>
> **Domain expert:** "Use a **Block Ref** that points to the block's **Definition Key**, like `hero-main`. After materialization, the same command model can target the persisted block id instead."
>
> **Dev:** "What if the `hero` **Block Type** disappears from the registry later?"
>
> **Domain expert:** "Then it becomes an **Unsupported Block**. Admin still sees it in the **Page Snapshot** with a **Diagnostic**, while the **Public Projection** omits it and uses **Safe Recovery** if page rules are violated."

## Flagged Ambiguities

- "page" has been used to mean both the developer-owned spec and the runtime content. Use **Page Definition** for code-owned structure, and **Page Snapshot** or **Persisted Page** for runtime state.
- "block" has been used to mean both the stable kind and one occurrence on a page. Use **Block Type** for the kind and **Block Instance** for one ordered occurrence.
- "default" has been used to mean both starter content and fallback behavior. Use **Default-backed Page** for the current source state, **Reset to Defaults** for the destructive admin action, and **Safe Recovery** for public fallback behavior.
- "invalid block" has covered two different failure modes. Use **Unsupported Block** when the block type is missing, and **Broken Block** when the block type exists but the payload is unusable.
- "id" has been used for both database identity and semantic default slots. Use **Definition Key** for developer-owned semantic slots, and use **Block Ref** or persisted block id for mutable runtime targeting.
