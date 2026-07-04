import {
  getInputProps,
  getSelectProps,
  getTextareaProps,
  useFormMetadata,
  type FieldMetadata,
} from "@conform-to/react";
import { useRef } from "react";

import {
  CheckboxField,
  ErrorList,
  Field,
  SelectField,
  TextareaField,
} from "./forms";
import { Button } from "./ui/button";

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

// The admin "Signup form" section (design §10): a field array of descriptor
// rows. The friends list and the name/email/phone identity fields are pinned
// — rendered without type/key/remove controls — everything else is free.

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
    <fieldset className="flex flex-col gap-4 rounded-md border p-4">
      <legend className="px-1 text-lg font-medium">Signup form</legend>

      <ErrorList id={field.errorId} errors={field.errors} />

      <ul className="flex flex-col gap-4">
        {rows.map((row, index) => (
          <BuilderRowView
            key={row.key}
            row={row as RowMetadata}
            listName={field.name}
            index={index}
            count={rows.length}
            lockFieldKeys={lockFieldKeys}
            isStoredRow={isStoredRow}
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
  friendTwinTarget,
  signerTwinTarget,
}: {
  row: RowMetadata;
  listName: string;
  index: number;
  count: number;
  lockFieldKeys: boolean;
  isStoredRow: (rowKey: string | undefined) => boolean;
  friendTwinTarget?: TwinTarget;
  signerTwinTarget: TwinTarget;
}) {
  const rowFields = row.getFieldset();
  const type = String(rowFields.type.value ?? "");
  const initialKey = String(rowFields.name.initialValue ?? "");
  // the single lock predicate: the row was stored when the screen loaded AND
  // the form already has signups
  const rowLocked = lockFieldKeys && isStoredRow(row.key);

  if (type === "list") {
    return (
      <li className="flex flex-col gap-4 rounded-md border p-3">
        <RowHeader
          title="Friends (pinned)"
          listName={listName}
          index={index}
          count={count}
        />
        <ErrorList id={row.errorId} errors={row.errors} />
        <FriendsRowView
          row={row}
          lockFieldKeys={lockFieldKeys}
          isStoredRow={isStoredRow}
          signerTwinTarget={signerTwinTarget}
        />
      </li>
    );
  }

  // pinned-ness needs mount-time identity too: a custom row auto-slugged to
  // "email" must not morph into an unremovable pinned row
  const isPinnedIdentity =
    PINNED_IDENTITY_KEYS.has(initialKey) && isStoredRow(row.key);

  return (
    <li className="flex flex-col gap-4 rounded-md border p-3">
      <RowHeader
        title={isPinnedIdentity ? `${initialKey} (pinned)` : "Field"}
        listName={listName}
        index={index}
        count={count}
        removable={!isPinnedIdentity}
        confirmRemoveMessage={
          rowLocked ? REMOVE_RESPONDED_FIELD_MESSAGE : undefined
        }
      />
      <ErrorList id={row.errorId} errors={row.errors} />
      {isPinnedIdentity ? (
        <PinnedIdentityRowView row={row} />
      ) : (
        <EditableRowView
          row={row}
          keyLocked={rowLocked}
          twinTarget={friendTwinTarget}
        />
      )}
    </li>
  );
}

// Reorder is free for every row; removal only for custom fields.
function RowHeader({
  title,
  listName,
  index,
  count,
  removable = false,
  confirmRemoveMessage,
}: {
  title: string;
  listName: string;
  index: number;
  count: number;
  removable?: boolean;
  confirmRemoveMessage?: string;
}) {
  const form = useFormMetadata();

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-medium capitalize">{title}</span>
      <span className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={index === 0}
          {...form.reorder.getButtonProps({
            name: listName,
            from: index,
            to: Math.max(0, index - 1),
          })}
        >
          Up
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={index === count - 1}
          {...form.reorder.getButtonProps({
            name: listName,
            from: index,
            to: Math.min(count - 1, index + 1),
          })}
        >
          Down
        </Button>
        {removable ? (
          <Button
            variant="destructive"
            size="sm"
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
            Remove
          </Button>
        ) : null}
      </span>
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
      <p className="text-muted-foreground text-xs">Always required.</p>
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
          className="grow"
          labelProps={{ children: "Type" }}
          selectProps={{
            ...getSelectProps(rowFields.type),
            options: TYPE_OPTIONS,
          }}
          errors={rowFields.type.errors}
        />
        <Field
          className="grow"
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
          className="grow"
          labelProps={{
            children: keyLocked
              ? "Field key (locked — this form already has signups)"
              : "Field key",
          }}
          inputProps={{
            ...getInputProps(rowFields.name, { type: "text" }),
            readOnly: keyLocked,
          }}
          errors={rowFields.name.errors}
        />
      </div>
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
  signerTwinTarget,
}: {
  row: RowMetadata;
  lockFieldKeys: boolean;
  isStoredRow: (rowKey: string | undefined) => boolean;
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
          className="grow"
          labelProps={{ children: "Label" }}
          inputProps={{ ...getInputProps(rowFields.label, { type: "text" }) }}
          errors={rowFields.label.errors}
        />
        <Field
          className="grow"
          labelProps={{
            children: `Maximum friends per signup (0–${MAX_FRIENDS_COUNT}, 0 disables friends)`,
          }}
          inputProps={{
            ...getInputProps(rowFields.maxCount, { type: "number" }),
            min: 0,
            max: MAX_FRIENDS_COUNT,
          }}
          errors={rowFields.maxCount.errors}
        />
      </div>

      <div className="flex flex-col gap-3 border-l pl-4">
        <span className="text-sm font-medium">Questions per friend</span>
        <ErrorList
          id={rowFields.itemFields.errorId}
          errors={rowFields.itemFields.errors}
        />
        <ul className="flex flex-col gap-4">
          {itemFields.map((itemRow, index) => {
            const itemLocked = lockFieldKeys && isStoredRow(itemRow.key);

            return (
              <li key={itemRow.key} className="flex flex-col gap-3">
                <RowHeader
                  title="Friend field"
                  listName={rowFields.itemFields.name}
                  index={index}
                  count={itemFields.length}
                  removable
                  confirmRemoveMessage={
                    itemLocked ? REMOVE_RESPONDED_FIELD_MESSAGE : undefined
                  }
                />
                <ErrorList id={itemRow.errorId} errors={itemRow.errors} />
                <EditableRowView
                  row={itemRow as ItemRowMetadata}
                  keyLocked={itemLocked}
                  twinTarget={signerTwinTarget}
                />
              </li>
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
