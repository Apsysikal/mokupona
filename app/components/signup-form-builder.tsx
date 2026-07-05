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
  TrashIcon,
} from "@radix-ui/react-icons";
import { useRef, useState, type ReactNode } from "react";

import {
  CheckboxField,
  ErrorList,
  Field,
  SelectField,
  TextareaField,
} from "./forms";
import { Badge } from "./ui/badge";
import { Button, buttonVariants } from "./ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";

import {
  NON_LIST_FIELD_TYPES,
  type NonListFieldType,
} from "~/features/forms/fields/non-list";
import {
  defaultBuilderRows,
  slugifyFieldKey,
  type BuilderItemRow,
  type BuilderItemRowInput,
  type BuilderRowInput,
} from "~/features/signup-form/builder";
import {
  FIXED_IDENTITY_FIELDS,
  MAX_FRIENDS_COUNT,
} from "~/features/signup-form/schema";
import { cn } from "~/lib/utils";

// The admin "Signup form" section (design §10): a field array of descriptor
// rows rendered as collapsible cards. The friends list and the
// name/email/phone identity fields are pinned — rendered without
// type/key/remove controls — everything else is free.

// derived from the profile so the pin set can't drift from what the server
// actually requires
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

// the one deliberate second accent (teal, same lightness/chroma family as
// the orange primary) — contained to the friends chip, not a design token
const FRIENDS_CHIP_CLASSES =
  "border-[oklch(75%_0.09_220/0.4)] bg-[oklch(75%_0.09_220/0.16)] text-[oklch(75%_0.09_220)]";

const NEW_ROW: BuilderItemRow = {
  type: "text",
  name: "",
  label: "",
  required: false,
};

const REMOVE_RESPONDED_FIELD_MESSAGE =
  "This form already has signups; answers to this field will disappear from future versions. Remove it anyway?";

type RowMetadata = FieldMetadata<BuilderRowInput>;
type ItemRowMetadata = FieldMetadata<BuilderItemRowInput>;
// EditableRowView renders the keys the two row shapes share
type EditableRowMetadata = RowMetadata | ItemRowMetadata;

// The sync nudge's target: the other scope's field list and the keys it
// already holds (twins share name + type — the roster merge link, design §10)
interface TwinTarget {
  listName: string;
  existingKeys: Set<string>;
  buttonLabel: string;
}

function typeChipLabel(type: string): string {
  return TYPE_LABELS[type as NonListFieldType] ?? "Field";
}

export function SignupFormBuilder({
  field,
  lockFieldKeys = false,
}: {
  field: FieldMetadata<BuilderRowInput[]>;
  // true once the event's form has submissions: existing keys become
  // immutable and removals of existing fields ask for confirmation
  lockFieldKeys?: boolean;
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
  // intents (the label auto-slug update, the twin insert) write it too — and
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

  // Collapse state overlay: stored rows start collapsed, rows added in this
  // session start expanded; a toggle flips whichever default applies.
  const [toggledRows, setToggledRows] = useState<Set<string>>(new Set());
  const isRowOpen = (rowKey: string | undefined) => {
    if (rowKey === undefined) return true;
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

  const topLevelKeys = collectKeys(
    rows.filter((row) => row !== friendsRow) as RowMetadata[],
  );
  const itemKeys = collectKeys(
    (itemFieldsMeta?.getFieldList() ?? []) as ItemRowMetadata[],
  );

  const friendTwinTarget: TwinTarget | undefined = itemFieldsMeta
    ? {
        listName: itemFieldsMeta.name,
        existingKeys: itemKeys,
        buttonLabel: "Also ask each friend",
      }
    : undefined;
  const signerTwinTarget: TwinTarget = {
    listName: field.name,
    existingKeys: topLevelKeys,
    buttonLabel: "Also ask the signer",
  };

  return (
    // heading and border come from the surrounding "Signup form" section card;
    // min-w-0 opts out of the fieldset default min-width:min-content, which
    // would otherwise let row headers push the card past small viewports
    <fieldset className="flex min-w-0 flex-col gap-4">
      <ErrorList id={field.errorId} errors={field.errors} />

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
            friendTwinTarget={friendTwinTarget}
            signerTwinTarget={signerTwinTarget}
          />
        ))}
      </ul>

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

function collectKeys(rows: (RowMetadata | ItemRowMetadata)[]): Set<string> {
  return new Set(
    rows
      .map((row) => String(row.getFieldset().name.value ?? ""))
      .filter(Boolean),
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
  friendTwinTarget,
  signerTwinTarget,
}: {
  row: RowMetadata;
  listName: string;
  index: number;
  count: number;
  lockFieldKeys: boolean;
  isStoredRow: (rowKey: string | undefined) => boolean;
  isRowOpen: (rowKey: string | undefined) => boolean;
  toggleRow: (rowKey: string | undefined) => void;
  friendTwinTarget?: TwinTarget;
  signerTwinTarget: TwinTarget;
}) {
  const rowFields = row.getFieldset();
  const type = String(rowFields.type.value ?? "");
  const initialKey = String(rowFields.name.initialValue ?? "");
  const labelValue = String(rowFields.label.value ?? "");
  // the single lock predicate: the row was stored when the screen loaded AND
  // the form already has signups
  const rowLocked = lockFieldKeys && isStoredRow(row.key);

  if (type === "list") {
    const itemCount = rowFields.itemFields.getFieldList().length;

    return (
      <RowCard
        row={row}
        // friends card carries the teal tint from the design reference
        className="border-[oklch(75%_0.09_220/0.4)] bg-[oklch(75%_0.09_220/0.05)]"
        isRowOpen={isRowOpen}
        toggleRow={toggleRow}
        header={
          <RowHeader
            chip={
              <Badge variant="outline" className={FRIENDS_CHIP_CLASSES}>
                Friends
              </Badge>
            }
            title={labelValue || "Friends"}
            meta={`${itemCount} ${itemCount === 1 ? "question" : "questions"} per friend`}
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
          signerTwinTarget={signerTwinTarget}
        />
      </RowCard>
    );
  }

  // pinned-ness needs mount-time identity too: a custom row auto-slugged to
  // "email" must not morph into an unremovable pinned row
  const isPinnedIdentity =
    PINNED_IDENTITY_KEYS.has(initialKey) && isStoredRow(row.key);

  return (
    <RowCard
      row={row}
      // pinned identity cards carry the design's orange tint
      className={
        isPinnedIdentity
          ? "border-primary/35 bg-primary/[0.04]"
          : "border-white/10"
      }
      isRowOpen={isRowOpen}
      toggleRow={toggleRow}
      header={
        <RowHeader
          chip={
            isPinnedIdentity ? (
              <Badge>Pinned</Badge>
            ) : (
              <Badge variant="secondary">{typeChipLabel(type)}</Badge>
            )
          }
          title={
            labelValue || (isPinnedIdentity ? initialKey : "Untitled field")
          }
          meta={isPinnedIdentity ? "always required" : undefined}
          listName={listName}
          index={index}
          count={count}
          removable={!isPinnedIdentity}
          confirmRemoveMessage={
            rowLocked ? REMOVE_RESPONDED_FIELD_MESSAGE : undefined
          }
        />
      }
    >
      {isPinnedIdentity ? (
        <PinnedIdentityRowView row={row} />
      ) : (
        <EditableRowView
          row={row}
          keyLocked={rowLocked}
          twinTarget={friendTwinTarget}
        />
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
  small = false,
  isRowOpen,
  toggleRow,
  header,
  children,
}: {
  row: RowMetadata | ItemRowMetadata;
  className?: string;
  // nested per-friend rows render slightly tighter
  small?: boolean;
  isRowOpen: (rowKey: string | undefined) => boolean;
  toggleRow: (rowKey: string | undefined) => void;
  header: ReactNode;
  children: ReactNode;
}) {
  const hasNestedErrors = Object.keys(row.allErrors).length > 0;

  return (
    <li
      className={cn(
        "border",
        small ? "rounded-lg" : "rounded-[10px]",
        className,
      )}
    >
      <Collapsible
        open={isRowOpen(row.key) || hasNestedErrors}
        onOpenChange={() => toggleRow(row.key)}
      >
        {header}
        <RowErrors id={row.errorId} errors={row.errors} />
        <CollapsibleContent forceMount className="data-[state=closed]:hidden">
          <div
            className={cn(
              "border-t border-white/10",
              small ? "p-3" : "p-3 sm:p-4",
            )}
          >
            {children}
          </div>
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

// Header of a collapsible row card: type chip + title + optional meta text
// form the toggle trigger; reorder is free for every row, removal only for
// custom fields. Icon-only buttons keep the list scannable.
function RowHeader({
  chip,
  title,
  meta,
  listName,
  index,
  count,
  removable = false,
  confirmRemoveMessage,
  small = false,
}: {
  chip: ReactNode;
  title: string;
  meta?: string;
  listName: string;
  index: number;
  count: number;
  removable?: boolean;
  confirmRemoveMessage?: string;
  // nested per-friend rows render a compact header
  small?: boolean;
}) {
  const form = useFormMetadata();
  const compactButton = small ? "h-7 w-7" : undefined;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5",
        small ? "p-2" : "p-2.5 sm:p-3",
      )}
    >
      {/* the chip always stacks above the title; the flex layout lives on an
          inner span because Safari mishandles buttons as flex containers */}
      <CollapsibleTrigger className="min-w-0 flex-1 cursor-pointer text-left">
        <span className="flex min-w-0 flex-col items-start gap-1">
          {chip}
          <span className="flex w-full min-w-0 items-baseline gap-2">
            <span
              className={cn(
                "truncate font-semibold",
                small ? "text-xs" : "text-sm",
              )}
            >
              {title}
            </span>
            {meta ? (
              <span className="text-foreground/50 ml-auto hidden shrink-0 pr-1 text-xs sm:inline">
                {meta}
              </span>
            ) : null}
          </span>
        </span>
      </CollapsibleTrigger>

      <Button
        variant="outline"
        size="icon"
        className={cn("shrink-0", compactButton)}
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
        variant="outline"
        size="icon"
        className={cn("shrink-0", compactButton)}
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
      {removable ? (
        <Button
          variant="outline"
          size="icon"
          className={cn(
            "border-destructive/50 bg-destructive/10 hover:bg-destructive/30 shrink-0 text-red-300 hover:text-red-200",
            compactButton,
          )}
          aria-label="Remove"
          {...form.remove.getButtonProps({ name: listName, index })}
          onClick={
            confirmRemoveMessage
              ? (event) => {
                  if (!window.confirm(confirmRemoveMessage)) {
                    event.preventDefault();
                  }
                }
              : undefined
          }
        >
          <TrashIcon />
        </Button>
      ) : null}
      <CollapsibleTrigger
        aria-label="Toggle details"
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          compactButton,
          "data-[state=open]:text-primary shrink-0 [&[data-state=open]>svg]:rotate-180",
        )}
      >
        <ChevronDownIcon className="transition-transform duration-200" />
      </CollapsibleTrigger>
    </div>
  );
}

// Identity fields: label is editable, everything else is fixed and submitted
// via hidden inputs (disabled inputs would not submit).
function PinnedIdentityRowView({ row }: { row: RowMetadata }) {
  const rowFields = row.getFieldset();

  return (
    <div className="flex flex-col gap-3">
      {/* pinned values ride along as hidden inputs (disabled inputs would
          not submit); the server re-validates the profile regardless */}
      <input {...getInputProps(rowFields.type, { type: "hidden" })} />
      <input {...getInputProps(rowFields.name, { type: "hidden" })} />
      <input type="hidden" name={rowFields.required.name} value="on" />

      <Field
        labelProps={{ children: "Label" }}
        inputProps={{ ...getInputProps(rowFields.label, { type: "text" }) }}
        errors={rowFields.label.errors}
      />
      <p className="text-muted-foreground text-xs">
        Type and field key are fixed for identity fields — only the label guests
        see can change. Always required.
      </p>
    </div>
  );
}

function EditableRowView({
  row,
  keyLocked = false,
  twinTarget,
}: {
  row: EditableRowMetadata;
  // keys are the merge/answers link — immutable once submissions exist; new
  // fields still pick theirs freely (the parent derives this from mount-time
  // row identity)
  keyLocked?: boolean;
  twinTarget?: TwinTarget;
}) {
  const form = useFormMetadata();
  const rowFields = row.getFieldset();
  const labelInputProps = getInputProps(rowFields.label, { type: "text" });

  const keyValue = String(rowFields.name.value ?? "");
  const isSelect = String(rowFields.type.value ?? "") === "select";

  const showTwinButton =
    twinTarget !== undefined &&
    keyValue !== "" &&
    !twinTarget.existingKeys.has(keyValue);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <SelectField
          className="min-w-0 grow"
          labelProps={{ children: "Type" }}
          selectProps={{
            ...getSelectProps(rowFields.type),
            options: TYPE_OPTIONS,
          }}
          errors={rowFields.type.errors}
        />
        <Field
          className="min-w-0 grow"
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
          className="min-w-0 grow"
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
        <p className="text-foreground/50 text-xs">
          Field keys are locked because this form already has signups.
        </p>
      ) : null}
      {isSelect ? (
        <TextareaField
          labelProps={{ children: "Options (one per line)" }}
          textareaProps={{
            ...getTextareaProps(rowFields.options),
            rows: 4,
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
      <div className="flex flex-wrap items-center gap-4">
        <CheckboxField
          labelProps={{ children: "Required" }}
          buttonProps={{
            ...getInputProps(rowFields.required, { type: "checkbox" }),
          }}
          errors={rowFields.required.errors}
        />
        {showTwinButton ? (
          // sync nudge (design §10): create the twin with the same key and
          // type so the answers merge into one roster column
          <Button
            variant="outline"
            size="sm"
            {...form.insert.getButtonProps({
              name: twinTarget.listName,
              // the two twin targets carry different Conform name brands, so
              // the payload type can't be inferred here — it is a plain row
              defaultValue: {
                ...NEW_ROW,
                type: String(rowFields.type.value ?? "text"),
                name: keyValue,
                label: String(rowFields.label.value ?? "") || keyValue,
                // twins must match in type; a select twin needs the options
                ...(isSelect
                  ? { options: String(rowFields.options.value ?? "") }
                  : {}),
              } satisfies Record<string, unknown> as never,
            })}
          >
            {twinTarget.buttonLabel}
          </Button>
        ) : null}
      </div>
    </div>
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
  signerTwinTarget,
}: {
  row: RowMetadata;
  lockFieldKeys: boolean;
  isStoredRow: (rowKey: string | undefined) => boolean;
  isRowOpen: (rowKey: string | undefined) => boolean;
  toggleRow: (rowKey: string | undefined) => void;
  signerTwinTarget: TwinTarget;
}) {
  const form = useFormMetadata();
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

      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium">Questions per friend</span>
        <ErrorList
          id={rowFields.itemFields.errorId}
          errors={rowFields.itemFields.errors}
        />
        <ul className="flex flex-col gap-2.5">
          {itemFields.map((itemRow, index) => {
            const itemLocked = lockFieldKeys && isStoredRow(itemRow.key);
            const itemRowFields = (itemRow as ItemRowMetadata).getFieldset();
            const itemType = String(itemRowFields.type.value ?? "");
            const itemLabel = String(itemRowFields.label.value ?? "");

            return (
              <RowCard
                key={itemRow.key}
                row={itemRow as ItemRowMetadata}
                className="border-white/10"
                small
                isRowOpen={isRowOpen}
                toggleRow={toggleRow}
                header={
                  <RowHeader
                    small
                    chip={
                      <Badge variant="secondary">
                        {typeChipLabel(itemType)}
                      </Badge>
                    }
                    title={itemLabel || "Untitled field"}
                    listName={rowFields.itemFields.name}
                    index={index}
                    count={itemFields.length}
                    removable
                    confirmRemoveMessage={
                      itemLocked ? REMOVE_RESPONDED_FIELD_MESSAGE : undefined
                    }
                  />
                }
              >
                <EditableRowView
                  row={itemRow as ItemRowMetadata}
                  keyLocked={itemLocked}
                  twinTarget={signerTwinTarget}
                />
              </RowCard>
            );
          })}
        </ul>
        <Button
          variant="outline"
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
