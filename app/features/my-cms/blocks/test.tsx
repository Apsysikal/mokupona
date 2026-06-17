import { readBlock } from "./engine";
import { BlockView } from "./render";

const readFromDb = () => "hero";

const result = readBlock("test", readFromDb(), 1, {});

export function Render() {
  if (result.status !== "success") return null;

  // `result` is now the discriminated success union; <BlockView> dispatches it
  // and forwards shared extras (className) without a call-site cast.
  return <BlockView block={result} className="mx-2" />;
}
