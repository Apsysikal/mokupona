import { bindBlock, registry as blockRegistry } from "./blocks";
import { readBlock } from "./engine";

const readFromDb = () => "";

const result = readBlock("test", readFromDb(), 0, {});

function render() {
  if (result.status !== "success") return null;
  const component = blockRegistry[result.kind];
  const { data, render } = bindBlock(component, result.data);
}
