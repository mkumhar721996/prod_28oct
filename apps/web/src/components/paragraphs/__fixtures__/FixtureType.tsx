import { classNamesForType, type ParagraphBlock } from "../registry";

export function FixtureType({ block }: { block: ParagraphBlock }) {
  return <div data-testid="fixture-type" className={classNamesForType(block.type)} />;
}

export function FixtureTwo({ block }: { block: ParagraphBlock }) {
  return <div data-testid="fixture-two" className={classNamesForType(block.type)} />;
}
