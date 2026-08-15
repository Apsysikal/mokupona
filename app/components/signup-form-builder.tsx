import {
  getInputProps,
  getSelectProps,
  getTextareaProps,
  useFormMetadata,
  type FieldMetadata,
} from "@conform-to/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  Link2Icon,
  LinkBreak2Icon,
  TrashIcon,
} from "@radix-ui/react-icons";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  CheckboxField,
  ErrorList,
  Field,
  SelectField,
  TextareaField,
} from "./forms";
import { Button, buttonVariants } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { fieldShellClassName, Input } from "./ui/input";
import { Label } from "./ui/label";

import { MAX_FIELD_DESCRIPTION_LENGTH } from "~/features/forms/bounds";
import { FIELD_KEY_REGEX } from "~/features/forms/fields/base";
import {
  NON_LIST_FIELD_TYPES,
  type NonListFieldType,
} from "~/features/forms/fields/non-list";
import {
  defaultBuilderRows,
  linkedFieldKeys,
  slugifyFieldKey,
  type BuilderItemRow,
  type BuilderItemRowInput,
  type BuilderRowInput,
} from "~/features/signup-form/builder";
import type { AnswerCountsByFieldKey } from "~/features/signup-form/read.server";
import {
  FIXED_IDENTITY_FIELDS,
  MAX_FRIENDS_COUNT,
} from "~/features/signup-form/schema";
import { cn } from "~/lib/utils";

const PINNED_IDENTITY_KEYS = new Set<string>(
  FIXED_IDENTITY_FIELDS.map((field) => field.name),
);

const TYPE_LABELS: Record<NonListFieldType, string> = {
  text: "Text",
  textarea: "Text area",
  email: "Email",
  phone: "Phone",
  checkbox: "Checkbox",
  select: "Select",
};

const TYPE_OPTIONS = NON_LIST_FIELD_TYPES.map((type) => ({
  label: TYPE_LABELS[type],
  value: type,
}));

const NEW_ROW: BuilderItemRow = {
  type: "text",
  name: "",
  label: "",
  required: false,
};

const DESCRIPTION_HINT = `Shown to guests under the label. Keep it short and concise. Up to ${MAX_FIELD_DESCRIPTION_LENGTH} characters.`;

function DescriptionField({
  field,
  label = "Help text",
  hint,
}: {
  field: FieldMetadata<string | undefined>;
  label?: string;
  hint?: string;
}) {
  return (
    <TextareaField
      labelProps={{ children: label }}
      description={hint}
      textareaProps={{
        ...getTextareaProps(field),
        rows: 2,
        className: "resize-y",
      }}
      errors={field.errors}
    />
  );
}

const REMOVE_RESPONDED_FIELD_MESSAGE =
  "This form already has signups; answers to this field will disappear from future versions. Remove it anyway?";

type RowMetadata = FieldMetadata<BuilderRowInput>;
type ItemRowMetadata = FieldMetadata<BuilderItemRowInput>;
type EditableRowMetadata = RowMetadata | ItemRowMetadata;

function fieldTypeLabel(type: string): string {
  return TYPE_LABELS[type as NonListFieldType] ?? "Field";
}

function metaLine(...segments: Array<string | false | undefined>): string {
  return segments.filter(Boolean).join(" · ");
}

function nextFreeKey(base: string, taken: Set<string>): string {
  let counter = 2;
  while (taken.has(`${base}_${counter}`)) counter += 1;
  return `${base}_${counter}`;
}

const DETACHED_FORM_ID = "signup-form-builder-detached";

function linkDialogId(key: string): string {
  return `link-dialog-${key}`;
}

function unlinkDialogId(key: string): string {
  return `unlink-dialog-${key}`;
}

function getDialog(id: string): HTMLDialogElement | null {
  const element = document.getElementById(id);
  return element instanceof HTMLDialogElement ? element : null;
}

interface SignerSnapshot {
  type: string;
  label: string;
  required: boolean;
  description: string;
  options: string;
}

function readSigner(row: RowMetadata): SignerSnapshot {
  const fields = row.getFieldset();
  return {
    type: String(fields.type.value ?? "text"),
    label: String(fields.label.value ?? ""),
    required: Boolean(fields.required.value),
    description: String(fields.description.value ?? ""),
    options: String(fields.options.value ?? ""),
  };
}

function mirroredRowValue(signer: SignerSnapshot, name: string) {
  return {
    type: signer.type,
    name,
    label: signer.label,
    required: signer.required,
    ...(signer.description ? { description: signer.description } : {}),
    ...(signer.options ? { options: signer.options } : {}),
  };
}

interface BuilderLinks {
  linkedKeys: Set<string>;
  signerByKey: Map<string, RowMetadata>;
  itemFieldsMeta: FieldMetadata<BuilderItemRowInput[]> | undefined;
  takenKeys: Set<string>;
  answerCounts: AnswerCountsByFieldKey;
  pendingReveal: string | null;
  revealRow: (key: string) => void;
  resolveReveal: () => void;
}

const BuilderLinksContext = createContext<BuilderLinks | null>(null);

function useBuilderLinks(): BuilderLinks {
  const value = useContext(BuilderLinksContext);
  if (value === null) {
    throw new Error("useBuilderLinks must be used inside SignupFormBuilder");
  }
  return value;
}

export function SignupFormBuilder({
  field,
  lockFieldKeys = false,
  answerCounts = {},
}: {
  field: FieldMetadata<BuilderRowInput[]>;
  // true once the event's form has submissions: existing keys become
  // immutable and removals of existing fields ask for confirmation
  lockFieldKeys?: boolean;
  // per-field answer counts for the link/unlink dialog callouts
  answerCounts?: AnswerCountsByFieldKey;
}) {
  const form = useFormMetadata();
  const rows = field.getFieldList();

  const friendsRow = rows.find(
    (row) =>
      String((row as RowMetadata).getFieldset().type.value ?? "") === "list",
  ) as RowMetadata | undefined;
  const itemFieldsMeta = friendsRow?.getFieldset().itemFields;

  // The rows present when the screen loaded, identified by Conform's stable
  // row keys. `initialValue` cannot distinguish stored rows from new ones —
  // intents (the label auto-slug update, the link insert) write it too — and
  // pinning/locking must never trap a row the admin just created.
  const initialRowKeysRef = useRef<Set<string> | null>(null);
  initialRowKeysRef.current ??= new Set(
    [
      ...rows.map((row) => row.key),
      ...(itemFieldsMeta?.getFieldList() ?? []).map((row) => row.key),
    ].filter((key): key is string => key !== undefined),
  );
  const initialRowKeys = initialRowKeysRef.current;
  const isStoredRow = (rowKey: string | undefined) =>
    rowKey !== undefined && initialRowKeys.has(rowKey);

  const topLevelRows = rows.filter(
    (row) => row !== friendsRow,
  ) as RowMetadata[];
  const itemRows = (itemFieldsMeta?.getFieldList() ?? []) as ItemRowMetadata[];
  const keyOf = (row: EditableRowMetadata) => {
    const value = row.getFieldset().name.value;
    return value ? String(value) : undefined;
  };
  const topLevelKeyValues = topLevelRows.map(keyOf);
  const itemKeyValues = itemRows.map(keyOf);

  // The row a confirmed link just wrote, tracked by the shared field key: an
  // update intent hands the row a fresh Conform key, so a marker kept against
  // the key read at click time would point at a row that no longer exists.
  const [pendingReveal, setPendingReveal] = useState<string | null>(null);
  const revealedRow =
    pendingReveal === null
      ? undefined
      : itemRows[itemKeyValues.indexOf(pendingReveal)];
  const revealedRowKeys = new Set(
    (revealedRow ? [friendsRow?.key, revealedRow.key] : []).filter(
      (key): key is string => key !== undefined,
    ),
  );

  // Collapse state overlay: stored rows start collapsed, rows added in this
  // session start expanded; a toggle flips whichever default applies.
  const [toggledRows, setToggledRows] = useState<Set<string>>(new Set());
  const isRowOpen = (rowKey: string | undefined) => {
    if (rowKey === undefined) return true;
    if (revealedRowKeys.has(rowKey)) return true;
    const defaultOpen = !isStoredRow(rowKey);
    return toggledRows.has(rowKey) ? !defaultOpen : defaultOpen;
  };
  const toggleRow = (rowKey: string | undefined) => {
    if (rowKey === undefined) return;
    setToggledRows((previous) => {
      const next = new Set(previous);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }
      return next;
    });
  };
  // Resolving the marker hands the reveal over to the overlay, against the
  // keys the rows carry now, so they stay open once the marker is gone.
  const resolveReveal = () => {
    setToggledRows((previous) => {
      const next = new Set(previous);
      for (const rowKey of revealedRowKeys) {
        if (isStoredRow(rowKey)) {
          next.add(rowKey);
        } else {
          next.delete(rowKey);
        }
      }
      return next;
    });
    setPendingReveal(null);
  };

  const linkedKeys = linkedFieldKeys(topLevelKeyValues, itemKeyValues);
  const signerByKey = new Map<string, RowMetadata>();
  topLevelRows.forEach((row, index) => {
    const key = topLevelKeyValues[index];
    if (key !== undefined && !signerByKey.has(key)) signerByKey.set(key, row);
  });
  const takenKeys = new Set(
    [...topLevelKeyValues, ...itemKeyValues].filter(
      (key): key is string => key !== undefined,
    ),
  );

  const links: BuilderLinks = {
    linkedKeys,
    signerByKey,
    itemFieldsMeta,
    takenKeys,
    answerCounts,
    pendingReveal,
    revealRow: setPendingReveal,
    resolveReveal,
  };

  const linkableRows = topLevelRows.filter((row, index) => {
    const key = topLevelKeyValues[index];
    return (
      key !== undefined &&
      !linkedKeys.has(key) &&
      !(
        PINNED_IDENTITY_KEYS.has(
          String(row.getFieldset().name.initialValue ?? ""),
        ) && isStoredRow(row.key)
      ) &&
      signerByKey.get(key) === row
    );
  });
  const linkedPairs = [...linkedKeys].flatMap((key) => {
    const signerRow = signerByKey.get(key);
    const friendRow = itemRows[itemKeyValues.indexOf(key)];
    return signerRow && friendRow ? [{ key, signerRow, friendRow }] : [];
  });

  return (
    // heading and border come from the surrounding "Signup form" section card;
    // min-w-0 opts out of the fieldset default min-width:min-content, which
    // would otherwise let row headers push the card past small viewports
    <fieldset className="flex min-w-0 flex-col gap-4">
      <noscript>
        <style>{`[data-row-body]{display:block !important}`}</style>
      </noscript>
      <p aria-live="polite" className="sr-only">
        {linkedKeys.size > 0
          ? `Questions asked of the signer and of each friend: ${[...linkedKeys].sort().join(", ")}.`
          : "No questions are linked to friends."}
      </p>
      <ErrorList id={field.errorId} errors={field.errors} />

      <BuilderLinksContext.Provider value={links}>
        <ul className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <BuilderRowView
              key={row.key}
              row={row as RowMetadata}
              listName={field.name}
              index={index}
              count={rows.length}
              lockFieldKeys={lockFieldKeys}
              isStoredRow={isStoredRow}
              isRowOpen={isRowOpen}
              toggleRow={toggleRow}
            />
          ))}
        </ul>

        {/* dialogs live outside every collapsible: a <dialog> inside a
            display:none row body cannot render, even from the top layer */}
        {itemFieldsMeta
          ? linkableRows.map((row) => (
              <LinkDialog key={row.key} signerRow={row} />
            ))
          : null}
        {linkedPairs.map(({ key, signerRow, friendRow }) => (
          <UnlinkDialog
            key={key}
            sharedKey={key}
            signerRow={signerRow}
            friendRow={friendRow}
          />
        ))}
      </BuilderLinksContext.Provider>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          {...form.insert.getButtonProps({
            name: field.name,
            defaultValue: NEW_ROW,
          })}
        >
          Add field
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            // this discards every edit — and with signups, removed fields'
            // answers disappear from future versions
            const message = lockFieldKeys
              ? "This replaces the whole signup form with the default fields. This form already has signups — answers to removed fields will disappear from future versions. Continue?"
              : "Replace the signup form with the default fields?";
            if (window.confirm(message)) {
              form.update({ name: field.name, value: defaultBuilderRows() });
            }
          }}
        >
          Reset to default
        </Button>
      </div>
    </fieldset>
  );
}

function BuilderRowView({
  row,
  listName,
  index,
  count,
  lockFieldKeys,
  isStoredRow,
  isRowOpen,
  toggleRow,
}: {
  row: RowMetadata;
  listName: string;
  index: number;
  count: number;
  lockFieldKeys: boolean;
  isStoredRow: (rowKey: string | undefined) => boolean;
  isRowOpen: (rowKey: string | undefined) => boolean;
  toggleRow: (rowKey: string | undefined) => void;
}) {
  const { linkedKeys, signerByKey, itemFieldsMeta } = useBuilderLinks();
  const rowFields = row.getFieldset();
  const type = String(rowFields.type.value ?? "");
  const initialKey = String(rowFields.name.initialValue ?? "");
  const keyValue = String(rowFields.name.value ?? "");
  const labelValue = String(rowFields.label.value ?? "");
  // the single lock predicate: the row was stored when the screen loaded AND
  // the form already has signups
  const rowLocked = lockFieldKeys && isStoredRow(row.key);

  if (type === "list") {
    const maxCountValue = String(rowFields.maxCount.value ?? "");

    return (
      <RowCard
        row={row}
        className="border-sky-300/35 bg-sky-300/10"
        isRowOpen={isRowOpen}
        toggleRow={toggleRow}
        header={
          <RowHeader
            title={labelValue || "Friends"}
            meta={metaLine(
              "Group",
              maxCountValue === "0"
                ? "friends disabled"
                : maxCountValue !== "" &&
                    `up to ${maxCountValue} ${maxCountValue === "1" ? "friend" : "friends"}`,
            )}
            metaClassName="text-sky-300"
            listName={listName}
            index={index}
            count={count}
          />
        }
      >
        <FriendsRowView
          row={row}
          lockFieldKeys={lockFieldKeys}
          isStoredRow={isStoredRow}
          isRowOpen={isRowOpen}
          toggleRow={toggleRow}
        />
      </RowCard>
    );
  }

  // pinned-ness needs mount-time identity too: a custom row auto-slugged to
  // "email" must not morph into an unremovable pinned row
  const isPinnedIdentity =
    PINNED_IDENTITY_KEYS.has(initialKey) && isStoredRow(row.key);
  const isCanonical = keyValue !== "" && signerByKey.get(keyValue) === row;
  const isLinked = isCanonical && linkedKeys.has(keyValue);
  const isRequired = isPinnedIdentity || Boolean(rowFields.required.value);

  return (
    <RowCard
      row={row}
      // pinned identity cards carry the design's orange tint
      className={
        isPinnedIdentity ? "border-primary/35 bg-primary/10" : undefined
      }
      isRowOpen={isRowOpen}
      toggleRow={toggleRow}
      header={
        <RowHeader
          title={
            labelValue || (isPinnedIdentity ? initialKey : "Untitled field")
          }
          meta={metaLine(
            fieldTypeLabel(type),
            isLinked && "linked to friends",
            isRequired && "always required",
          )}
          listName={listName}
          index={index}
          count={count}
        />
      }
    >
      {isPinnedIdentity ? (
        <PinnedIdentityRowView row={row} />
      ) : (
        <>
          <EditableRowView row={row} keyLocked={rowLocked} />
          <ActionRow>
            {isLinked ? (
              <DialogTriggerButton dialogId={unlinkDialogId(keyValue)}>
                <LinkBreak2Icon />
                Unlink
              </DialogTriggerButton>
            ) : isCanonical && itemFieldsMeta ? (
              <DialogTriggerButton dialogId={linkDialogId(keyValue)}>
                <Link2Icon />
                Link to friends
              </DialogTriggerButton>
            ) : null}
            <RemoveButton
              listName={listName}
              index={index}
              confirmMessage={
                rowLocked ? REMOVE_RESPONDED_FIELD_MESSAGE : undefined
              }
            />
          </ActionRow>
        </>
      )}
    </RowCard>
  );
}

// The shared collapsible card shell around every builder row. A row with
// validation errors anywhere in its subtree is forced open — otherwise a
// failed submit could point at inputs hidden inside a collapsed panel.
function RowCard({
  row,
  className,
  isRowOpen,
  toggleRow,
  header,
  children,
}: {
  row: RowMetadata | ItemRowMetadata;
  className?: string;
  isRowOpen: (rowKey: string | undefined) => boolean;
  toggleRow: (rowKey: string | undefined) => void;
  header: ReactNode;
  children: ReactNode;
}) {
  const hasNestedErrors = Object.keys(row.allErrors).length > 0;

  return (
    <li className={cn("rounded-lg border", className)}>
      <Collapsible
        open={isRowOpen(row.key) || hasNestedErrors}
        onOpenChange={() => toggleRow(row.key)}
      >
        {header}
        <RowErrors id={row.errorId} errors={row.errors} />
        <CollapsibleContent
          forceMount
          data-row-body
          className="data-[state=closed]:hidden"
        >
          <div className="border-t p-4">{children}</div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

// Row-level errors stay visible even while the row is collapsed.
function RowErrors({ id, errors }: { id?: string; errors?: string[] }) {
  if (!errors?.length) return null;

  return (
    <div className="px-3 pb-2">
      <ErrorList id={id} errors={errors} />
    </div>
  );
}

// Header of a collapsible row card: the stacked title and meta line form the
// toggle trigger; the linked state is carried by the meta prose alone, so it
// is announced by screen readers and survives JavaScript being off.
function RowHeader({
  title,
  meta,
  metaClassName,
  listName,
  index,
  count,
}: {
  title: string;
  meta?: string;
  metaClassName?: string;
  listName: string;
  index: number;
  count: number;
}) {
  const form = useFormMetadata();

  return (
    <div className="flex items-center gap-2 p-2.5 sm:p-3">
      {/* the flex layout lives on an inner span because Safari mishandles
          buttons as flex containers */}
      <CollapsibleTrigger className="min-w-0 flex-1 cursor-pointer text-left">
        <span className="flex min-w-0 flex-col items-start gap-1">
          <span className="w-full truncate text-base font-semibold tracking-tight">
            {title}
          </span>
          {meta ? (
            <span
              className={cn(
                "text-foreground/65 text-xs text-pretty",
                metaClassName,
              )}
            >
              {meta}
            </span>
          ) : null}
        </span>
      </CollapsibleTrigger>

      <Button
        variant="ghost"
        size="icon"
        className="text-foreground/65 shrink-0"
        aria-label="Move up"
        disabled={index === 0}
        {...form.reorder.getButtonProps({
          name: listName,
          from: index,
          to: Math.max(0, index - 1),
        })}
      >
        <ArrowUpIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-foreground/65 shrink-0"
        aria-label="Move down"
        disabled={index === count - 1}
        {...form.reorder.getButtonProps({
          name: listName,
          from: index,
          to: Math.min(count - 1, index + 1),
        })}
      >
        <ArrowDownIcon />
      </Button>
      <CollapsibleTrigger
        aria-label="Toggle details"
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "text-foreground/65 shrink-0 [&[data-state=open]>svg]:rotate-180",
        )}
      >
        <ChevronDownIcon />
      </CollapsibleTrigger>
    </div>
  );
}

// The full-bleed action strip at the bottom of an expanded row body.
function ActionRow({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 mt-1 -mb-4 flex flex-wrap justify-end gap-2 border-t px-4 pt-3 pb-4">
      {children}
    </div>
  );
}

function RemoveButton({
  listName,
  index,
  confirmMessage,
}: {
  listName: string;
  index: number;
  confirmMessage?: string;
}) {
  const form = useFormMetadata();

  return (
    <Button
      variant="destructive-outline"
      size="sm"
      {...form.remove.getButtonProps({ name: listName, index })}
      onClick={
        confirmMessage
          ? (event) => {
              if (!window.confirm(confirmMessage)) {
                event.preventDefault();
              }
            }
          : undefined
      }
    >
      <TrashIcon />
      Remove
    </Button>
  );
}

// Opens a builder dialog declaratively (Invoker Commands work without JS);
// the click fallback covers browsers that predate commandfor.
function DialogTriggerButton({
  dialogId,
  children,
}: {
  dialogId: string;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      {...({ commandfor: dialogId, command: "show-modal" } as Record<
        string,
        unknown
      >)}
      onClick={() => {
        const dialog = getDialog(dialogId);
        if (dialog && !dialog.open) dialog.showModal();
      }}
    >
      {children}
    </Button>
  );
}

function DialogCancelButton({ dialogId }: { dialogId: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-foreground/80"
      {...({ commandfor: dialogId, command: "close" } as Record<
        string,
        unknown
      >)}
      onClick={() => getDialog(dialogId)?.close()}
    >
      Cancel
    </Button>
  );
}

function DialogCallout({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-sky-300/35 bg-sky-300/10 p-3 text-[13px] leading-relaxed text-sky-300">
      {children}
    </p>
  );
}

function BuilderDialog({
  id,
  labelId,
  onClose,
  children,
}: {
  id: string;
  labelId: string;
  onClose?: () => void;
  children: ReactNode;
}) {
  return (
    <dialog
      id={id}
      aria-labelledby={labelId}
      onClose={onClose}
      className="bg-card text-foreground backdrop:bg-background/70 m-auto w-[min(420px,calc(100vw-2rem))] flex-col gap-4 rounded-2xl border p-5 open:flex"
    >
      {children}
    </dialog>
  );
}

function LinkDialog({ signerRow }: { signerRow: RowMetadata }) {
  const form = useFormMetadata();
  const { linkedKeys, itemFieldsMeta, answerCounts, revealRow } =
    useBuilderLinks();
  const signer = readSigner(signerRow);
  const key = String(signerRow.getFieldset().name.value ?? "");
  const [choice, setChoice] = useState("new");
  const headingId = useId();
  const dialogId = linkDialogId(key);
  const friendCount = answerCounts[key]?.friends ?? 0;

  const itemRows = (itemFieldsMeta?.getFieldList() ?? []) as ItemRowMetadata[];
  const candidates = itemRows.flatMap((itemRow) => {
    const fields = itemRow.getFieldset();
    const itemKey = String(fields.name.value ?? "");
    if (itemKey !== "" && linkedKeys.has(itemKey)) return [];
    const itemLabel = String(fields.label.value ?? "");
    const matches =
      itemKey === key ||
      (itemLabel.trim() !== "" &&
        itemLabel.trim().toLowerCase() === signer.label.trim().toLowerCase());
    return matches ? [{ rowName: itemRow.name, label: itemLabel }] : [];
  });

  if (!itemFieldsMeta) return null;

  return (
    <BuilderDialog id={dialogId} labelId={headingId}>
      <h3 id={headingId} className="text-xl font-semibold">
        Also ask each friend this question?
      </h3>
      <p className="text-foreground/65 text-sm">
        “{signer.label || key}” stays editable on the signer's row. The friend's
        copy follows it and shares the field key <strong>{key}</strong>, so both
        answers export in one column.
      </p>
      <div
        className="flex flex-col gap-2"
        role="radiogroup"
        aria-labelledby={headingId}
      >
        <LinkChoiceOption
          name={`${dialogId}-choice`}
          checked={choice === "new"}
          onSelect={() => setChoice("new")}
          title="Add a new mirrored row"
          explanation="Appears last under Questions per friend."
        />
        {candidates.map((candidate) => (
          <LinkChoiceOption
            key={candidate.rowName}
            name={`${dialogId}-choice`}
            checked={choice === candidate.rowName}
            onSelect={() => setChoice(candidate.rowName)}
            title={`Mirror onto “${candidate.label}”`}
            explanation="Same field key. Its label, help text, type and Required are replaced by the signer's."
          />
        ))}
      </div>
      {friendCount > 0 ? (
        <DialogCallout>
          {friendCount === 1
            ? "1 friend has already answered this question."
            : `${friendCount} friends have already answered this question.`}{" "}
          Their answers move into the merged <strong>{key}</strong> column.
        </DialogCallout>
      ) : null}
      <div className="flex justify-end gap-2">
        <DialogCancelButton dialogId={dialogId} />
        <Button
          size="sm"
          {...form.insert.getButtonProps({
            name: itemFieldsMeta.name,
            defaultValue: mirroredRowValue(signer, key) as never,
          })}
          onClick={(event) => {
            event.preventDefault();
            const candidate = candidates.find((c) => c.rowName === choice);
            if (candidate) {
              form.update({
                name: candidate.rowName,
                value: mirroredRowValue(signer, key),
              });
            } else {
              form.insert({
                name: itemFieldsMeta.name,
                defaultValue: mirroredRowValue(signer, key) as never,
              });
            }
            revealRow(key);
            getDialog(dialogId)?.close();
          }}
        >
          Link to friends
        </Button>
      </div>
    </BuilderDialog>
  );
}

function LinkChoiceOption({
  name,
  checked,
  onSelect,
  title,
  explanation,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  explanation: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-2 rounded-lg border p-3",
        checked ? "border-primary/50 bg-primary/12" : "hover:bg-foreground/4",
      )}
    >
      {/* the form attribute names no element on purpose: the radios group for
          arrow-key navigation without ever joining the builder's payload */}
      <input
        type="radio"
        name={name}
        form={DETACHED_FORM_ID}
        checked={checked}
        onChange={onSelect}
        className="accent-primary mt-0.5 size-4 shrink-0"
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-foreground/65 text-[13px]">{explanation}</span>
      </span>
    </label>
  );
}

function UnlinkDialog({
  sharedKey,
  signerRow,
  friendRow,
}: {
  sharedKey: string;
  signerRow: RowMetadata;
  friendRow: ItemRowMetadata;
}) {
  const form = useFormMetadata();
  const { takenKeys, answerCounts } = useBuilderLinks();
  const signer = readSigner(signerRow);
  const defaultKey = nextFreeKey(sharedKey, takenKeys);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const headingId = useId();
  const inputId = useId();
  const hintId = useId();
  const dialogId = unlinkDialogId(sharedKey);
  const total = answerCounts[sharedKey]?.total ?? 0;

  return (
    <BuilderDialog
      id={dialogId}
      labelId={headingId}
      onClose={() => setError(null)}
    >
      <h3 id={headingId} className="text-xl font-semibold">
        Unlink from the signer's question?
      </h3>
      <p className="text-foreground/65 text-sm">
        The friend's copy becomes its own question, keeping the wording it has
        now. The signer's “{signer.label || sharedKey}” is unchanged. Editing
        one will no longer change the other.
      </p>
      <div className="flex flex-col gap-2">
        <label htmlFor={inputId} className="text-sm font-semibold">
          New field key for the friend's question
        </label>
        <Input
          ref={inputRef}
          id={inputId}
          type="text"
          defaultValue={defaultKey}
          aria-describedby={hintId}
        />
        <p id={hintId} className="text-foreground/50 text-[13px]">
          Becomes a second CSV column beside <strong>{sharedKey}</strong>.
          Lowercase letters, numbers and underscores.
        </p>
        {error ? (
          <p className="text-destructive-light text-sm">{error}</p>
        ) : null}
      </div>
      {total > 0 ? (
        <DialogCallout>
          {total === 1
            ? "1 answer was collected under the shared key."
            : `${total} answers were collected under the shared key.`}{" "}
          They stay in <strong>{sharedKey}</strong>; answers from now on are
          recorded under the new key.
        </DialogCallout>
      ) : null}
      <div className="flex justify-end gap-2">
        <DialogCancelButton dialogId={dialogId} />
        <Button
          variant="outline"
          size="sm"
          {...form.update.getButtonProps({
            name: friendRow.name,
            value: mirroredRowValue(signer, defaultKey),
          })}
          onClick={(event) => {
            event.preventDefault();
            const typed = (inputRef.current?.value ?? defaultKey).trim();
            const problem = !FIELD_KEY_REGEX.test(typed)
              ? "Use a key that starts with a letter and contains only lowercase letters, digits and underscores."
              : takenKeys.has(typed)
                ? "This key is already used by another question."
                : null;
            if (problem) {
              setError(problem);
              return;
            }
            form.update({
              name: friendRow.name,
              value: mirroredRowValue(signer, typed),
            });
            getDialog(dialogId)?.close();
          }}
        >
          <LinkBreak2Icon />
          Unlink
        </Button>
      </div>
    </BuilderDialog>
  );
}

// Identity fields: label is editable, everything else is fixed and submitted
// via hidden inputs (disabled inputs would not submit).
function PinnedIdentityRowView({ row }: { row: RowMetadata }) {
  const rowFields = row.getFieldset();

  return (
    <div className="flex flex-col gap-3">
      <input {...getInputProps(rowFields.type, { type: "hidden" })} />
      <input {...getInputProps(rowFields.name, { type: "hidden" })} />
      <input type="hidden" name={rowFields.required.name} value="on" />

      <Field
        labelProps={{ children: "Label" }}
        inputProps={{ ...getInputProps(rowFields.label, { type: "text" }) }}
        errors={rowFields.label.errors}
      />
      <DescriptionField field={rowFields.description} />
      <p className="text-foreground/65 text-[13px]">
        These fields are always required. You can still change the label that
        users see.
      </p>
    </div>
  );
}

function EditableRowView({
  row,
  keyLocked = false,
}: {
  row: EditableRowMetadata;
  // keys are the merge/answers link — immutable once submissions exist; new
  // fields still pick theirs freely (the parent derives this from mount-time
  // row identity)
  keyLocked?: boolean;
}) {
  const form = useFormMetadata();
  const rowFields = row.getFieldset();
  const labelInputProps = getInputProps(rowFields.label, { type: "text" });

  const isSelect = String(rowFields.type.value ?? "") === "select";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <SelectField
          className="min-w-0 sm:flex-[1_1_150px]"
          labelProps={{ children: "Type" }}
          selectProps={{
            ...getSelectProps(rowFields.type),
            options: TYPE_OPTIONS,
          }}
          errors={rowFields.type.errors}
        />
        <Field
          className="min-w-0 sm:flex-[1_1_180px]"
          labelProps={{ children: "Label" }}
          inputProps={{
            ...labelInputProps,
            onBlur: (event) => {
              // new fields derive their machine key from the label
              if (!rowFields.name.value) {
                form.update({
                  name: rowFields.name.name,
                  value: slugifyFieldKey(event.currentTarget.value),
                });
              }
            },
          }}
          errors={rowFields.label.errors}
        />
        <Field
          className="min-w-0 sm:flex-[1_1_180px]"
          labelProps={{
            children: keyLocked ? "Field key (locked)" : "Field key",
          }}
          inputProps={{
            ...getInputProps(rowFields.name, { type: "text" }),
            readOnly: keyLocked,
          }}
          errors={rowFields.name.errors}
        />
      </div>
      {keyLocked ? (
        <p className="text-foreground/50 text-[13px]">
          Field keys are locked because this form already has signups.
        </p>
      ) : null}
      <DescriptionField field={rowFields.description} />
      {isSelect ? (
        <TextareaField
          labelProps={{ children: "Options (one per line)" }}
          textareaProps={{
            ...getTextareaProps(rowFields.options),
            rows: 4,
            className: "resize-y",
          }}
          errors={rowFields.options.errors}
        />
      ) : (
        // keep the typed options in play while the type is something else —
        // toggling away from select and back must not discard them
        <input
          type="hidden"
          name={rowFields.options.name}
          value={String(rowFields.options.value ?? "")}
          readOnly
        />
      )}
      <CheckboxField
        labelProps={{ children: "Required" }}
        buttonProps={{
          ...getInputProps(rowFields.required, { type: "checkbox" }),
        }}
        errors={rowFields.required.errors}
      />
    </div>
  );
}

const mirrorControlClassName =
  "border-dashed bg-foreground/3 text-foreground/65 disabled:cursor-not-allowed disabled:opacity-100";

function MirrorFieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-foreground/65 font-semibold">{children}</span>;
}

function MirrorInput({
  label,
  value,
  keyField = false,
}: {
  label: ReactNode;
  value: string;
  keyField?: boolean;
}) {
  const inputId = useId();

  return (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-[1_1_180px]">
      {keyField ? (
        <Label htmlFor={inputId}>{label}</Label>
      ) : (
        <MirrorFieldLabel>{label}</MirrorFieldLabel>
      )}
      <Input
        id={keyField ? inputId : undefined}
        type="text"
        disabled
        value={value}
        className={cn(mirrorControlClassName, keyField && "text-foreground/80")}
      />
    </div>
  );
}

function MirrorTextarea({
  label,
  value,
  rows,
}: {
  label: ReactNode;
  value: string;
  rows: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <MirrorFieldLabel>{label}</MirrorFieldLabel>
      <textarea
        disabled
        value={value}
        rows={rows}
        className={cn(
          "bg-foreground/5 flex min-h-20 w-full resize-none rounded-lg border px-3 py-3",
          mirrorControlClassName,
        )}
      />
    </div>
  );
}

function MirrorSelect({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-[1_1_150px]">
      <MirrorFieldLabel>{label}</MirrorFieldLabel>
      <div className="relative">
        <select
          disabled
          className={cn(
            fieldShellClassName,
            "flex w-full appearance-none py-1 pr-9",
            mirrorControlClassName,
          )}
        >
          <option>{value}</option>
        </select>
        <ChevronDownIcon
          aria-hidden
          className="text-foreground/50 pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
        />
      </div>
    </div>
  );
}

// The friend side of a linked pair: the visible controls carry no name and
// are purely cosmetic; the hidden inputs render the signer row's live values,
// so the payload can never drift from what the mirror shows.
function MirrorRowView({
  itemRow,
  signerRow,
}: {
  itemRow: ItemRowMetadata;
  signerRow: RowMetadata;
}) {
  const { pendingReveal, resolveReveal } = useBuilderLinks();
  const itemFields = itemRow.getFieldset();
  const signer = readSigner(signerRow);
  const sharedKey = String(itemFields.name.value ?? "");
  const isSelect = signer.type === "select";
  const sentenceId = useId();
  const bodyRef = useRef<HTMLFieldSetElement>(null);

  useEffect(() => {
    if (pendingReveal !== sharedKey) return;
    bodyRef.current?.focus();
    resolveReveal();
  }, [pendingReveal, sharedKey, resolveReveal]);

  return (
    <fieldset
      ref={bodyRef}
      tabIndex={-1}
      aria-describedby={sentenceId}
      className="flex min-w-0 flex-col gap-3"
    >
      <p
        id={sentenceId}
        className="text-foreground/65 max-w-[70ch] text-sm leading-relaxed text-pretty"
      >
        Mirrors the signer's “{signer.label || "this question"}”. Type, label,
        help text and Required are edited on that row, and the field key is
        locked because the shared key is the link itself.
      </p>

      <input type="hidden" name={itemFields.type.name} value={signer.type} />
      <input type="hidden" name={itemFields.name.name} value={sharedKey} />
      <input type="hidden" name={itemFields.label.name} value={signer.label} />
      {signer.required ? (
        <input type="hidden" name={itemFields.required.name} value="on" />
      ) : null}
      {signer.description ? (
        <input
          type="hidden"
          name={itemFields.description.name}
          value={signer.description}
        />
      ) : null}
      {isSelect && signer.options ? (
        <input
          type="hidden"
          name={itemFields.options.name}
          value={signer.options}
        />
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <MirrorSelect label="Type" value={fieldTypeLabel(signer.type)} />
        <MirrorInput label="Label" value={signer.label} />
        <MirrorInput label="Field key" value={sharedKey} keyField />
      </div>
      <MirrorTextarea label="Help text" value={signer.description} rows={2} />
      {isSelect ? (
        <MirrorTextarea
          label="Options (one per line)"
          value={signer.options}
          rows={4}
        />
      ) : null}
      <div className="flex items-center gap-2">
        <Checkbox
          disabled
          checked={signer.required}
          className={mirrorControlClassName}
        />
        <span className="text-foreground/80 text-sm leading-snug">
          Required
        </span>
      </div>
    </fieldset>
  );
}

// The friends list is pinned: it cannot be removed or renamed, and lists are
// not addable — its item fields and maxCount are the only structural knobs.
function FriendsRowView({
  row,
  lockFieldKeys,
  isStoredRow,
  isRowOpen,
  toggleRow,
}: {
  row: RowMetadata;
  lockFieldKeys: boolean;
  isStoredRow: (rowKey: string | undefined) => boolean;
  isRowOpen: (rowKey: string | undefined) => boolean;
  toggleRow: (rowKey: string | undefined) => void;
}) {
  const form = useFormMetadata();
  const { linkedKeys, signerByKey } = useBuilderLinks();
  const rowFields = row.getFieldset();
  const itemFields = rowFields.itemFields.getFieldList();

  return (
    <div className="flex flex-col gap-4">
      <input {...getInputProps(rowFields.type, { type: "hidden" })} />
      <input {...getInputProps(rowFields.name, { type: "hidden" })} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Field
          className="min-w-0 grow"
          labelProps={{ children: "Label" }}
          inputProps={{ ...getInputProps(rowFields.label, { type: "text" }) }}
          errors={rowFields.label.errors}
        />
        <Field
          className="min-w-0 grow"
          // long labels wrap and knock the side-by-side inputs out of
          // alignment — keep it short, the range lives in min/max
          labelProps={{
            children: "Max per signup (0 disables)",
          }}
          inputProps={{
            ...getInputProps(rowFields.maxCount, { type: "number" }),
            min: 0,
            max: MAX_FRIENDS_COUNT,
          }}
          errors={rowFields.maxCount.errors}
        />
      </div>

      <DescriptionField
        field={rowFields.description}
        label="Description"
        hint={DESCRIPTION_HINT}
      />

      <div className="flex flex-col gap-3">
        <span className="text-sm font-semibold">Questions per friend</span>
        <ErrorList
          id={rowFields.itemFields.errorId}
          errors={rowFields.itemFields.errors}
        />
        <ul className="flex flex-col gap-2">
          {itemFields.map((itemRow, index) => {
            const itemLocked = lockFieldKeys && isStoredRow(itemRow.key);
            const itemRowFields = (itemRow as ItemRowMetadata).getFieldset();
            const itemType = String(itemRowFields.type.value ?? "");
            const itemKey = String(itemRowFields.name.value ?? "");
            const itemLabel = String(itemRowFields.label.value ?? "");
            const signerRow =
              itemKey !== "" && linkedKeys.has(itemKey)
                ? signerByKey.get(itemKey)
                : undefined;
            const itemRequired = Boolean(
              (signerRow ? signerRow.getFieldset() : itemRowFields).required
                .value,
            );

            return (
              <RowCard
                key={itemRow.key}
                row={itemRow as ItemRowMetadata}
                isRowOpen={isRowOpen}
                toggleRow={toggleRow}
                header={
                  <RowHeader
                    title={
                      (signerRow
                        ? String(signerRow.getFieldset().label.value ?? "")
                        : itemLabel) || "Untitled field"
                    }
                    meta={metaLine(
                      fieldTypeLabel(
                        signerRow
                          ? String(signerRow.getFieldset().type.value ?? "")
                          : itemType,
                      ),
                      signerRow !== undefined && "linked to the signer's",
                      itemRequired && "always required",
                    )}
                    listName={rowFields.itemFields.name}
                    index={index}
                    count={itemFields.length}
                  />
                }
              >
                {signerRow ? (
                  <>
                    <MirrorRowView
                      itemRow={itemRow as ItemRowMetadata}
                      signerRow={signerRow}
                    />
                    <ActionRow>
                      <DialogTriggerButton dialogId={unlinkDialogId(itemKey)}>
                        <LinkBreak2Icon />
                        Unlink
                      </DialogTriggerButton>
                      <RemoveButton
                        listName={rowFields.itemFields.name}
                        index={index}
                        confirmMessage={
                          itemLocked
                            ? REMOVE_RESPONDED_FIELD_MESSAGE
                            : undefined
                        }
                      />
                    </ActionRow>
                  </>
                ) : (
                  <>
                    <EditableRowView
                      row={itemRow as ItemRowMetadata}
                      keyLocked={itemLocked}
                    />
                    <ActionRow>
                      <RemoveButton
                        listName={rowFields.itemFields.name}
                        index={index}
                        confirmMessage={
                          itemLocked
                            ? REMOVE_RESPONDED_FIELD_MESSAGE
                            : undefined
                        }
                      />
                    </ActionRow>
                  </>
                )}
              </RowCard>
            );
          })}
        </ul>
        <Button
          variant="outline"
          size="sm"
          className="px-5"
          {...form.insert.getButtonProps({
            name: rowFields.itemFields.name,
            defaultValue: NEW_ROW,
          })}
        >
          Add friend field
        </Button>
      </div>
    </div>
  );
}
