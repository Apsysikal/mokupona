import type { ComponentProps } from "react";

import type {
  BlockRegistry,
  BlockRegistryKey,
  ResolvedBlockUnion,
} from "./engine";
import { HeroSectionBlockEditor } from "./hero/editor";
import { HeroSectionBlockView } from "./hero/view";
import { ImageBlockEditor } from "./image/editor";
import { ImageBlockView } from "./image/view";
import { TextSectionBlockEditor } from "./text-section/editor";
import { TextSectionBlockView } from "./text-section/view";
import type { Fieldset, UnionToIntersection } from "./types";

/**
 * Props every view component accepts (`className`, `style`, event handlers, …),
 * derived as the intersection of each block's own extras. Forwarded through the
 * union dispatch below. Per-kind-*only* props can't cross the union (TS #30581) —
 * render the concrete component for those.
 */
type SharedViewExtra = UnionToIntersection<
  {
    [K in BlockRegistryKey]: Omit<
      ComponentProps<BlockRegistry[K]["viewComponent"]>,
      "data"
    >;
  }[BlockRegistryKey]
>;

export function BlockView({
  block,
  ...extra
}: { block: ResolvedBlockUnion } & SharedViewExtra) {
  switch (block.kind) {
    case "hero":
      return <HeroSectionBlockView data={block.data} {...extra} />;
    case "image":
      return <ImageBlockView data={block.data} {...extra} />;
    case "text-section":
      return <TextSectionBlockView data={block.data} {...extra} />;
    default: {
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}

/**
 * `{ kind, fields }` as a distributive union, so a `switch` on `kind` narrows
 * `fields` to the right per-kind `Fieldset`. The caller builds it at a concrete
 * kind (conform `useForm` against that kind's editor schema).
 */
type BlockEditorProps<K extends BlockRegistryKey> = K extends K
  ? { kind: K; fields: Fieldset<BlockRegistry[K]["editorSchema"]> }
  : never;

type SharedEditorExtra = UnionToIntersection<
  {
    [K in BlockRegistryKey]: Omit<
      ComponentProps<BlockRegistry[K]["editorComponent"]>,
      "fields"
    >;
  }[BlockRegistryKey]
>;

export function BlockEditor(
  props: BlockEditorProps<BlockRegistryKey> & SharedEditorExtra,
) {
  switch (props.kind) {
    case "hero": {
      const { kind: _kind, fields, ...extra } = props;
      return <HeroSectionBlockEditor fields={fields} {...extra} />;
    }
    case "image": {
      const { kind: _kind, fields, ...extra } = props;
      return <ImageBlockEditor fields={fields} {...extra} />;
    }
    case "text-section": {
      const { kind: _kind, fields, ...extra } = props;
      return <TextSectionBlockEditor fields={fields} {...extra} />;
    }
    default: {
      const _exhaustive: never = props;
      return _exhaustive;
    }
  }
}
